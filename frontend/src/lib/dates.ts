/** Date di calendario "YYYY-MM-DD", come le usa l'API dei noleggi. */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Oggi secondo l'orologio del dispositivo. */
export function todayIso(): string {
  return toIso(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

const longFormat = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** "sab 6 giu 2026" */
export function formatDay(iso: string): string {
  return longFormat.format(fromIso(iso));
}

/** "sab 6 giu 2026" oppure "sab 6 giu 2026 → dom 7 giu 2026". */
export function formatPeriod(start: string, end: string): string {
  if (start === end) return formatDay(start);
  return `${formatDay(start)} → ${formatDay(end)}`;
}
