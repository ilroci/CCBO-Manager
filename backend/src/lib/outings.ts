import {
  CollectionCategory,
  Prisma,
  RentalKind,
  RentalStatus,
  ServiceType,
  TravelMode,
  type Outing,
} from "@prisma/client";
import { calendarDays, formatDate } from "./dates";
import { itemInclude, toItemDto } from "./equipment";
import { HttpError } from "./http-error";
import { lockAndAssertAvailable, quoteRental } from "./rentals";

type Db = Prisma.TransactionClient;

const ZERO = new Prisma.Decimal(0);

/** Servizio furgone addebitato per ciascuna modalità di viaggio (C, autonomo, non paga nulla). */
const FEE_BY_TRAVEL_MODE: Partial<Record<TravelMode, ServiceType>> = {
  [TravelMode.VAN]: ServiceType.VAN_SEAT, // A) quota furgone (+ costi vivi, senza importo)
  [TravelMode.TRANSPORT_ONLY]: ServiceType.EQUIPMENT_TRANSPORT, // B) solo trasporto attrezzatura
};

/** Quota furgone o trasporto per la modalità di viaggio. */
export async function serviceAmounts(db: Db, travelMode: TravelMode) {
  const type = FEE_BY_TRAVEL_MODE[travelMode];
  const fee = type ? ((await db.serviceFee.findUnique({ where: { type } }))?.amount ?? ZERO) : ZERO;
  return {
    transportAmount: travelMode === TravelMode.TRANSPORT_ONLY ? fee : ZERO,
    vanSeatAmount: travelMode === TravelMode.VAN ? fee : ZERO,
  };
}

/**
 * Quota individuale di un partecipante, senza salvare nulla (riepilogo del wizard):
 * (1) noleggio = voci di listino × giorni dell'uscita;
 * (2) solo trasporto attrezzatura = tariffa fissa per uscita;
 * (3) quota furgone = tariffa fissa per uscita, più i costi vivi che non hanno importo.
 */
export async function quoteParticipant(
  db: Db,
  outing: Pick<Outing, "startDate" | "endDate">,
  itemIds: string[],
  travelMode: TravelMode,
) {
  const rental = itemIds.length > 0 ? await quoteRental(db, itemIds, outing.startDate, outing.endDate) : null;
  const rentalAmount = rental?.total ?? ZERO;
  const services = await serviceAmounts(db, travelMode);
  return {
    rental,
    rentalAmount,
    ...services,
    totalAmount: rentalAmount.add(services.transportAmount).add(services.vanSeatAmount),
  };
}

/**
 * Salva noleggio e quote di un partecipante.
 * - `itemIds` presente: crea/aggiorna/elimina il noleggio (opzione 1) con le date dell'uscita
 *   e ne ricalcola il prezzo; se i pezzi non cambiano, il rientro già segnato resta.
 * - `itemIds` assente: il noleggio e il suo importo restano com'erano (es. cambio di sola
 *   modalità di viaggio, magari con il noleggio già riscosso).
 * Quota furgone / trasporto e totale si ricalcolano sempre dalla modalità di viaggio.
 */
export async function syncParticipant(
  tx: Db,
  outing: Pick<Outing, "startDate" | "endDate">,
  participant: { id: string; memberId: string; rentalId: string | null; travelMode: TravelMode },
  itemIds?: string[],
) {
  let rentalAmount: Prisma.Decimal | undefined;

  if (itemIds) {
    if (itemIds.length > 0) {
      await lockAndAssertAvailable(tx, itemIds, outing.startDate, outing.endDate, participant.rentalId ?? undefined);
    }
    const rental = itemIds.length > 0 ? await quoteRental(tx, itemIds, outing.startDate, outing.endDate) : null;
    rentalAmount = rental?.total ?? ZERO;

    if (!rental) {
      if (participant.rentalId) await tx.rental.delete({ where: { id: participant.rentalId } });
    } else if (!participant.rentalId) {
      await tx.rental.create({
        data: {
          kind: RentalKind.OUTING,
          memberId: participant.memberId,
          participantId: participant.id,
          startDate: outing.startDate,
          endDate: outing.endDate,
          total: rental.total,
          items: { create: itemIds.map((itemId) => ({ itemId })) },
          charges: { create: rental.charges },
        },
      });
    } else {
      const rentalId = participant.rentalId;
      await tx.rentalCharge.deleteMany({ where: { rentalId } });
      const current = await tx.rentalItem.findMany({ where: { rentalId }, select: { itemId: true } });
      const sameItems = current.length === itemIds.length && current.every((row) => itemIds.includes(row.itemId));
      // Pezzi diversi: si ricreano e il materiale torna "da far rientrare".
      if (!sameItems) await tx.rentalItem.deleteMany({ where: { rentalId } });
      await tx.rental.update({
        where: { id: rentalId },
        data: {
          startDate: outing.startDate,
          endDate: outing.endDate,
          total: rental.total,
          charges: { create: rental.charges },
          ...(sameItems
            ? {}
            : { status: RentalStatus.RESERVED, items: { create: itemIds.map((itemId) => ({ itemId })) } }),
        },
      });
    }
  }

  const current = await tx.outingParticipant.findUniqueOrThrow({
    where: { id: participant.id },
    select: { rentalAmount: true },
  });
  const finalRental = rentalAmount ?? current.rentalAmount;
  const services = await serviceAmounts(tx, participant.travelMode);
  await tx.outingParticipant.update({
    where: { id: participant.id },
    data: {
      rentalAmount: finalRental,
      ...services,
      totalAmount: finalRental.add(services.transportAmount).add(services.vanSeatAmount),
    },
  });
}

/** Se l'uscita ha un numero di posti sul furgone, i partecipanti a bordo non possono superarlo. */
export async function assertVanSeats(tx: Db, outingId: string, vanSeats: number | null) {
  if (vanSeats === null) return;
  const aboard = await tx.outingParticipant.count({ where: { outingId, travelMode: TravelMode.VAN } });
  if (aboard > vanSeats) {
    throw new HttpError(409, `Posti sul furgone esauriti: ${aboard} a bordo su ${vanSeats} disponibili`);
  }
}

/** Voce da riscuotere per ciascuna modalità di viaggio (oltre al noleggio, se c'è). */
export const SERVICE_CATEGORY: Partial<Record<TravelMode, CollectionCategory>> = {
  [TravelMode.TRANSPORT_ONLY]: CollectionCategory.TRANSPORT,
  [TravelMode.VAN]: CollectionCategory.VAN,
};

const personSelect = { id: true, firstName: true, lastName: true, email: true } as const;

export const outingInclude = {
  instructor: { select: personSelect },
  participants: {
    orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
    include: {
      member: { select: personSelect },
      payments: { include: { confirmedBy: { select: personSelect } } },
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
type ParticipantWithRelations = OutingWithRelations["participants"][number];

const money = (value: Prisma.Decimal) => value.toFixed(2);

/**
 * Voci da riscuotere del partecipante, ognuna con il suo stato di riscossione:
 * noleggio (se c'è), trasporto (B) oppure quota furgone + costi vivi (A).
 */
function collections(p: ParticipantWithRelations) {
  const list: { category: CollectionCategory; amount: Prisma.Decimal; includesExpenses: boolean }[] = [];
  if (p.rental) list.push({ category: CollectionCategory.RENTAL, amount: p.rentalAmount, includesExpenses: false });
  if (p.travelMode === TravelMode.TRANSPORT_ONLY) {
    list.push({ category: CollectionCategory.TRANSPORT, amount: p.transportAmount, includesExpenses: false });
  }
  if (p.travelMode === TravelMode.VAN) {
    list.push({ category: CollectionCategory.VAN, amount: p.vanSeatAmount, includesExpenses: true });
  }
  return list.map((c) => {
    const payment = p.payments.find((pay) => pay.category === c.category);
    return {
      category: c.category,
      amount: money(c.amount),
      /** Per la voce furgone: si riscuotono anche i costi vivi, senza importo. */
      includesExpenses: c.includesExpenses,
      /** null = ancora da riscuotere */
      payment: payment
        ? { amount: money(payment.amount), paidAt: payment.paidAt, confirmedBy: payment.confirmedBy }
        : null,
    };
  });
}

/** Forma pubblica dell'uscita, con i totali calcolati. */
export function toOutingDto(outing: OutingWithRelations) {
  const participants = outing.participants.map((p) => ({
    id: p.id,
    member: p.member,
    travelMode: p.travelMode,
    rentalAmount: money(p.rentalAmount),
    transportAmount: money(p.transportAmount),
    vanSeatAmount: money(p.vanSeatAmount),
    totalAmount: money(p.totalAmount),
    collections: collections(p),
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
    .flatMap((p) => p.payments)
    .reduce((sum, payment) => sum.add(payment.amount), ZERO);
  const allCollections = participants.flatMap((p) => p.collections);

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
      /** Soci con attrezzatura del club non ancora segnata come rientrata. */
      toReturn: participants.filter((p) => p.rental?.status === RentalStatus.RESERVED).length,
      /** Importi noti (costi vivi esclusi) e quanto ne è già stato riscosso. */
      total: money(total),
      collected: money(collected),
      /** Voci ancora da riscuotere, su tutte le voci dei partecipanti. */
      pendingCollections: allCollections.filter((c) => !c.payment).length,
      /** Soci a bordo del furgone che non hanno ancora versato quota furgone e costi vivi. */
      pendingExpenses: allCollections.filter((c) => c.includesExpenses && !c.payment).length,
    },
  };
}
