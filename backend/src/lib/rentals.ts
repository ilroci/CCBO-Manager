import { Prisma, RentalStatus } from "@prisma/client";
import { calendarDays, formatDate } from "./dates";
import { itemInclude, toItemDto } from "./equipment";
import { badRequest, HttpError } from "./http-error";
import { computeCharges } from "./pricing";

type Db = Prisma.TransactionClient;

/** Stati che occupano i pezzi nei giorni del noleggio. */
export const BLOCKING_STATUSES = [RentalStatus.RESERVED, RentalStatus.ACTIVE];

/** Durata massima di una prenotazione personale. */
export const MAX_RENTAL_DAYS = 30;

/** Id dei pezzi (tra quelli indicati) già impegnati in noleggi che si sovrappongono all'intervallo. */
export async function findBusyItemIds(
  db: Db,
  itemIds: string[] | undefined,
  start: Date,
  end: Date,
  excludeRentalId?: string,
): Promise<Set<string>> {
  const busy = await db.rentalItem.findMany({
    where: {
      itemId: itemIds ? { in: itemIds } : undefined,
      rental: {
        id: excludeRentalId ? { not: excludeRentalId } : undefined,
        status: { in: BLOCKING_STATUSES },
        // Intervalli inclusivi: si sovrappongono se ognuno inizia prima che l'altro finisca.
        startDate: { lte: end },
        endDate: { gte: start },
      },
    },
    select: { itemId: true },
  });
  return new Set(busy.map((row) => row.itemId));
}

/** Calcola giorni, voci e totale per un insieme di pezzi, verificando che esistano e siano noleggiabili. */
export async function quoteRental(db: Db, itemIds: string[], start: Date, end: Date) {
  const items = await db.equipmentItem.findMany({ where: { id: { in: itemIds } } });
  if (items.length !== itemIds.length) throw badRequest("Uno o più pezzi non esistono");
  const archived = items.find((item) => item.isArchived);
  if (archived) throw badRequest(`Il pezzo ${archived.serialNumber} è archiviato`);

  const options = await db.rentalOption.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const days = calendarDays(start, end);
  return { items, days, ...computeCharges(items.map((item) => item.category), options, days) };
}

/**
 * Blocca le righe dei pezzi fino alla fine della transazione (SELECT ... FOR UPDATE), poi
 * verifica che siano liberi. Due prenotazioni concorrenti sugli stessi pezzi vengono così
 * serializzate: la seconda vede la prima e fallisce con 409.
 */
export async function lockAndAssertAvailable(
  db: Db,
  itemIds: string[],
  start: Date,
  end: Date,
  excludeRentalId?: string,
) {
  const sorted = [...itemIds].sort(); // ordine fisso per evitare deadlock
  await db.$queryRaw`SELECT id FROM "EquipmentItem" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;

  const busy = await findBusyItemIds(db, itemIds, start, end, excludeRentalId);
  if (busy.size > 0) {
    const taken = await db.equipmentItem.findMany({ where: { id: { in: [...busy] } }, select: { serialNumber: true } });
    throw new HttpError(
      409,
      `Non più disponibili in quelle date: ${taken.map((item) => item.serialNumber).join(", ")}`,
    );
  }
}

export const rentalInclude = {
  member: { select: { id: true, firstName: true, lastName: true, email: true } },
  items: { include: { item: { include: itemInclude } }, orderBy: { item: { category: "asc" } } },
  charges: true,
} satisfies Prisma.RentalInclude;

type RentalWithRelations = Prisma.RentalGetPayload<{ include: typeof rentalInclude }>;

/** Forma pubblica del noleggio: date "YYYY-MM-DD", importi come stringhe a due decimali. */
export function toRentalDto(rental: RentalWithRelations) {
  return {
    ...rental,
    startDate: formatDate(rental.startDate),
    endDate: formatDate(rental.endDate),
    days: calendarDays(rental.startDate, rental.endDate),
    total: rental.total.toFixed(2),
    items: rental.items.map(({ item, ...rentalItem }) => ({ ...rentalItem, item: toItemDto(item) })),
    charges: rental.charges.map((charge) => ({
      ...charge,
      dailyPrice: charge.dailyPrice.toFixed(2),
      amount: charge.amount.toFixed(2),
    })),
  };
}
