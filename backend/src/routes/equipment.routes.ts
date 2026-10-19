import { EquipmentCategory, ItemStatus, Role, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { badRequest, HttpError, notFound } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";

export const equipmentRouter = Router();

equipmentRouter.use(authenticate);

const listQuerySchema = z.object({
  category: z.enum(EquipmentCategory).optional(),
  status: z.enum(ItemStatus).optional(),
  q: z.string().trim().optional(),
  /** Solo admin: include anche i pezzi archiviati (dismessi). */
  includeArchived: z.enum(["true", "false"]).optional(),
});

/** GET /api/equipment — catalogo, consultabile da tutti i ruoli. */
equipmentRouter.get("/", async (req, res) => {
  const { category, status, q, includeArchived } = listQuerySchema.parse(req.query);
  const showArchived = includeArchived === "true" && req.user!.role === Role.ADMIN;

  const where: Prisma.EquipmentItemWhereInput = {
    category,
    status,
    isArchived: showArchived ? undefined : false,
    OR: q
      ? [
          { brand: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
          { serialNumber: { contains: q, mode: "insensitive" } },
          { size: { contains: q, mode: "insensitive" } },
        ]
      : undefined,
  };

  const items = await prisma.equipmentItem.findMany({
    where,
    orderBy: [{ category: "asc" }, { brand: "asc" }, { model: "asc" }, { serialNumber: "asc" }],
  });
  res.json({ items });
});

const idParamsSchema = z.object({ id: z.string().min(1) });

equipmentRouter.get("/:id", async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const item = await prisma.equipmentItem.findUnique({ where: { id } });
  // I pezzi archiviati restano visibili solo all'amministratore.
  if (!item || (item.isArchived && req.user!.role !== Role.ADMIN)) throw notFound();
  res.json({ item });
});

/** Testo opzionale: stringa vuota → null, così il form può "svuotare" un campo. */
const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

const createItemSchema = z.object({
  category: z.enum(EquipmentCategory),
  brand: z.string().trim().min(1),
  model: z.string().trim().min(1),
  size: optionalText,
  serialNumber: z.string().trim().min(1),
  photoUrl: optionalText.pipe(z.url({ protocol: /^https?$/ }).nullable()),
  description: optionalText,
});

/**
 * Lo stato (Disponibile / In Noleggio) non si modifica a mano: lo gestiranno
 * prenotazioni e uscite, per non disallinearlo dai noleggi attivi.
 */
const updateItemSchema = createItemSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

equipmentRouter.post("/", authorize(Role.ADMIN), async (req, res) => {
  const data = createItemSchema.parse(req.body);
  const item = await prisma.equipmentItem.create({ data });
  res.status(201).json({ item });
});

equipmentRouter.patch("/:id", authorize(Role.ADMIN), async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const data = updateItemSchema.parse(req.body);

  if (data.isArchived) {
    const current = await prisma.equipmentItem.findUniqueOrThrow({ where: { id } });
    if (current.status === ItemStatus.RENTED) {
      throw badRequest("Non puoi archiviare un pezzo attualmente in noleggio");
    }
  }

  const item = await prisma.equipmentItem.update({ where: { id }, data });
  res.json({ item });
});

/**
 * DELETE /api/equipment/:id — eliminazione definitiva, ammessa solo per pezzi mai noleggiati
 * (es. inseriti per errore). Per i dismessi si usa l'archiviazione, che conserva lo storico.
 */
equipmentRouter.delete("/:id", authorize(Role.ADMIN), async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const rentals = await prisma.rentalItem.count({ where: { itemId: id } });
  if (rentals > 0) {
    throw new HttpError(409, "Il pezzo ha uno storico noleggi: archivialo invece di eliminarlo");
  }
  await prisma.equipmentItem.delete({ where: { id } });
  res.status(204).end();
});
