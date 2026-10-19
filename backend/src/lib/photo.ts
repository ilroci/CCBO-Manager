import { badRequest } from "./http-error";

/** Dimensione massima della foto decodificata. Il frontend la ridimensiona prima dell'invio. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Firme binarie dei formati ammessi: il tipo dichiarato nel data URL non basta. */
const SIGNATURES: { mimeType: string; matches: (buf: Buffer) => boolean }[] = [
  { mimeType: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mimeType: "image/png",
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: "image/webp",
    matches: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
];

/** Decodifica un data URL `data:image/...;base64,...` e verifica formato e dimensione. */
export function parsePhotoDataUrl(dataUrl: string): { data: Uint8Array<ArrayBuffer>; mimeType: string } {
  const match = /^data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw badRequest("Foto non valida");

  const data = Buffer.from(match[1]!, "base64");
  if (data.length > MAX_PHOTO_BYTES) throw badRequest("La foto supera i 2 MB");

  const format = SIGNATURES.find((signature) => signature.matches(data));
  if (!format) throw badRequest("Formato foto non supportato: usa JPEG, PNG o WebP");

  // Copia in un Uint8Array semplice: è il tipo che Prisma si aspetta per i campi Bytes.
  return { data: new Uint8Array(data), mimeType: format.mimeType };
}

/** URL pubblico della foto; `v` cambia a ogni sostituzione, così il browser può tenerla in cache. */
export function photoUrl(itemId: string, updatedAt: Date): string {
  return `/api/equipment/${itemId}/photo?v=${updatedAt.getTime()}`;
}
