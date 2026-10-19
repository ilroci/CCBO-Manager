import { EquipmentCategory, ItemStatus, Role, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { badRequest, HttpError, notFound } from "../lib/http-error";
import { parsePhotoDataUrl, photoUrl } from "../lib/photo";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";

export const equipmentRouter = Router();

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * GET /api/equipment/:id/photo — immagine del pezzo.
 * Pubblica: un tag <img> non può inviare l'header Authorization, e le foto
 * dell'attrezzatura non sono dati riservati. L'URL è versionato (`?v=`), quindi cache lunga.
 */
equipmentRouter.get("/:id/photo", async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const photo = await prisma.equipmentPhoto.findUnique({ where: { itemId: id } });
  if (!photo) throw notFound();

  res.set("Content-Type", photo.mimeType);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(photo.data));
});

equipmentRouter.use(authenticate);

/** Le query includono solo la data della foto, mai i byte. */
const itemInclude = { photo: { select: { updatedAt: true } } } satisfies Prisma.EquipmentItemInclude;

type ItemWithPhoto = Prisma.EquipmentItemGetPayload<{ include: typeof itemInclude }>;

/** Forma pubblica del pezzo: la foto diventa `photoUrl`. */
function toDto({ photo, ...item }: ItemWithPhoto) {
  return { ...item, photoUrl: photo ? photoUrl(item.id, photo.updatedAt) : null };
}

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
    include: itemInclude,
    orderBy: [{ category: "asc" }, { brand: "asc" }, { model: "asc" }, { serialNumber: "asc" }],
  });
  res.json({ items: items.map(toDto) });
});

equipmentRouter.get("/:id", async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const item = await prisma.equipmentItem.findUnique({ where: { id }, include: itemInclude });
  // I pezzi archiviati restano visibili solo all'amministratore.
  if (!item || (item.isArchived && req.user!.role !== Role.ADMIN)) throw notFound();
  res.json({ item: toDto(item) });
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
  description: optionalText,
  /** Data URL dell'immagine scelta dal PC (`data:image/webp;base64,...`). */
  photo: z.string().optional(),
});

/**
 * Lo stato (Disponibile / In Noleggio) non si modifica a mano: lo gestiranno
 * prenotazioni e uscite, per non disallinearlo dai noleggi attivi.
 * `photo`: data URL = sostituisci, `null` = rimuovi, assente = lascia invariata.
 */
const updateItemSchema = createItemSchema.partial().extend({
  photo: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
});

equipmentRouter.post("/", authorize(Role.ADMIN), async (req, res) => {
  const { photo, ...data } = createItemSchema.parse(req.body);
  const item = await prisma.equipmentItem.create({
    data: { ...data, photo: photo ? { create: parsePhotoDataUrl(photo) } : undefined },
    include: itemInclude,
  });
  res.status(201).json({ item: toDto(item) });
});

equipmentRouter.patch("/:id", authorize(Role.ADMIN), async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const { photo, ...data } = updateItemSchema.parse(req.body);

  if (data.isArchived) {
    const current = await prisma.equipmentItem.findUniqueOrThrow({ where: { id } });
    if (current.status === ItemStatus.RENTED) {
      throw badRequest("Non puoi archiviare un pezzo attualmente in noleggio");
    }
  }

  const newPhoto = photo ? parsePhotoDataUrl(photo) : undefined;

  const item = await prisma.$transaction(async (tx) => {
    if (photo === null) await tx.equipmentPhoto.deleteMany({ where: { itemId: id } });
    return tx.equipmentItem.update({
      where: { id },
      data: {
        ...data,
        photo: newPhoto ? { upsert: { create: newPhoto, update: newPhoto } } : undefined,
      },
      include: itemInclude,
    });
  });
  res.json({ item: toDto(item) });
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
