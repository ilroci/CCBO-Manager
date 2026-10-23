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
import { badRequest, HttpError } from "./http-error";
import { CATEGORY_LABELS } from "./labels";
import { chargesForOptions } from "./pricing";
import { lockAndAssertAvailable } from "./rentals";

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
 * Noleggio di un partecipante: le voci di listino scelte (vista rapida, determinano il prezzo)
 * e, facoltativamente, i pezzi specifici assegnati (vista di dettaglio, bloccano la disponibilità).
 * `days`: giorni addebitati a chi partecipa solo a una parte dell'uscita; null = tutta l'uscita,
 * assente = invariati.
 */
export interface RentalSpec {
  optionIds: string[];
  itemIds: string[];
  days?: number | null;
}

/**
 * Giorni da salvare come `chargedDays`: null quando coprono tutta l'uscita, così il noleggio
 * segue le date se l'uscita si allunga. Se l'uscita si accorcia, non si superano i suoi giorni.
 */
export function normalizeChargedDays(days: number | null | undefined, outingDays: number) {
  return days == null || days >= outingDays ? null : days;
}

/** Giorni addebitati del noleggio di uscita. */
export const chargedDaysOf = (chargedDays: number | null, outingDays: number) =>
  normalizeChargedDays(chargedDays, outingDays) ?? outingDays;

/** Verifica voci e pezzi: i pezzi devono rientrare nelle categorie delle voci scelte. */
async function resolveRentalSpec(db: Db, spec: RentalSpec) {
  if (spec.optionIds.length === 0) {
    if (spec.itemIds.length > 0) throw badRequest("Scegli almeno una voce di noleggio prima di indicare il materiale");
    return null;
  }
  const options = await db.rentalOption.findMany({
    where: { id: { in: spec.optionIds } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (options.length !== spec.optionIds.length) throw badRequest("Voce di listino non trovata");

  const items = await db.equipmentItem.findMany({ where: { id: { in: spec.itemIds } } });
  if (items.length !== spec.itemIds.length) throw badRequest("Uno o più pezzi non esistono");
  const covered = new Set(options.flatMap((option) => option.categories));
  for (const item of items) {
    if (item.isArchived) throw badRequest(`Il pezzo ${item.serialNumber} è archiviato`);
    if (!covered.has(item.category)) {
      throw badRequest(`Il pezzo ${item.serialNumber} (${CATEGORY_LABELS[item.category]}) non rientra nelle voci scelte`);
    }
  }
  return { options, items };
}

/**
 * Quota individuale di un partecipante, senza salvare nulla (riepilogo del wizard):
 * (1) noleggio = voci di listino scelte × giorni di noleggio (di default tutta l'uscita);
 * (2) solo trasporto attrezzatura = tariffa fissa per uscita;
 * (3) quota furgone = tariffa fissa per uscita, più i costi vivi che non hanno importo.
 */
export async function quoteParticipant(
  db: Db,
  outing: Pick<Outing, "startDate" | "endDate">,
  spec: RentalSpec,
  travelMode: TravelMode,
) {
  const resolved = await resolveRentalSpec(db, spec);
  const days = chargedDaysOf(spec.days ?? null, calendarDays(outing.startDate, outing.endDate));
  const rental = resolved ? chargesForOptions(resolved.options, days) : null;
  const rentalAmount = rental?.total ?? ZERO;
  const services = await serviceAmounts(db, travelMode);
  return {
    rental,
    rentalAmount,
    ...services,
    totalAmount: rentalAmount.add(services.transportAmount).add(services.vanSeatAmount),
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((value) => b.includes(value));

/**
 * Salva noleggio e quote di un partecipante.
 * - `spec`: voci, pezzi e giorni scelti nel wizard. Le voci si riprezzano col listino attuale solo
 *   se cambiano; se cambiano solo i giorni vale il prezzo giornaliero già applicato. I pezzi si
 *   possono cambiare senza toccare il prezzo (anche a noleggio riscosso): pezzi diversi tornano
 *   "da far rientrare". Il materiale resta impegnato per tutte le date dell'uscita.
 * - `datesChanged`: stesse voci, prezzo giornaliero già applicato × nuovi giorni (i giorni
 *   ridotti restano tali, ma non oltre la durata dell'uscita).
 * - nessuno dei due: il noleggio resta com'è (es. cambio di sola modalità di viaggio).
 * Quota furgone / trasporto e totale si ricalcolano sempre dalla modalità di viaggio.
 */
export async function syncParticipant(
  tx: Db,
  outing: Pick<Outing, "startDate" | "endDate">,
  participant: { id: string; memberId: string; travelMode: TravelMode },
  change: { spec?: RentalSpec; datesChanged?: boolean } = {},
) {
  const { startDate, endDate } = outing;
  const outingDays = calendarDays(startDate, endDate);
  const existing = await tx.rental.findUnique({
    where: { participantId: participant.id },
    include: { items: true, charges: true },
  });

  if (change.spec) {
    const resolved = await resolveRentalSpec(tx, change.spec);
    if (!resolved) {
      if (existing) await tx.rental.delete({ where: { id: existing.id } });
    } else {
      const itemIds = change.spec.itemIds;
      if (itemIds.length > 0) await lockAndAssertAvailable(tx, itemIds, startDate, endDate, existing?.id);
      const chargedDays = normalizeChargedDays(
        change.spec.days !== undefined ? change.spec.days : existing?.chargedDays,
        outingDays,
      );
      const days = chargedDays ?? outingDays;

      if (!existing) {
        const { charges, total } = chargesForOptions(resolved.options, days);
        await tx.rental.create({
          data: {
            kind: RentalKind.OUTING,
            memberId: participant.memberId,
            participantId: participant.id,
            startDate,
            endDate,
            chargedDays,
            total,
            items: { create: itemIds.map((itemId) => ({ itemId })) },
            charges: { create: charges },
          },
        });
      } else {
        const optionsChanged = !sameSet(
          existing.charges.map((c) => c.optionId ?? ""),
          change.spec.optionIds,
        );
        const itemsChanged = !sameSet(
          existing.items.map((row) => row.itemId),
          itemIds,
        );
        if (optionsChanged) {
          const { charges, total } = chargesForOptions(resolved.options, days);
          await tx.rentalCharge.deleteMany({ where: { rentalId: existing.id } });
          await tx.rental.update({
            where: { id: existing.id },
            data: { chargedDays, total, charges: { create: charges } },
          });
        } else if (days !== chargedDaysOf(existing.chargedDays, outingDays)) {
          await repriceDays(tx, existing, chargedDays, days);
        }
        if (itemsChanged) {
          await tx.rentalItem.deleteMany({ where: { rentalId: existing.id } });
          await tx.rental.update({
            where: { id: existing.id },
            data: { status: RentalStatus.RESERVED, items: { create: itemIds.map((itemId) => ({ itemId })) } },
          });
        }
      }
    }
  } else if (change.datesChanged && existing) {
    const itemIds = existing.items.map((row) => row.itemId);
    if (itemIds.length > 0) await lockAndAssertAvailable(tx, itemIds, startDate, endDate, existing.id);
    const chargedDays = normalizeChargedDays(existing.chargedDays, outingDays);
    await tx.rental.update({ where: { id: existing.id }, data: { startDate, endDate } });
    await repriceDays(tx, existing, chargedDays, chargedDays ?? outingDays);
  }

  const rental = await tx.rental.findUnique({ where: { participantId: participant.id }, select: { total: true } });
  const rentalAmount = rental?.total ?? ZERO;
  const services = await serviceAmounts(tx, participant.travelMode);
  await tx.outingParticipant.update({
    where: { id: participant.id },
    data: {
      rentalAmount,
      ...services,
      totalAmount: rentalAmount.add(services.transportAmount).add(services.vanSeatAmount),
    },
  });
}

/** Stesse voci, prezzo giornaliero già applicato × nuovi giorni. */
async function repriceDays(
  tx: Db,
  rental: { id: string; charges: { id: string; dailyPrice: Prisma.Decimal }[] },
  chargedDays: number | null,
  days: number,
) {
  let total = ZERO;
  for (const charge of rental.charges) {
    const amount = charge.dailyPrice.mul(days);
    total = total.add(amount);
    await tx.rentalCharge.update({ where: { id: charge.id }, data: { days, amount } });
  }
  await tx.rental.update({ where: { id: rental.id }, data: { chargedDays, total } });
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
      /** Giorni addebitati: meno di quelli dell'uscita se il socio partecipa solo in parte. */
      days: chargedDaysOf(p.rental.chargedDays, calendarDays(outing.startDate, outing.endDate)),
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
    instructor: outing.instructor,
    vanSeats: outing.vanSeats,
    notes: outing.notes,
    createdAt: outing.createdAt,
    participants,
    totals: {
      participants: participants.length,
      aboardVan: participants.filter((p) => p.travelMode === TravelMode.VAN).length,
      /** Soci con attrezzatura del club non ancora segnata come rientrata. */
      // Senza pezzi assegnati non c'è nulla da far rientrare.
      toReturn: participants.filter((p) => p.rental?.status === RentalStatus.RESERVED && p.rental.items.length > 0).length,
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
