import { EquipmentCategory, Role, ServiceType, type RentalOption, type ServiceFee } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/http-error";
import { CATEGORY_LABELS } from "../lib/labels";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";

/** Listino noleggi: voci a prezzo giornaliero (es. "Pacchetto Kayak" 15 €/giorno). */
export const priceListRouter = Router();

priceListRouter.use(authenticate);

/** Prezzo con due decimali come stringa ("15.00"), per non perdere precisione in JSON. */
function toDto(option: RentalOption) {
  return { ...option, dailyPrice: option.dailyPrice.toFixed(2) };
}

function toFeeDto(fee: ServiceFee) {
  return { type: fee.type, amount: fee.amount.toFixed(2), updatedAt: fee.updatedAt };
}

/** GET /api/price-list — voci di noleggio e tariffe dei servizi delle uscite, visibili a tutti. */
priceListRouter.get("/", async (_req, res) => {
  const [options, serviceFees] = await Promise.all([
    prisma.rentalOption.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.serviceFee.findMany({ orderBy: { type: "asc" } }),
  ]);
  res.json({ options: options.map(toDto), serviceFees: serviceFees.map(toFeeDto) });
});

/** Accetta 15, "15", "12,50", "12.5". */
const priceSchema = z
  .union([z.number(), z.string()])
  .transform((value) => String(value).trim().replace(",", "."))
  .pipe(z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, "Prezzo non valido (es. 15 oppure 12,50)"));

const optionSchema = z.object({
  name: z.string().trim().min(1),
  description: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null),
  categories: z
    .array(z.enum(EquipmentCategory))
    .min(1, "Indica almeno una categoria")
    .transform((list) => [...new Set(list)]),
  dailyPrice: priceSchema,
});

/**
 * Una categoria può stare in una sola voce: altrimenti lo stesso pezzo
 * verrebbe addebitato due volte.
 */
async function assertCategoriesFree(categories: EquipmentCategory[], excludeId?: string) {
  const others = await prisma.rentalOption.findMany({
    where: { id: excludeId ? { not: excludeId } : undefined, categories: { hasSome: categories } },
  });
  for (const other of others) {
    const shared = other.categories.filter((category) => categories.includes(category));
    if (shared.length > 0) {
      const names = shared.map((category) => CATEGORY_LABELS[category]).join(", ");
      throw new HttpError(409, `${names}: già compres${shared.length > 1 ? "e" : "a"} nella voce "${other.name}"`);
    }
  }
}

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * PUT /api/price-list/service-fees/:type — tariffa fissa per uscita di un servizio furgone.
 * Le quote già calcolate dei partecipanti non cambiano (ne conservano una copia).
 */
priceListRouter.put("/service-fees/:type", authorize(Role.ADMIN), async (req, res) => {
  const { type } = z.object({ type: z.enum(ServiceType) }).parse(req.params);
  const { amount } = z.object({ amount: priceSchema }).parse(req.body);
  const fee = await prisma.serviceFee.upsert({
    where: { type },
    create: { type, amount, updatedById: req.user!.id },
    update: { amount, updatedById: req.user!.id },
  });
  res.json({ serviceFee: toFeeDto(fee) });
});

priceListRouter.post("/", authorize(Role.ADMIN), async (req, res) => {
  const data = optionSchema.parse(req.body);
  await assertCategoriesFree(data.categories);

  const last = await prisma.rentalOption.aggregate({ _max: { sortOrder: true } });
  const option = await prisma.rentalOption.create({
    data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1, updatedById: req.user!.id },
  });
  res.status(201).json({ option: toDto(option) });
});

priceListRouter.patch("/:id", authorize(Role.ADMIN), async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const data = optionSchema.partial().parse(req.body);
  if (data.categories) await assertCategoriesFree(data.categories, id);

  const option = await prisma.rentalOption.update({
    where: { id },
    data: { ...data, updatedById: req.user!.id },
  });
  res.json({ option: toDto(option) });
});

/** I noleggi già calcolati conservano nome e prezzo della voce (RentalCharge). */
priceListRouter.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  await prisma.rentalOption.delete({ where: { id } });
  res.status(204).end();
});
