import sharp from "sharp";
import { PUBLIC_DERIVATIVE_TYPE, type MaskRect } from "../../../lib/portfolio/rules";

export { PUBLIC_DERIVATIVE_TYPE };

type PixelRect = { left: number; top: number; width: number; height: number };

function pixelRect(width: number, height: number, mask: MaskRect): PixelRect {
  const left = Math.min(width - 1, Math.max(0, Math.floor(mask.x * width)));
  const top = Math.min(height - 1, Math.max(0, Math.floor(mask.y * height)));
  const right = Math.min(width, Math.max(left + 1, Math.ceil((mask.x + mask.w) * width)));
  const bottom = Math.min(height, Math.max(top + 1, Math.ceil((mask.y + mask.h) * height)));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Publiczna pochodna. Oryginał nie jest ruszany.
 * Maskowanie zmniejsza obszar do 2×2 pikseli i rozciąga go z powrotem — znaków tablicy nie da się odtworzyć.
 * To nie jest odwracalne rozmycie. Odwracalna jest decyzja: oryginał zostaje prywatny, pochodną można skasować.
 * Metadane (EXIF, GPS, opis) nie przechodzą do JPEG.
 */
export async function renderPublicDerivative(original: Buffer, options: { plateVisible: boolean; mask?: MaskRect | null }) {
  let oriented: Buffer;
  try {
    oriented = await sharp(original, { failOn: "error" }).rotate().toBuffer();
  } catch {
    throw new Error("unreadable");
  }
  const meta = await sharp(oriented).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 2 || height < 2) throw new Error("unreadable");

  if (options.plateVisible) return sharp(oriented).jpeg({ quality: 85 }).toBuffer();
  if (!options.mask) throw new Error("mask required");

  const rect = pixelRect(width, height, options.mask);
  const small = await sharp(oriented).extract(rect).resize(2, 2, { fit: "fill" }).png().toBuffer();
  const redacted = await sharp(small).resize(rect.width, rect.height, { kernel: "nearest" }).png().toBuffer();
  return sharp(oriented).composite([{ input: redacted, left: rect.left, top: rect.top }]).jpeg({ quality: 85 }).toBuffer();
}
