import sharp from "sharp";
import { expect, it } from "vitest";
import { assertDerivativeKey, derivativeKey, isPublicSlug, maskError } from "../../../lib/portfolio/rules";
import { renderPublicDerivative } from "./mask";

async function pattern() {
  const width = 64;
  const height = 64;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (x < 32) {
        const on = Math.floor(x / 8) % 2 === Math.floor(y / 8) % 2;
        raw[i] = raw[i + 1] = raw[i + 2] = on ? 255 : 0;
      } else {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 255;
      }
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function stats(bytes: Buffer) {
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const half = Math.floor(info.width / 2);
  const left: number[] = [];
  const rightBlue: number[] = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (x < half) left.push(data[i] ?? 0);
      else rightBlue.push(data[i + 2] ?? 0);
    }
  }
  const mean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const variance = left.reduce((sum, value) => sum + (value - mean) ** 2, 0) / left.length;
  return { leftStd: Math.sqrt(variance), rightBlue: rightBlue.reduce((sum, value) => sum + value, 0) / rightBlue.length };
}

const mask = { x: 0, y: 0, w: 0.5, h: 1 };

it("destroys plate detail in the masked region and leaves the rest of the frame", async () => {
  const original = await pattern();
  const visible = await renderPublicDerivative(original, { plateVisible: true });
  const hidden = await renderPublicDerivative(original, { plateVisible: false, mask });
  expect((await stats(visible)).leftStd).toBeGreaterThan(40);
  const masked = await stats(hidden);
  expect(masked.leftStd).toBeLessThan(12);
  expect(masked.rightBlue).toBeGreaterThan(200);
  expect(hidden.equals(original)).toBe(false);
  expect(hidden.subarray(0, 2).toString("hex")).toBe("ffd8");
});

it("strips embedded plate text and refuses a file that is not an image", async () => {
  const described = await sharp(await pattern()).withMetadata({ exif: { IFD0: { ImageDescription: "SECRET-PLATE-WX99999" } } }).jpeg().toBuffer();
  expect(described.toString("latin1")).toContain("SECRET-PLATE-WX99999");
  const pub = await renderPublicDerivative(described, { plateVisible: true });
  expect(pub.toString("latin1")).not.toContain("SECRET-PLATE");
  expect(pub.toString("latin1")).not.toContain("WX99999");
  await expect(renderPublicDerivative(Buffer.from("not-an-image"), { plateVisible: true })).rejects.toThrow();
});

it("rejects a speck instead of a plate and refuses to delete an original key", () => {
  expect(maskError({ x: 0.1, y: 0.1, w: 0.01, h: 0.2 })).toMatch(/większy obszar/);
  expect(maskError(mask)).toBeNull();
  expect(isPublicSlug("obsidian-studio")).toBe(true);
  expect(isPublicSlug("../etc")).toBe(false);
  const key = derivativeKey("studio", "a".repeat(16), 2, "b".repeat(32));
  expect(key).toBe(`studios/studio/portfolio/${"a".repeat(16)}/v2-${"b".repeat(32)}.jpg`);
  expect(() => assertDerivativeKey("studio", "studios/studio/orders/order/photo.jpg")).toThrow(/pochodn/);
  expect(() => derivativeKey("studio/evil", "a".repeat(16), 1, "b".repeat(32))).toThrow(/klucz/);
});
