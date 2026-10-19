/** Lato lungo massimo della foto salvata: basta per schede e anteprime, e resta leggera nel DB. */
const MAX_SIDE = 1600;
const QUALITY = 0.85;
/** Allineato al limite del backend (2 MB decodificati). */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Ridimensiona e comprime un'immagine scelta dal PC e la restituisce come data URL.
 * Usa WebP, oppure JPEG se il browser non sa codificare WebP. Applica l'orientamento EXIF,
 * così le foto scattate col telefono non risultano ruotate.
 */
export async function prepareImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Il file scelto non è un'immagine");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Formato immagine non supportato dal browser (usa JPEG, PNG o WebP)");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossibile elaborare l'immagine");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let dataUrl = canvas.toDataURL("image/webp", QUALITY);
  if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", QUALITY);

  // Lunghezza base64 → byte reali (circa 3/4).
  if ((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75 > MAX_BYTES) {
    throw new Error("Immagine troppo grande anche dopo la compressione");
  }
  return dataUrl;
}
