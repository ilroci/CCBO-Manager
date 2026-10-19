import {
  CalendarCheck,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Amministratore",
  INSTRUCTOR: "Istruttore",
  MEMBER: "Socio",
};

export const ALL_ROLES: Role[] = ["ADMIN", "INSTRUCTOR", "MEMBER"];

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Ruoli che vedono la voce e possono aprire la pagina. L'API applica comunque i suoi controlli. */
  roles: Role[];
}

/** Unica fonte per menu, rotte e card della dashboard. */
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    description: "Panoramica",
    icon: LayoutDashboard,
    roles: ALL_ROLES,
  },
  {
    to: "/catalog",
    label: "Catalogo",
    description: "Attrezzatura del club e disponibilità",
    icon: Package,
    roles: ALL_ROLES,
  },
  {
    to: "/my-rentals",
    label: "I miei noleggi",
    description: "Prenotazioni personali e storico",
    icon: History,
    roles: ALL_ROLES,
  },
  {
    to: "/outings",
    label: "Uscite",
    description: "Uscite di club, partecipanti, rientri e incassi",
    icon: CalendarCheck,
    roles: ["ADMIN", "INSTRUCTOR"],
  },
  {
    to: "/users",
    label: "Utenti",
    description: "Soci, istruttori e amministratori",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    to: "/price-list",
    label: "Listino prezzi",
    description: "Prezzi giornalieri di noleggio",
    icon: Receipt,
    roles: ["ADMIN"],
  },
];

export function canAccess(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccess(role, item.roles));
}
