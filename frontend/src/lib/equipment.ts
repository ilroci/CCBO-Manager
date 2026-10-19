import type { EquipmentCategory, ItemStatus } from "@/lib/types";

/** Ordine di visualizzazione e nomi delle categorie. */
export const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: "CANOE", label: "Canoe" },
  { value: "PADDLE", label: "Pagaie" },
  { value: "HELMET", label: "Caschi" },
  { value: "WATER_JACKET", label: "Giacche d'acqua" },
  { value: "SPRAY_DECK", label: "Paraspruzzi" },
  { value: "WETSUIT", label: "Mute" },
];

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map(({ value, label }) => [value, label]),
) as Record<EquipmentCategory, string>;

export const STATUS_LABELS: Record<ItemStatus, string> = {
  AVAILABLE: "Disponibile",
  RENTED: "In noleggio",
};
