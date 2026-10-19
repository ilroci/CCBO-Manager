import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { HttpError } from "../lib/http-error";
import { ROLE_LABELS } from "../lib/labels";
import { mailConfigured, sendMail } from "../lib/mailer";
import { authenticate } from "../middleware/auth";

export const suggestionsRouter = Router();
suggestionsRouter.use(authenticate);

/** Massimo invii per utente nella finestra, per evitare raffiche accidentali o abusi. */
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000;
const recentSends = new Map<string, number[]>();

function assertNotTooFrequent(userId: string) {
  const now = Date.now();
  const sends = (recentSends.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (sends.length >= MAX_PER_WINDOW) {
    throw new HttpError(429, "Hai inviato troppi messaggi nell'ultima ora: riprova più tardi");
  }
  recentSends.set(userId, [...sends, now]);
}

/** GET /api/suggestions/config → { enabled, recipient } */
suggestionsRouter.get("/config", (_req, res) => {
  res.json({ enabled: mailConfigured(), recipient: mailConfigured() ? env.mail.suggestionsTo : null });
});

const suggestionSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
});

/** POST /api/suggestions → 204. Invia il messaggio all'indirizzo SUGGESTIONS_TO. */
suggestionsRouter.post("/", async (req, res) => {
  if (!mailConfigured()) throw new HttpError(503, "L'invio dei consigli non è configurato");
  const { subject, message } = suggestionSchema.parse(req.body);
  const user = req.user!;
  assertNotTooFrequent(user.id);

  try {
    await sendMail({
      to: env.mail.suggestionsTo!,
      // Rispondendo all'email si scrive direttamente al socio.
      replyTo: { name: `${user.firstName} ${user.lastName}`, address: user.email },
      subject: `[Consigli] ${subject}`,
      text: [
        message,
        "",
        "—",
        `Inviato da ${user.firstName} ${user.lastName} (${ROLE_LABELS[user.role]}) <${user.email}>`,
        "tramite il gestionale Canoa Club.",
      ].join("\n"),
    });
  } catch (err) {
    // Non conta come invio: l'utente deve poter riprovare.
    recentSends.get(user.id)?.pop();
    console.error("Invio consiglio fallito:", err);
    throw new HttpError(502, "Invio non riuscito, riprova tra qualche minuto");
  }
  res.status(204).end();
});
