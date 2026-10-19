import { ItemStatus, RentalKind, RentalStatus, Role, type Prisma } from "@prisma/client";
import { Router, type Request } from "express";
import { z } from "zod";
import { calendarDays, dateSchema, parseDate, todayInItaly } from "../lib/dates";
import { itemInclude, toItemDto } from "../lib/equipment";
import { badRequest, HttpError, notFound } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import {
  findBusyItemIds,
  lockAndAssertAvailable,
  MAX_RENTAL_DAYS,
  quoteRental,
  rentalInclude,
  toRentalDto,
} from "../lib/rentals";
import { authenticate, authorize } from "../middleware/auth";

export const rentalsRouter = Router();

rentalsRouter.use(authenticate);

/** Amministratore e istruttori: vedono tutti i noleggi e registrano consegna e rientro. */
const STAFF: Role[] = [Role.ADMIN, Role.INSTRUCTOR];
const isStaff = (req: Request) => STAFF.includes(req.user!.role);

/** Intervallo di date valido per una prenotazione personale. */
const periodSchema = z
  .object({ start: dateSchema, end: dateSchema })
  .refine(({ start, end }) => end >= start, { message: "La data di fine precede l'inizio", path: ["end"] })
  .refine(({ start, end }) => calendarDays(parseDate(start), parseDate(end)) <= MAX_RENTAL_DAYS, {
    message: `Una prenotazione dura al massimo ${MAX_RENTAL_DAYS} giorni`,
    path: ["end"],
  });

const itemIdsSchema = z
  .array(z.string().min(1))
  .min(1, "Scegli almeno un pezzo")
  .max(20)
  .transform((ids) => [...new Set(ids)]);

/**
 * GET /api/rentals/availability?start=&end=&excludeRentalId= — pezzi non archiviati, con `available`
 * per l'intervallo richiesto. Base della pagina di prenotazione.
 */
rentalsRouter.get("/availability", async (req, res) => {
  const { start, end } = periodSchema.parse(req.query);
  // Modifica di un noleggio esistente (es. partecipante di un'uscita): i suoi pezzi restano selezionabili.
  const excludeRentalId = z.string().min(1).optional().parse(req.query.excludeRentalId);
  const [items, busy] = await Promise.all([
    prisma.equipmentItem.findMany({
      where: { isArchived: false },
      include: itemInclude,
      orderBy: [{ category: "asc" }, { brand: "asc" }, { model: "asc" }, { serialNumber: "asc" }],
    }),
    findBusyItemIds(prisma, undefined, parseDate(start), parseDate(end), excludeRentalId),
  ]);
  res.json({ items: items.map((item) => ({ ...toItemDto(item), available: !busy.has(item.id) })) });
});

/** POST /api/rentals/quote — anteprima del costo, senza salvare nulla. */
rentalsRouter.post("/quote", async (req, res) => {
  const { start, end } = periodSchema.parse(req.body);
  const itemIds = itemIdsSchema.parse(req.body.itemIds);
  const quote = await quoteRental(prisma, itemIds, parseDate(start), parseDate(end));
  res.json({
    days: quote.days,
    total: quote.total.toFixed(2),
    charges: quote.charges.map((charge) => ({
      ...charge,
      dailyPrice: charge.dailyPrice.toFixed(2),
      amount: charge.amount.toFixed(2),
    })),
  });
});

const createSchema = z.object({
  start: dateSchema,
  end: dateSchema,
  itemIds: itemIdsSchema,
  notes: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((value) => value || null),
});

/** POST /api/rentals — prenotazione autonoma del socio corrente. */
rentalsRouter.post("/", async (req, res) => {
  const { itemIds, notes, ...period } = createSchema.parse(req.body);
  const { start, end } = periodSchema.parse(period);
  if (start < todayInItaly()) throw badRequest("Non puoi prenotare per giorni già passati");

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  const rental = await prisma.$transaction(async (tx) => {
    await lockAndAssertAvailable(tx, itemIds, startDate, endDate);
    const quote = await quoteRental(tx, itemIds, startDate, endDate);

    return tx.rental.create({
      data: {
        kind: RentalKind.PERSONAL,
        memberId: req.user!.id,
        startDate,
        endDate,
        notes,
        total: quote.total,
        items: { create: itemIds.map((itemId) => ({ itemId })) },
        charges: { create: quote.charges },
      },
      include: rentalInclude,
    });
  });

  res.status(201).json({ rental: toRentalDto(rental) });
});

const listQuerySchema = z.object({
  /** `all` solo per lo staff; i soci vedono sempre e solo i propri. */
  scope: z.enum(["mine", "all"]).default("mine"),
  status: z.enum(RentalStatus).optional(),
});

/** GET /api/rentals — storico e prenotazioni, dal più recente. */
rentalsRouter.get("/", async (req, res) => {
  const { scope, status } = listQuerySchema.parse(req.query);
  const where: Prisma.RentalWhereInput = {
    status,
    memberId: scope === "all" && isStaff(req) ? undefined : req.user!.id,
  };
  const rentals = await prisma.rental.findMany({
    where,
    include: rentalInclude,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  res.json({ rentals: rentals.map(toRentalDto) });
});

const idParamsSchema = z.object({ id: z.string().min(1) });

/** Carica il noleggio verificando che l'utente possa vederlo (proprietario o staff). */
async function loadRental(req: Request) {
  const { id } = idParamsSchema.parse(req.params);
  const rental = await prisma.rental.findUnique({ where: { id }, include: rentalInclude });
  if (!rental) throw notFound();
  if (rental.memberId !== req.user!.id && !isStaff(req)) throw notFound();
  return rental;
}

rentalsRouter.get("/:id", async (req, res) => {
  res.json({ rental: toRentalDto(await loadRental(req)) });
});

/** Consegna, rientro e annullamento dei noleggi di un'uscita passano dall'uscita stessa. */
function assertPersonal(kind: RentalKind) {
  if (kind !== RentalKind.PERSONAL) throw badRequest("I noleggi di un'uscita si gestiscono dalla pagina dell'uscita");
}

function assertStatus(current: RentalStatus, expected: RentalStatus, action: string) {
  if (current !== expected) throw new HttpError(409, `Impossibile ${action}: il noleggio non è nello stato corretto`);
}

/** POST /api/rentals/:id/cancel — il socio annulla le proprie prenotazioni non ancora ritirate. */
rentalsRouter.post("/:id/cancel", async (req, res) => {
  const rental = await loadRental(req);
  assertPersonal(rental.kind);
  assertStatus(rental.status, RentalStatus.RESERVED, "annullare");

  const updated = await prisma.rental.update({
    where: { id: rental.id },
    data: { status: RentalStatus.CANCELLED },
    include: rentalInclude,
  });
  res.json({ rental: toRentalDto(updated) });
});

/** POST /api/rentals/:id/pickup — consegna del materiale: i pezzi passano "In noleggio". */
rentalsRouter.post("/:id/pickup", authorize(...STAFF), async (req, res) => {
  const rental = await loadRental(req);
  assertPersonal(rental.kind);
  assertStatus(rental.status, RentalStatus.RESERVED, "registrare la consegna");
  const itemIds = rental.items.map((row) => row.itemId);

  const updated = await prisma.$transaction(async (tx) => {
    const stillOut = await tx.equipmentItem.findMany({
      where: { id: { in: itemIds }, status: ItemStatus.RENTED },
      select: { serialNumber: true },
    });
    if (stillOut.length > 0) {
      throw new HttpError(
        409,
        `Pezzi non ancora rientrati da un altro noleggio: ${stillOut.map((i) => i.serialNumber).join(", ")}`,
      );
    }
    await tx.equipmentItem.updateMany({ where: { id: { in: itemIds } }, data: { status: ItemStatus.RENTED } });
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.ACTIVE },
      include: rentalInclude,
    });
  });
  res.json({ rental: toRentalDto(updated) });
});

/** POST /api/rentals/:id/return — rientro del materiale: i pezzi tornano "Disponibile". */
rentalsRouter.post("/:id/return", authorize(...STAFF), async (req, res) => {
  const rental = await loadRental(req);
  assertPersonal(rental.kind);
  assertStatus(rental.status, RentalStatus.ACTIVE, "registrare il rientro");
  const itemIds = rental.items.map((row) => row.itemId);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.equipmentItem.updateMany({ where: { id: { in: itemIds } }, data: { status: ItemStatus.AVAILABLE } });
    await tx.rentalItem.updateMany({ where: { rentalId: rental.id }, data: { returnedAt: new Date() } });
    return tx.rental.update({
      where: { id: rental.id },
      data: { status: RentalStatus.RETURNED },
      include: rentalInclude,
    });
  });
  res.json({ rental: toRentalDto(updated) });
});
