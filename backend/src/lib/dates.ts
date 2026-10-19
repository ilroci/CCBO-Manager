import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Data di calendario "YYYY-MM-DD". Nel DB è un campo `@db.Date`, che Prisma rappresenta
 * come Date a mezzanotte UTC: lavorando sempre in UTC non ci sono slittamenti di fuso.
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida (formato AAAA-MM-GG)")
  .refine((value) => formatDate(parseDate(value)) === value, "Data inesistente");

export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Oggi secondo l'ora italiana, non quella del server (Render gira in UTC). */
export function todayInItaly(): string {
  // en-CA formatta come YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

/** Giorni di calendario inclusivi: stesso giorno = 1, dal sabato alla domenica = 2. */
export function calendarDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}
