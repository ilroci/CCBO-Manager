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

export type RentalStatus = "RESERVED" | "ACTIVE" | "RETURNED" | "CANCELLED";

/** Pezzo del catalogo con la disponibilità per l'intervallo richiesto. */
export interface AvailableItem extends EquipmentItem {
  available: boolean;
}

export interface RentalCharge {
  id?: string;
  optionId: string | null;
  name: string;
  dailyPrice: string;
  days: number;
  amount: string;
}

export interface RentalQuote {
  days: number;
  total: string;
  charges: RentalCharge[];
}

export interface Rental {
  id: string;
  kind: "PERSONAL" | "OUTING";
  status: RentalStatus;
  member: Pick<User, "id" | "firstName" | "lastName" | "email">;
  /** "YYYY-MM-DD", ultimo giorno incluso */
  startDate: string;
  endDate: string;
  days: number;
  total: string;
  notes: string | null;
  items: { id: string; returnedAt: string | null; item: EquipmentItem }[];
  charges: RentalCharge[];
  createdAt: string;
}

export type OutingStatus = "ACTIVE" | "CANCELLED";
export type TravelMode = "VAN" | "TRANSPORT_ONLY" | "AUTONOMOUS";
/** Voci riscosse separatamente in un'uscita. */
export type CollectionCategory = "RENTAL" | "TRANSPORT" | "VAN";

export interface Collection {
  category: CollectionCategory;
  amount: string;
  /** Voce furgone: insieme alla quota si riscuotono i costi vivi, che non hanno importo. */
  includesExpenses: boolean;
  /** null = ancora da riscuotere */
  payment: { amount: string; paidAt: string; confirmedBy: Pick<User, "id" | "firstName" | "lastName" | "email"> | null } | null;
}

type Person = Pick<User, "id" | "firstName" | "lastName" | "email">;

export interface OutingParticipant {
  id: string;
  member: Person;
  travelMode: TravelMode;
  rentalAmount: string;
  transportAmount: string;
  vanSeatAmount: string;
  /** Noleggio + trasporto + quota furgone (costi vivi esclusi). */
  totalAmount: string;
  collections: Collection[];
  rental: {
    id: string;
    status: RentalStatus;
    total: string;
    items: { id: string; itemId: string; returnedAt: string | null; item: EquipmentItem }[];
    charges: RentalCharge[];
  } | null;
}

export interface Outing {
  id: string;
  title: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  days: number;
  status: OutingStatus;
  instructor: Person;
  vanSeats: number | null;
  notes: string | null;
  participants: OutingParticipant[];
  totals: {
    participants: number;
    aboardVan: number;
    toReturn: number;
    total: string;
    collected: string;
    pendingCollections: number;
    pendingExpenses: number;
  };
}

/** Tariffa fissa per uscita di un servizio furgone (oggi: solo trasporto attrezzatura). */
export interface ServiceFee {
  type: "EQUIPMENT_TRANSPORT" | "VAN_SEAT";
  amount: string;
  updatedAt: string;
}

/** Riepilogo della quota di un partecipante calcolato dal backend. */
export interface ParticipantQuote {
  days: number;
  charges: RentalCharge[];
  rentalAmount: string;
  transportAmount: string;
  vanSeatAmount: string;
  totalAmount: string;
}
