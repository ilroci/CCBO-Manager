import {
  ItemStatus,
  OutingStatus,
  PaymentStatus,
  RentalStatus,
  Role,
  TravelMode,
  type Prisma,
} from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { calendarDays, dateSchema, formatDate, parseDate, todayInItaly } from "../lib/dates";
import { badRequest, HttpError, notFound } from "../lib/http-error";
import { assertVanSeats, outingInclude, quoteParticipant, syncParticipant, toOutingDto } from "../lib/outings";
import { prisma } from "../lib/prisma";
import { MAX_RENTAL_DAYS } from "../lib/rentals";
import { authenticate, authorize } from "../middleware/auth";

/**
 * Uscite di club. Le gestiscono amministratore e istruttori: qualunque istruttore può
 * operare su qualunque uscita, così un collega può subentrare.
 */
export const outingsRouter = Router();

const STAFF: Role[] = [Role.ADMIN, Role.INSTRUCTOR];

outingsRouter.use(authenticate, authorize(...STAFF));

const STATUS_LABELS: Record<OutingStatus, string> = {
  PLANNED: "pianificata",
  ONGOING: "in corso",
  COMPLETED: "conclusa",
  CANCELLED: "annullata",
};

async function loadOuting(id: string) {
  const outing = await prisma.outing.findUnique({ where: { id }, include: outingInclude });
  if (!outing) throw notFound("Uscita non trovata");
  return outing;
}

async function respond(res: Response, id: string, status = 200) {
  res.status(status).json({ outing: toOutingDto(await loadOuting(id)) });
}

function assertStatus(current: OutingStatus, allowed: OutingStatus[], action: string) {
  if (!allowed.includes(current)) {
    throw new HttpError(409, `Non puoi ${action}: l'uscita è ${STATUS_LABELS[current]}`);
  }
}

const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

const outingSchema = z.object({
  title: z.string().trim().min(1),
  destination: optionalText,
  start: dateSchema,
  end: dateSchema,
  /** Responsabile dell'uscita; se assente, chi la crea. */
  instructorId: z.string().min(1).optional(),
  vanSeats: z.number().int().min(1).max(50).nullish(),
  notes: optionalText,
});

function assertPeriod(start: string, end: string) {
  if (end < start) throw badRequest("La data di fine precede l'inizio");
  if (calendarDays(parseDate(start), parseDate(end)) > MAX_RENTAL_DAYS) {
    throw badRequest(`Un'uscita dura al massimo ${MAX_RENTAL_DAYS} giorni`);
  }
}

async function assertInstructor(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive || !STAFF.includes(user.role)) {
    throw badRequest("Il responsabile deve essere un istruttore o un amministratore attivo");
  }
}

const listQuerySchema = z.object({ when: z.enum(["upcoming", "past", "all"]).default("upcoming") });

/** GET /api/outings?when=upcoming|past|all — prossime in ordine di data, passate dalla più recente. */
outingsRouter.get("/", async (req, res) => {
  const { when } = listQuerySchema.parse(req.query);
  const today = parseDate(todayInItaly());
  const where: Prisma.OutingWhereInput =
    when === "upcoming" ? { endDate: { gte: today } } : when === "past" ? { endDate: { lt: today } } : {};
  const outings = await prisma.outing.findMany({
    where,
    include: outingInclude,
    orderBy: { startDate: when === "upcoming" ? "asc" : "desc" },
    take: 200,
  });
  res.json({ outings: outings.map(toOutingDto) });
});

outingsRouter.post("/", async (req, res) => {
  const { start, end, instructorId, ...data } = outingSchema.parse(req.body);
  assertPeriod(start, end);
  const responsible = instructorId ?? req.user!.id;
  await assertInstructor(responsible);

  const outing = await prisma.outing.create({
    data: { ...data, startDate: parseDate(start), endDate: parseDate(end), instructorId: responsible },
  });
  await respond(res, outing.id, 201);
});

const idParams = z.object({ id: z.string().min(1) });
const participantParams = idParams.extend({ pid: z.string().min(1) });

outingsRouter.get("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  await respond(res, id);
});

/**
 * PATCH /api/outings/:id — dati dell'uscita. Cambiare le date (solo se pianificata) sposta
 * i noleggi dei partecipanti: disponibilità e quote vengono ricalcolate.
 */
outingsRouter.patch("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { start, end, instructorId, ...data } = outingSchema.partial().parse(req.body);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.PLANNED, OutingStatus.ONGOING], "modificarla");
  if (instructorId) await assertInstructor(instructorId);

  const newStart = start ?? formatDate(outing.startDate);
  const newEnd = end ?? formatDate(outing.endDate);
  const datesChanged = newStart !== formatDate(outing.startDate) || newEnd !== formatDate(outing.endDate);

  if (datesChanged) {
    assertStatus(outing.status, [OutingStatus.PLANNED], "cambiarne le date");
    assertPeriod(newStart, newEnd);
    if (outing.participants.some((p) => p.paymentStatus === PaymentStatus.PAID)) {
      throw new HttpError(409, "Ci sono incassi confermati: annullali prima di cambiare le date");
    }
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.outing.update({
      where: { id },
      data: { ...data, instructorId, startDate: parseDate(newStart), endDate: parseDate(newEnd) },
    });
    if (data.vanSeats !== undefined) await assertVanSeats(tx, id, updated.vanSeats);
    if (datesChanged) {
      for (const p of outing.participants) {
        if (!p.rental) continue;
        await syncParticipant(
          tx,
          updated,
          { id: p.id, memberId: p.memberId, rentalId: p.rental.id, travelMode: p.travelMode },
          p.rental.items.map((row) => row.itemId),
        );
      }
    }
  });
  await respond(res, id);
});

/** DELETE /api/outings/:id — solo uscite senza partecipanti (altrimenti si annulla). */
outingsRouter.delete("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const outing = await loadOuting(id);
  if (outing.participants.length > 0) {
    throw new HttpError(409, "L'uscita ha partecipanti: annullala invece di eliminarla");
  }
  await prisma.outing.delete({ where: { id } });
  res.status(204).end();
});

/** POST /api/outings/:id/start — partenza: consegna di tutto il materiale noleggiato. */
outingsRouter.post("/:id/start", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.PLANNED], "farla partire");

  const rentalIds = outing.participants.flatMap((p) => (p.rental ? [p.rental.id] : []));
  const itemIds = outing.participants.flatMap((p) => p.rental?.items.map((row) => row.itemId) ?? []);

  await prisma.$transaction(async (tx) => {
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
    await tx.rental.updateMany({ where: { id: { in: rentalIds } }, data: { status: RentalStatus.ACTIVE } });
    await tx.outing.update({ where: { id }, data: { status: OutingStatus.ONGOING } });
  });
  await respond(res, id);
});

/** Registra il rientro dei noleggi indicati (ancora attivi): pezzi di nuovo disponibili. */
async function returnRentals(tx: Prisma.TransactionClient, rentalIds: string[]) {
  const rows = await tx.rentalItem.findMany({
    where: { rentalId: { in: rentalIds }, rental: { status: RentalStatus.ACTIVE } },
    select: { itemId: true, rentalId: true },
  });
  const active = [...new Set(rows.map((row) => row.rentalId))];
  await tx.equipmentItem.updateMany({
    where: { id: { in: rows.map((row) => row.itemId) } },
    data: { status: ItemStatus.AVAILABLE },
  });
  await tx.rentalItem.updateMany({ where: { rentalId: { in: active } }, data: { returnedAt: new Date() } });
  await tx.rental.updateMany({ where: { id: { in: active } }, data: { status: RentalStatus.RETURNED } });
}

/** POST /api/outings/:id/complete — chiusura: rientro di tutto il materiale ancora fuori. */
outingsRouter.post("/:id/complete", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.ONGOING], "chiuderla");

  await prisma.$transaction(async (tx) => {
    await returnRentals(tx, outing.participants.flatMap((p) => (p.rental ? [p.rental.id] : [])));
    await tx.outing.update({ where: { id }, data: { status: OutingStatus.COMPLETED } });
  });
  await respond(res, id);
});

/** POST /api/outings/:id/cancel — annulla un'uscita pianificata e libera l'attrezzatura. */
outingsRouter.post("/:id/cancel", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.PLANNED], "annullarla");

  await prisma.$transaction([
    prisma.rental.updateMany({
      where: { participant: { outingId: id } },
      data: { status: RentalStatus.CANCELLED },
    }),
    prisma.outing.update({ where: { id }, data: { status: OutingStatus.CANCELLED } }),
  ]);
  await respond(res, id);
});

// ---------------------------------------------------------------------------
// Partecipanti (wizard dell'istruttore)
// ---------------------------------------------------------------------------

const itemIdsSchema = z
  .array(z.string().min(1))
  .max(20)
  .default([])
  .transform((ids) => [...new Set(ids)]);

const participantSchema = z.object({
  memberId: z.string().min(1),
  /** Passo 1 — pezzi da noleggiare; vuoto = nessun noleggio. */
  itemIds: itemIdsSchema,
  /** Passo 2 — A) furgone, B) solo trasporto attrezzatura, C) autonomo: una sola scelta. */
  travelMode: z.enum(TravelMode),
});

const quoteSchema = participantSchema.omit({ memberId: true });

/** POST /api/outings/:id/quote — riepilogo del wizard: quota individuale senza salvare. */
outingsRouter.post("/:id/quote", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { itemIds, travelMode } = quoteSchema.parse(req.body);
  const outing = await loadOuting(id);
  const quote = await quoteParticipant(prisma, outing, itemIds, travelMode);
  res.json({
    days: calendarDays(outing.startDate, outing.endDate),
    charges: (quote.rental?.charges ?? []).map((c) => ({
      ...c,
      dailyPrice: c.dailyPrice.toFixed(2),
      amount: c.amount.toFixed(2),
    })),
    rentalAmount: quote.rentalAmount.toFixed(2),
    transportAmount: quote.transportAmount.toFixed(2),
    vanSeatAmount: quote.vanSeatAmount.toFixed(2),
    expensesShare: quote.expensesShare.toFixed(2),
    totalAmount: quote.totalAmount.toFixed(2),
  });
});

/** POST /api/outings/:id/participants — aggiunge un socio con noleggio e modalità di viaggio. */
outingsRouter.post("/:id/participants", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { memberId, itemIds, travelMode } = participantSchema.parse(req.body);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.PLANNED], "aggiungere partecipanti");

  const member = await prisma.user.findUnique({ where: { id: memberId } });
  if (!member || !member.isActive) throw badRequest("Socio non trovato o disattivato");
  if (outing.participants.some((p) => p.memberId === memberId)) {
    throw new HttpError(409, `${member.firstName} ${member.lastName} partecipa già a questa uscita`);
  }

  await prisma.$transaction(async (tx) => {
    const participant = await tx.outingParticipant.create({ data: { outingId: id, memberId, travelMode } });
    await assertVanSeats(tx, id, outing.vanSeats);
    await syncParticipant(tx, outing, { id: participant.id, memberId, rentalId: null, travelMode }, itemIds);
  });
  await respond(res, id, 201);
});

/**
 * Modifica: ogni campo è facoltativo e un campo assente resta invariato. `itemIds` viene
 * ridefinito senza il default `[]` di participantSchema: con il default, un PATCH che cambia
 * solo la modalità di viaggio cancellerebbe il noleggio.
 */
const updateParticipantSchema = z.object({
  itemIds: z
    .array(z.string().min(1))
    .max(20)
    .transform((ids) => [...new Set(ids)])
    .optional(),
  travelMode: z.enum(TravelMode).optional(),
});

/** Il socio ha già pagato: la quota non può cambiare finché l'incasso non viene annullato. */
function assertNotPaid(p: { paymentStatus: PaymentStatus }) {
  if (p.paymentStatus === PaymentStatus.PAID) {
    throw new HttpError(409, "Incasso già confermato: annullalo prima di modificare il partecipante");
  }
}

function findParticipant(outing: Awaited<ReturnType<typeof loadOuting>>, pid: string) {
  const participant = outing.participants.find((p) => p.id === pid);
  if (!participant) throw notFound("Partecipante non trovato");
  return participant;
}

outingsRouter.patch("/:id/participants/:pid", async (req, res) => {
  const { id, pid } = participantParams.parse(req.params);
  const { itemIds, travelMode } = updateParticipantSchema.parse(req.body);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.PLANNED], "modificare i partecipanti");
  const participant = findParticipant(outing, pid);
  assertNotPaid(participant);

  await prisma.$transaction(async (tx) => {
    if (travelMode) {
      await tx.outingParticipant.update({ where: { id: pid }, data: { travelMode } });
      await assertVanSeats(tx, id, outing.vanSeats);
    }
    // La quota dipende sia dai pezzi sia dalla modalità di viaggio: si ricalcola sempre.
    await syncParticipant(
      tx,
      outing,
      {
        id: pid,
        memberId: participant.memberId,
        rentalId: participant.rental?.id ?? null,
        travelMode: travelMode ?? participant.travelMode,
      },
      itemIds ?? participant.rental?.items.map((row) => row.itemId) ?? [],
    );
  });
  await respond(res, id);
});

outingsRouter.delete("/:id/participants/:pid", async (req, res) => {
  const { id, pid } = participantParams.parse(req.params);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.PLANNED], "rimuovere partecipanti");
  assertNotPaid(findParticipant(outing, pid));
  // Il noleggio collegato viene eliminato in cascata.
  await prisma.outingParticipant.delete({ where: { id: pid } });
  await respond(res, id);
});

/** POST /api/outings/:id/participants/:pid/return — rientro del materiale di un singolo socio. */
outingsRouter.post("/:id/participants/:pid/return", async (req, res) => {
  const { id, pid } = participantParams.parse(req.params);
  const outing = await loadOuting(id);
  assertStatus(outing.status, [OutingStatus.ONGOING], "registrare rientri");
  const participant = findParticipant(outing, pid);
  if (participant.rental?.status !== RentalStatus.ACTIVE) throw badRequest("Nessun materiale da far rientrare");

  await prisma.$transaction((tx) => returnRentals(tx, [participant.rental!.id]));
  await respond(res, id);
});

/** POST /api/outings/:id/participants/:pid/payment { paid } — conferma (o annulla) l'incasso. */
outingsRouter.post("/:id/participants/:pid/payment", async (req, res) => {
  const { id, pid } = participantParams.parse(req.params);
  const { paid } = z.object({ paid: z.boolean() }).parse(req.body);
  const outing = await loadOuting(id);
  assertStatus(
    outing.status,
    [OutingStatus.PLANNED, OutingStatus.ONGOING, OutingStatus.COMPLETED],
    "registrare incassi",
  );
  findParticipant(outing, pid);

  await prisma.outingParticipant.update({
    where: { id: pid },
    data: paid
      ? { paymentStatus: PaymentStatus.PAID, paidAt: new Date(), paidConfirmedById: req.user!.id }
      : { paymentStatus: PaymentStatus.PENDING, paidAt: null, paidConfirmedById: null },
  });
  await respond(res, id);
});
