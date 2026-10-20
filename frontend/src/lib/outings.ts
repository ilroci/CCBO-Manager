import { todayIso } from "@/lib/dates";
import type { CollectionCategory, Outing, TravelMode } from "@/lib/types";

export const COLLECTION_LABELS: Record<CollectionCategory, string> = {
  RENTAL: "Noleggio attrezzatura",
  TRANSPORT: "Trasporto attrezzatura",
  VAN: "Furgone",
};

/** Fase dell'uscita: ricavata dalle date, non è uno stato salvato. */
export type OutingPhase = "UPCOMING" | "ONGOING" | "PAST";

export function outingPhase(outing: Pick<Outing, "startDate" | "endDate">): OutingPhase {
  const today = todayIso();
  if (today < outing.startDate) return "UPCOMING";
  if (today > outing.endDate) return "PAST";
  return "ONGOING";
}

export const OUTING_PHASE_LABELS: Record<OutingPhase, string> = {
  UPCOMING: "Programmata",
  ONGOING: "In corso",
  PAST: "Conclusa",
};

export const OUTING_PHASE_CLASSES: Record<OutingPhase, string> = {
  UPCOMING: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ONGOING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  PAST: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

/** Passo 2 del wizard: le tre modalità, mutualmente esclusive. */
export const TRAVEL_MODES: { value: TravelMode; letter: string; label: string; short: string; description: string }[] = [
  {
    value: "VAN",
    letter: "A",
    label: "Sale sul furgone",
    short: "Furgone",
    description: "Viaggia a bordo del furgone: quota furgone + costi vivi (carburante e caselli).",
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
