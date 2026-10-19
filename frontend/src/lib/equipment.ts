import type { EquipmentCategory, ItemStatus } from "@/lib/types";

/** Ordine di visualizzazione e nomi delle categorie (prima quelle del Pacchetto Kayak). */
export const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: "CANOE", label: "Canoe" },
  { value: "PADDLE", label: "Pagaie" },
  { value: "SPRAY_DECK", label: "Paraspruzzi" },
  { value: "LIFE_JACKET", label: "Salvagenti" },
  { value: "HELMET", label: "Caschi" },
  { value: "WATER_JACKET", label: "Giacche d'acqua" },
  { value: "WETSUIT", label: "Mute" },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map(({ value, label }) => [value, label]),
) as Record<EquipmentCategory, string>;

export const STATUS_LABELS: Record<ItemStatus, string> = {
  AVAILABLE: "Disponibile",
  RENTED: "In noleggio",
};
