import nodemailer, { type Transporter } from "nodemailer";
import type { Address } from "nodemailer/lib/mailer";
import { env } from "../config/env";

let transporter: Transporter | undefined;

export function mailConfigured(): boolean {
  return Boolean(env.mail.host && env.mail.from && env.mail.suggestionsTo);
}

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    // Valori predefiniti di minuti: l'utente resterebbe ad aspettare la risposta del form.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

export async function sendMail(message: { to: string; replyTo?: Address; subject: string; text: string }) {
  await getTransporter().sendMail({ from: env.mail.from, ...message });
}
