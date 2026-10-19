import type { EquipmentCategory, Role } from "@prisma/client";

/** Nomi italiani delle categorie, per i messaggi d'errore dell'API. */
export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  CANOE: "Canoe",
  PADDLE: "Pagaie",
  HELMET: "Caschi",
  WATER_JACKET: "Giacche d'acqua",
  SPRAY_DECK: "Paraspruzzi",
  WETSUIT: "Mute",
  LIFE_JACKET: "Salvagenti",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Amministratore",
  INSTRUCTOR: "Istruttore",
  MEMBER: "Socio",
};
