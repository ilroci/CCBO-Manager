import type { RentalStatus } from "@/lib/types";

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  RESERVED: "Prenotato",
  ACTIVE: "Ritirato",
  RETURNED: "Rientrato",
  CANCELLED: "Annullato",
};

export const RENTAL_STATUS_CLASSES: Record<RentalStatus, string> = {
  RESERVED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ACTIVE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  RETURNED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

/** Massimo di giorni di una prenotazione personale (uguale al backend). */
export const MAX_RENTAL_DAYS = 30;
