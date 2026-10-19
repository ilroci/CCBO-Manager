import { Prisma, type EquipmentCategory } from "@prisma/client";

export interface PriceOption {
  id: string;
  name: string;
  dailyPrice: Prisma.Decimal;
  categories: EquipmentCategory[];
}

export interface Charge {
  optionId: string;
  name: string;
  dailyPrice: Prisma.Decimal;
  days: number;
  amount: Prisma.Decimal;
}

/**
 * Applica il listino: si paga ogni voce di cui il noleggio contiene almeno un pezzo,
 * una sola volta, moltiplicata per i giorni. Le categorie che non stanno in nessuna voce
 * (oggi: nessuna) non costano nulla.
 *
 * Es. Pacchetto Kayak 15 €: kayak + pagaia + casco per 2 giorni = 30 €;
 * solo una pagaia per 1 giorno = 15 € (la voce si paga intera).
 */
export function computeCharges(
  categories: EquipmentCategory[],
  options: PriceOption[],
  days: number,
): { charges: Charge[]; total: Prisma.Decimal } {
  const present = new Set(categories);
  const charges = options
    .filter((option) => option.categories.some((category) => present.has(category)))
    .map((option) => ({
      optionId: option.id,
      name: option.name,
      dailyPrice: option.dailyPrice,
      days,
      amount: option.dailyPrice.mul(days),
    }));

  const total = charges.reduce((sum, charge) => sum.add(charge.amount), new Prisma.Decimal(0));
  return { charges, total };
}
