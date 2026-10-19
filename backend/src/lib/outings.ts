import { Prisma, RentalKind, ServiceType, TravelMode, type Outing } from "@prisma/client";
import { calendarDays, formatDate } from "./dates";
import { itemInclude, toItemDto } from "./equipment";
import { HttpError } from "./http-error";
import { lockAndAssertAvailable, quoteRental } from "./rentals";

type Db = Prisma.TransactionClient;

const ZERO = new Prisma.Decimal(0);

/** Tariffa del servizio furgone per la modalità di viaggio (oggi solo B → trasporto attrezzatura). */
export async function transportFee(db: Db, travelMode: TravelMode): Promise<Prisma.Decimal> {
  if (travelMode !== TravelMode.TRANSPORT_ONLY) return ZERO;
  const fee = await db.serviceFee.findUnique({ where: { type: ServiceType.EQUIPMENT_TRANSPORT } });
  return fee?.amount ?? ZERO;
}

/**
 * Quota individuale di un partecipante, senza salvare nulla (riepilogo del wizard):
 * (1) noleggio = voci di listino × giorni dell'uscita;
 * (2) solo trasporto attrezzatura = tariffa fissa per uscita;
 * (3) quota furgone + spese vive = 0, rimandate.
 */
export async function quoteParticipant(
  db: Db,
  outing: Pick<Outing, "startDate" | "endDate">,
  itemIds: string[],
  travelMode: TravelMode,
) {
  const rental = itemIds.length > 0 ? await quoteRental(db, itemIds, outing.startDate, outing.endDate) : null;
  const rentalAmount = rental?.total ?? ZERO;
  const transportAmount = await transportFee(db, travelMode);
  return {
    rental,
    rentalAmount,
    transportAmount,
    vanSeatAmount: ZERO,
    expensesShare: ZERO,
    totalAmount: rentalAmount.add(transportAmount),
  };
}

/**
 * Crea, aggiorna o elimina il noleggio (opzione 1) di un partecipante, con le date
 * dell'uscita, poi ricalcola e salva la sua quota individuale (copia degli importi applicati).
 */
export async function syncParticipant(
  tx: Db,
  outing: Pick<Outing, "startDate" | "endDate">,
  participant: { id: string; memberId: string; rentalId: string | null; travelMode: TravelMode },
  itemIds: string[],
) {
  if (itemIds.length > 0) {
    await lockAndAssertAvailable(tx, itemIds, outing.startDate, outing.endDate, participant.rentalId ?? undefined);
  }
  const { rental, ...amounts } = await quoteParticipant(tx, outing, itemIds, participant.travelMode);

  if (!rental) {
    if (participant.rentalId) await tx.rental.delete({ where: { id: participant.rentalId } });
  } else {
    const data = {
      startDate: outing.startDate,
      endDate: outing.endDate,
      total: rental.total,
      items: { create: itemIds.map((itemId) => ({ itemId })) },
      charges: { create: rental.charges },
    };
    if (participant.rentalId) {
      // Prima si svuotano pezzi e voci, poi si ricreano: ordine esplicito, non affidato ai nested write.
      await tx.rentalItem.deleteMany({ where: { rentalId: participant.rentalId } });
      await tx.rentalCharge.deleteMany({ where: { rentalId: participant.rentalId } });
      await tx.rental.update({ where: { id: participant.rentalId }, data });
    } else {
      await tx.rental.create({
        data: { ...data, kind: RentalKind.OUTING, memberId: participant.memberId, participantId: participant.id },
      });
    }
  }

  await tx.outingParticipant.update({ where: { id: participant.id }, data: amounts });
}

/** Se l'uscita ha un numero di posti sul furgone, i partecipanti a bordo non possono superarlo. */
export async function assertVanSeats(tx: Db, outingId: string, vanSeats: number | null) {
  if (vanSeats === null) return;
  const aboard = await tx.outingParticipant.count({ where: { outingId, travelMode: TravelMode.VAN } });
  if (aboard > vanSeats) {
    throw new HttpError(409, `Posti sul furgone esauriti: ${aboard} a bordo su ${vanSeats} disponibili`);
  }
}

const personSelect = { id: true, firstName: true, lastName: true, email: true } as const;

export const outingInclude = {
  instructor: { select: personSelect },
  participants: {
    orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
    include: {
      member: { select: personSelect },
      paidConfirmedBy: { select: personSelect },
      rental: {
        include: {
          items: { include: { item: { include: itemInclude } }, orderBy: { item: { category: "asc" } } },
          charges: true,
        },
      },
    },
  },
} satisfies Prisma.OutingInclude;

type OutingWithRelations = Prisma.OutingGetPayload<{ include: typeof outingInclude }>;

const money = (value: Prisma.Decimal) => value.toFixed(2);

/** Forma pubblica dell'uscita, con i totali calcolati. */
export function toOutingDto(outing: OutingWithRelations) {
  const participants = outing.participants.map((p) => ({
    id: p.id,
    member: p.member,
    travelMode: p.travelMode,
    rentalAmount: money(p.rentalAmount),
    transportAmount: money(p.transportAmount),
    vanSeatAmount: money(p.vanSeatAmount),
    expensesShare: money(p.expensesShare),
    totalAmount: money(p.totalAmount),
    paymentStatus: p.paymentStatus,
    paidAt: p.paidAt,
    paidConfirmedBy: p.paidConfirmedBy,
    rental: p.rental && {
      id: p.rental.id,
      status: p.rental.status,
      total: money(p.rental.total),
      items: p.rental.items.map(({ item, ...row }) => ({ ...row, item: toItemDto(item) })),
      charges: p.rental.charges.map((c) => ({ ...c, dailyPrice: money(c.dailyPrice), amount: money(c.amount) })),
    },
  }));

  const total = outing.participants.reduce((sum, p) => sum.add(p.totalAmount), ZERO);
  const collected = outing.participants
    .filter((p) => p.paymentStatus === "PAID")
    .reduce((sum, p) => sum.add(p.totalAmount), ZERO);

  return {
    id: outing.id,
    title: outing.title,
    destination: outing.destination,
    startDate: formatDate(outing.startDate),
    endDate: formatDate(outing.endDate),
    days: calendarDays(outing.startDate, outing.endDate),
    status: outing.status,
    instructor: outing.instructor,
    vanSeats: outing.vanSeats,
    notes: outing.notes,
    createdAt: outing.createdAt,
    participants,
    totals: {
      participants: participants.length,
      aboardVan: participants.filter((p) => p.travelMode === TravelMode.VAN).length,
      total: money(total),
      collected: money(collected),
    },
  };
}
