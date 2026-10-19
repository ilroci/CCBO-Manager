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
  | "WETSUIT";

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
