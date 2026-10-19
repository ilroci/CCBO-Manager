import type { Prisma } from "@prisma/client";
import { photoUrl } from "./photo";

/** Le query sui pezzi includono solo la data della foto, mai i byte. */
export const itemInclude = { photo: { select: { updatedAt: true } } } satisfies Prisma.EquipmentItemInclude;

export type ItemWithPhoto = Prisma.EquipmentItemGetPayload<{ include: typeof itemInclude }>;

/** Forma pubblica del pezzo: la foto diventa `photoUrl`. */
export function toItemDto({ photo, ...item }: ItemWithPhoto) {
  return { ...item, photoUrl: photo ? photoUrl(item.id, photo.updatedAt) : null };
}
