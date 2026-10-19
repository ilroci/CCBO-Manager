/** Tipi condivisi con le risposte del backend (rispecchiano `publicUserSelect` lato API). */

export type Role = "ADMIN" | "INSTRUCTOR" | "MEMBER";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EquipmentCategory =
  | "CANOE"
  | "PADDLE"
  | "HELMET"
  | "WATER_JACKET"
  | "SPRAY_DECK"
  | "WETSUIT"
  | "LIFE_JACKET";

export type ItemStatus = "AVAILABLE" | "RENTED";

export interface EquipmentItem {
  id: string;
  category: EquipmentCategory;
  brand: string;
  model: string;
  size: string | null;
  serialNumber: string;
  photoUrl: string | null;
  description: string | null;
  status: ItemStatus;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Voce del listino noleggi, a prezzo giornaliero. */
export interface RentalOption {
  id: string;
  name: string;
  description: string | null;
  categories: EquipmentCategory[];
  /** Importo con due decimali, es. "15.00" */
  dailyPrice: string;
  sortOrder: number;
  updatedAt: string;
}
