import { todayIso } from "@/lib/dates";
import type { Outing, TravelMode } from "@/lib/types";

/** Fase dell'uscita: ricavata dalle date (l'unico stato salvato è "annullata"). */
export type OutingPhase = "UPCOMING" | "ONGOING" | "PAST" | "CANCELLED";

export function outingPhase(outing: Pick<Outing, "status" | "startDate" | "endDate">): OutingPhase {
  if (outing.status === "CANCELLED") return "CANCELLED";
  const today = todayIso();
  if (today < outing.startDate) return "UPCOMING";
  if (today > outing.endDate) return "PAST";
  return "ONGOING";
}

export const OUTING_PHASE_LABELS: Record<OutingPhase, string> = {
  UPCOMING: "Programmata",
  ONGOING: "In corso",
  PAST: "Conclusa",
  CANCELLED: "Annullata",
};

export const OUTING_PHASE_CLASSES: Record<OutingPhase, string> = {
  UPCOMING: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ONGOING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  PAST: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

/** Passo 2 del wizard: le tre modalità, mutualmente esclusive. */
export const TRAVEL_MODES: { value: TravelMode; letter: string; label: string; short: string; description: string }[] = [
  {
    value: "VAN",
    letter: "A",
    label: "Sale sul furgone",
    short: "Furgone",
    description: "Viaggia a bordo del furgone: quota furgone + spese vive (carburante e caselli).",
  },
  {
    value: "TRANSPORT_ONLY",
    letter: "B",
    label: "Solo trasporto attrezzatura",
    short: "Solo trasporto",
    description: "Viaggia con mezzo proprio, ma fa caricare canoa/attrezzatura sul furgone.",
  },
  {
    value: "AUTONOMOUS",
    letter: "C",
    label: "Autonomo",
    short: "Autonomo",
    description: "Si sposta con mezzo proprio e trasporta da sé l'attrezzatura: nessun costo furgone.",
  },
];

export const TRAVEL_MODE_LABELS = Object.fromEntries(TRAVEL_MODES.map((m) => [m.value, m])) as Record<
  TravelMode,
  (typeof TRAVEL_MODES)[number]
>;
