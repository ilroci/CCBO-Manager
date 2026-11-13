import { CollectionCategory, RentalStatus, Role, TravelMode, type Prisma } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { calendarDays, dateSchema, formatDate, parseDate, todayInItaly } from "../lib/dates";
import { badRequest, HttpError, notFound } from "../lib/http-error";
import {
  assertVanSeats,
  chargedDaysOf,
  outingInclude,
  quoteParticipant,
  SERVICE_CATEGORY,
  syncParticipant,
  toOutingDto,
} from "../lib/outings";
import { prisma } from "../lib/prisma";
import { MAX_RENTAL_DAYS } from "../lib/rentals";
import { authenticate, authorize } from "../middleware/auth";

/**
 * Uscite di club. Le gestiscono amministratore e istruttori: qualunque istruttore può
 * operare su qualunque uscita, così un collega può subentrare.
 *
 * Un'uscita resta sempre modificabile (dati, date, partecipanti) finché non viene annullata.
 * Le voci di ogni socio (noleggio, trasporto, furgone + costi vivi) si riscuotono separatamente:
 * una voce riscossa non può cambiare finché la riscossione non viene annullata.
 */
export const outingsRouter = Router();

const STAFF: Role[] = [Role.ADMIN, Role.INSTRUCTOR];

outingsRouter.use(authenticate, authorize(...STAFF));

type LoadedOuting = Awaited<ReturnType<typeof loadOuting>>;

async function loadOuting(id: string) {
  const outing = await prisma.outing.findUnique({ where: { id }, include: outingInclude });
  if (!outing) throw notFound("Uscita non trovata");
  return outing;
}

async function respond(res: Response, id: string, status = 200) {
  res.status(status).json({ outing: toOutingDto(await loadOuting(id)) });
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

const listQuerySchema = z.object({ when: z.enum(["upcoming", "past", "all"]).default("all") });

/**
 * GET /api/outings?when=upcoming|past|all — prossime e in corso in ordine di data, passate dalla
 * più recente; con `all` prima le prossime, poi le passate.
 */
outingsRouter.get("/", async (req, res) => {
  const { when } = listQuerySchema.parse(req.query);
  const today = parseDate(todayInItaly());
  const [upcoming, past] = await Promise.all([
    when === "past"
      ? []
      : prisma.outing.findMany({
          where: { endDate: { gte: today } },
          include: outingInclude,
          orderBy: { startDate: "asc" },
          take: 200,
        }),
    when === "upcoming"
      ? []
      : prisma.outing.findMany({
          where: { endDate: { lt: today } },
          include: outingInclude,
          orderBy: { startDate: "desc" },
          take: 200,
        }),
  ]);
  const outings = [...upcoming, ...past];
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
 * PATCH /api/outings/:id — dati dell'uscita. Cambiare le date sposta i noleggi dei
 * partecipanti: disponibilità e quote vengono ricalcolate.
 */
outingsRouter.patch("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { start, end, instructorId, ...data } = outingSchema.partial().parse(req.body);
  const outing = await loadOuting(id);
  if (instructorId) await assertInstructor(instructorId);

  const newStart = start ?? formatDate(outing.startDate);
  const newEnd = end ?? formatDate(outing.endDate);
  const datesChanged = newStart !== formatDate(outing.startDate) || newEnd !== formatDate(outing.endDate);

  if (datesChanged) {
    assertPeriod(newStart, newEnd);
    // I giorni cambiano solo il prezzo del noleggio: quota furgone e trasporto sono per uscita.
    if (outing.participants.some((p) => p.payments.some((pay) => pay.category === CollectionCategory.RENTAL))) {
      throw new HttpError(409, "Ci sono noleggi già riscossi: annulla la riscossione prima di cambiare le date");
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
        await syncParticipant(tx, updated, p, { datesChanged: true });
      }
    }
  });
  await respond(res, id);
});

/**
 * DELETE /api/outings/:id — annulla l'uscita eliminando tutto: partecipanti, riscossioni e
 * noleggi (cascade), quindi l'attrezzatura torna subito prenotabile.
 */
outingsRouter.delete("/:id", async (req, res) => {
  const { id } = idParams.parse(req.params);
  await loadOuting(id);
  await prisma.outing.delete({ where: { id } });
  res.status(204).end();
});

/**
 * Segna come rientrato (o di nuovo fuori) il materiale dei noleggi indicati.
 * I noleggi delle uscite non passano dallo stato "Ritirato": l'attrezzatura è impegnata
 * nei giorni dell'uscita e il rientro è una spunta dell'istruttore.
 */
async function setReturned(tx: Prisma.TransactionClient, rentalIds: string[], returned: boolean) {
  const from = returned ? RentalStatus.RESERVED : RentalStatus.RETURNED;
  const to = returned ? RentalStatus.RETURNED : RentalStatus.RESERVED;
  const targets = await tx.rental.findMany({ where: { id: { in: rentalIds }, status: from }, select: { id: true } });
  const ids = targets.map((r) => r.id);
  await tx.rentalItem.updateMany({ where: { rentalId: { in: ids } }, data: { returnedAt: returned ? new Date() : null } });
  await tx.rental.updateMany({ where: { id: { in: ids } }, data: { status: to } });
}

/** POST /api/outings/:id/return-all — tutto il materiale dell'uscita è rientrato. */
outingsRouter.post("/:id/return-all", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const outing = await loadOuting(id);
  await prisma.$transaction((tx) =>
    setReturned(tx, outing.participants.flatMap((p) => (p.rental?.items.length ? [p.rental.id] : [])), true),
  );
  await respond(res, id);
});

// ---------------------------------------------------------------------------
// Partecipanti (wizard dell'istruttore)
// ---------------------------------------------------------------------------

/** Elenco di id senza doppioni. */
const idList = z
  .array(z.string().min(1))
  .max(20)
  .transform((ids) => [...new Set(ids)]);

/** Ospite: partecipante non in anagrafica, senza account. */
const guestSchema = z.object({
  firstName: z.string().trim().min(1, "Indica il nome").max(100),
  lastName: z.string().trim().min(1, "Indica il cognome").max(100),
  phone: optionalText.pipe(z.string().max(30).nullable()),
});

const participantSchema = z.object({
  /** Socio in anagrafica; in alternativa `guest`. */
  memberId: z.string().min(1).optional(),
  /** Ospite non in anagrafica; in alternativa `memberId`. */
  guest: guestSchema.optional(),
  /** Passo 1, vista rapida — voci di listino noleggiate (Pacchetto Kayak, Giacca, Muta); vuoto = nessun noleggio. */
  optionIds: idList.default([]),
  /** Passo 1, dettaglio facoltativo — pezzi specifici assegnati, nelle categorie delle voci scelte. */
  itemIds: idList.default([]),
  /** Passo 1 — giorni di noleggio per chi partecipa solo a una parte dell'uscita; null = tutta l'uscita. */
  rentalDays: z.number().int().min(1).max(MAX_RENTAL_DAYS).nullish(),
  /** Passo 2 — A) furgone, B) solo trasporto attrezzatura, C) autonomo: una sola scelta. */
  travelMode: z.enum(TravelMode),
});

const quoteSchema = participantSchema.omit({ memberId: true, guest: true });

function assertRentalDays(outing: LoadedOuting, days: number | null | undefined) {
  const outingDays = calendarDays(outing.startDate, outing.endDate);
  if (days != null && days > outingDays) {
    throw badRequest(`I giorni di noleggio non possono superare quelli dell'uscita (${outingDays})`);
  }
}

/** POST /api/outings/:id/quote — riepilogo del wizard: quota individuale senza salvare. */
outingsRouter.post("/:id/quote", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { optionIds, itemIds, rentalDays, travelMode } = quoteSchema.parse(req.body);
  const outing = await loadOuting(id);
  assertRentalDays(outing, rentalDays);
  const quote = await quoteParticipant(prisma, outing, { optionIds, itemIds, days: rentalDays }, travelMode);
  res.json({
    days: chargedDaysOf(rentalDays ?? null, calendarDays(outing.startDate, outing.endDate)),
    charges: (quote.rental?.charges ?? []).map((c) => ({
      ...c,
      dailyPrice: c.dailyPrice.toFixed(2),
      amount: c.amount.toFixed(2),
    })),
    rentalAmount: quote.rentalAmount.toFixed(2),
    transportAmount: quote.transportAmount.toFixed(2),
    vanSeatAmount: quote.vanSeatAmount.toFixed(2),
    totalAmount: quote.totalAmount.toFixed(2),
  });
});

/**
 * POST /api/outings/:id/participants — aggiunge un socio in anagrafica (`memberId`) oppure un
 * ospite non in anagrafica (`guest`: nome, cognome, telefono facoltativo), con noleggio e
 * modalità di viaggio. L'ospite non diventa un utente: esiste solo dentro l'uscita.
 */
outingsRouter.post("/:id/participants", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { memberId, guest, optionIds, itemIds, rentalDays, travelMode } = participantSchema.parse(req.body);
  if (Boolean(memberId) === Boolean(guest)) throw badRequest("Indica un socio oppure i dati di un ospite");
  const outing = await loadOuting(id);
  assertRentalDays(outing, rentalDays);

  if (memberId) {
    const member = await prisma.user.findUnique({ where: { id: memberId } });
    if (!member || !member.isActive) throw badRequest("Socio non trovato o disattivato");
    if (outing.participants.some((p) => p.memberId === memberId)) {
      throw new HttpError(409, `${member.firstName} ${member.lastName} partecipa già a questa uscita`);
    }
  }
  const person = memberId
    ? { memberId }
    : { guestFirstName: guest!.firstName, guestLastName: guest!.lastName, guestPhone: guest!.phone };

  await prisma.$transaction(async (tx) => {
    const participant = await tx.outingParticipant.create({ data: { outingId: id, ...person, travelMode } });
    await assertVanSeats(tx, id, outing.vanSeats);
    await syncParticipant(tx, outing, participant, { spec: { optionIds, itemIds, days: rentalDays ?? null } });
  });
  await respond(res, id, 201);
});

/**
 * Modifica: ogni campo è facoltativo e un campo assente resta invariato. Le liste sono
 * ridefinite senza il default `[]` di participantSchema: con il default, un PATCH che cambia
 * solo la modalità di viaggio cancellerebbe il noleggio.
 */
const updateParticipantSchema = z.object({
  optionIds: idList.optional(),
  itemIds: idList.optional(),
  rentalDays: z.number().int().min(1).max(MAX_RENTAL_DAYS).nullish(),
  travelMode: z.enum(TravelMode).optional(),
  /** Solo per gli ospiti: correzione di nome, cognome e telefono. */
  guest: guestSchema.optional(),
});

/** Chi ha pagato spese del furgone deve restare a bordo, altrimenti i conti non tornano. */
const hasExpenses = (outing: LoadedOuting, pid: string) => outing.expenses.some((e) => e.payerId === pid);

function findParticipant(outing: LoadedOuting, pid: string) {
  const participant = outing.participants.find((p) => p.id === pid);
  if (!participant) throw notFound("Partecipante non trovato");
  return participant;
}

outingsRouter.patch("/:id/participants/:pid", async (req, res) => {
  const { id, pid } = participantParams.parse(req.params);
  const { optionIds, itemIds, rentalDays, travelMode, guest } = updateParticipantSchema.parse(req.body);
  const outing = await loadOuting(id);
  const participant = findParticipant(outing, pid);
  if (guest && participant.memberId) throw badRequest("I dati anagrafici di un socio si modificano da Utenti");
  assertRentalDays(outing, rentalDays);
  const outingDays = calendarDays(outing.startDate, outing.endDate);

  const paid = new Set(participant.payments.map((pay) => pay.category));
  const currentOptions = participant.rental?.charges.map((c) => c.optionId ?? "") ?? [];
  const currentItems = participant.rental?.items.map((row) => row.itemId) ?? [];
  const optionsChanged =
    optionIds !== undefined &&
    (optionIds.length !== currentOptions.length || optionIds.some((o) => !currentOptions.includes(o)));
  const daysChanged =
    rentalDays !== undefined &&
    participant.rental !== null &&
    chargedDaysOf(rentalDays, outingDays) !== chargedDaysOf(participant.rental.chargedDays, outingDays);
  const modeChanged = travelMode !== undefined && travelMode !== participant.travelMode;

  // Una voce riscossa non cambia: prima si annulla la riscossione. Il materiale specifico
  // invece si può cambiare anche a noleggio riscosso, perché non incide sul prezzo.
  if (optionsChanged && paid.has(CollectionCategory.RENTAL)) {
    throw new HttpError(409, "Noleggio già riscosso: annulla la riscossione prima di cambiare le voci noleggiate");
  }
  if (daysChanged && paid.has(CollectionCategory.RENTAL)) {
    throw new HttpError(409, "Noleggio già riscosso: annulla la riscossione prima di cambiare i giorni di noleggio");
  }
  if (modeChanged && hasExpenses(outing, pid)) {
    throw new HttpError(
      409,
      "Ha pagato spese del furgone: eliminale o assegnale a un altro partecipante prima di cambiare la modalità di viaggio",
    );
  }
  const currentService = SERVICE_CATEGORY[participant.travelMode];
  if (modeChanged && currentService && paid.has(currentService)) {
    throw new HttpError(
      409,
      currentService === CollectionCategory.VAN
        ? "Quota furgone già riscossa: annulla la riscossione prima di cambiare la modalità di viaggio"
        : "Trasporto già riscosso: annulla la riscossione prima di cambiare la modalità di viaggio",
    );
  }

  await prisma.$transaction(async (tx) => {
    if (guest) {
      await tx.outingParticipant.update({
        where: { id: pid },
        data: { guestFirstName: guest.firstName, guestLastName: guest.lastName, guestPhone: guest.phone },
      });
    }
    if (modeChanged) {
      await tx.outingParticipant.update({ where: { id: pid }, data: { travelMode } });
      await assertVanSeats(tx, id, outing.vanSeats);
    }
    const rentalTouched = optionIds !== undefined || itemIds !== undefined || rentalDays !== undefined;
    await syncParticipant(
      tx,
      outing,
      { id: pid, memberId: participant.memberId, travelMode: travelMode ?? participant.travelMode },
      rentalTouched
        ? { spec: { optionIds: optionIds ?? currentOptions, itemIds: itemIds ?? currentItems, days: rentalDays } }
        : {},
    );
  });
  await respond(res, id);
});

outingsRouter.delete("/:id/participants/:pid", async (req, res) => {
  const { id, pid } = participantParams.parse(req.params);
  const outing = await loadOuting(id);
  findParticipant(outing, pid);
  if (hasExpenses(outing, pid)) {
    throw new HttpError(409, "Ha pagato spese del furgone: eliminale o assegnale a un altro partecipante prima di rimuoverlo");
  }
  // Noleggio e riscossioni del socio vengono eliminati in cascata.
  await prisma.outingParticipant.delete({ where: { id: pid } });
  await respond(res, id);
});

/** POST /api/outings/:id/participants/:pid/return { returned } — rientro del materiale del socio (annullabile). */
outingsRouter.post("/:id/participants/:pid/return", async (req, res) => {
  const { id, pid } = participantParams.parse(req.params);
  const { returned } = z.object({ returned: z.boolean().default(true) }).parse(req.body ?? {});
  const outing = await loadOuting(id);
  const participant = findParticipant(outing, pid);
  if (!participant.rental?.items.length) throw badRequest("Al socio non è assegnato materiale specifico");

  await prisma.$transaction((tx) => setReturned(tx, [participant.rental!.id], returned));
  await respond(res, id);
});

const paymentParams = participantParams.extend({ category: z.enum(CollectionCategory) });

/**
 * POST /api/outings/:id/participants/:pid/payments/:category { paid } — riscuote (o annulla
 * la riscossione di) una singola voce: RENTAL noleggio, TRANSPORT trasporto attrezzatura,
 * VAN quota furgone insieme ai costi vivi.
 */
outingsRouter.post("/:id/participants/:pid/payments/:category", async (req, res) => {
  const { id, pid, category } = paymentParams.parse(req.params);
  const { paid } = z.object({ paid: z.boolean() }).parse(req.body);
  const outing = await loadOuting(id);
  const participant = findParticipant(outing, pid);

  if (!paid) {
    await prisma.outingPayment.deleteMany({ where: { participantId: pid, category } });
    await respond(res, id);
    return;
  }

  const amount =
    category === CollectionCategory.RENTAL
      ? participant.rental && participant.rentalAmount
      : category === CollectionCategory.TRANSPORT
        ? participant.travelMode === TravelMode.TRANSPORT_ONLY && participant.transportAmount
        : participant.travelMode === TravelMode.VAN && participant.vanSeatAmount;
  if (!amount) throw badRequest("Questa voce non riguarda il socio");
  if (participant.payments.some((pay) => pay.category === category)) {
    throw new HttpError(409, "Voce già riscossa");
  }

  await prisma.outingPayment.create({
    data: { participantId: pid, category, amount, confirmedById: req.user!.id },
  });
  await respond(res, id);
});

// ---------------------------------------------------------------------------
// Conti del furgone: spese anticipate da chi è a bordo, divise tra tutti i partecipanti a bordo
// ---------------------------------------------------------------------------

const amountSchema = z
  .union([z.number(), z.string()])
  .transform((value) => String(value).trim().replace(",", "."))
  .pipe(
    z
      .string()
      .regex(/^\d{1,6}(\.\d{1,2})?$/, "Importo non valido (es. 45 oppure 12,50)")
      .refine((value) => Number(value) > 0, "L'importo deve essere maggiore di zero"),
  );

const expenseSchema = z.object({
  /** Partecipante a bordo del furgone che ha pagato */
  payerId: z.string().min(1),
  amount: amountSchema,
  description: z.string().trim().min(1, "Indica a cosa si riferisce la spesa").max(200),
});

const expenseParams = idParams.extend({ eid: z.string().min(1) });

function assertPayerAboard(outing: LoadedOuting, payerId: string) {
  const payer = outing.participants.find((p) => p.id === payerId);
  if (!payer) throw badRequest("Chi ha pagato non partecipa all'uscita");
  if (payer.travelMode !== TravelMode.VAN) throw badRequest("Le spese del furgone le paga solo chi è a bordo");
}

function findExpense(outing: LoadedOuting, eid: string) {
  const expense = outing.expenses.find((e) => e.id === eid);
  if (!expense) throw notFound("Spesa non trovata");
  return expense;
}

/** POST /api/outings/:id/expenses { payerId, amount, description } */
outingsRouter.post("/:id/expenses", async (req, res) => {
  const { id } = idParams.parse(req.params);
  const data = expenseSchema.parse(req.body);
  const outing = await loadOuting(id);
  assertPayerAboard(outing, data.payerId);
  await prisma.outingExpense.create({ data: { ...data, outingId: id, createdById: req.user!.id } });
  await respond(res, id, 201);
});

/** PATCH /api/outings/:id/expenses/:eid — corregge chi ha pagato, importo o descrizione. */
outingsRouter.patch("/:id/expenses/:eid", async (req, res) => {
  const { id, eid } = expenseParams.parse(req.params);
  const data = expenseSchema.partial().parse(req.body);
  const outing = await loadOuting(id);
  findExpense(outing, eid);
  if (data.payerId) assertPayerAboard(outing, data.payerId);
  await prisma.outingExpense.update({ where: { id: eid }, data });
  await respond(res, id);
});

outingsRouter.delete("/:id/expenses/:eid", async (req, res) => {
  const { id, eid } = expenseParams.parse(req.params);
  findExpense(await loadOuting(id), eid);
  await prisma.outingExpense.delete({ where: { id: eid } });
  await respond(res, id);
});
