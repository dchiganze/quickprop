import Jimp from "jimp-compact";
import { getPrivateObjectDownloadUrl } from "../routes/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const cache = new Map<string, { expires: number; colors: Promise<string[]> }>();

/** Ignore white/transparent margins and rank chromatic logo pixels. */
export function dominantLogoColors(rgba: Uint8Array): string[] {
  const buckets = new Map<string, { weight: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const [r, g, b, a] = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (a < 192 || max < 40 || max - min < 30 || min > 225) continue;
    const weight = ((max - min) / Math.max(max, 1)) * (a / 255);
    const key = [r, g, b].map(value => Math.floor(value / 32)).join(":");
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
    bucket.weight += weight;
    bucket.r += r * weight; bucket.g += g * weight; bucket.b += b * weight;
    buckets.set(key, bucket);
  }
  const chosen: number[][] = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.weight - a.weight)) {
    const rgb = [bucket.r, bucket.g, bucket.b].map(value => Math.round(value / bucket.weight));
    if (chosen.some(previous => previous.reduce((sum, value, i) => sum + (value - rgb[i]) ** 2, 0) < 3600)) continue;
    chosen.push(rgb);
    if (chosen.length === 3) break;
  }
  return chosen.map(rgb => `#${rgb.map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`);
}

async function loadPalette(logoUrl: string): Promise<string[]> {
  // Only our configured storage objects; never fetch arbitrary remote URLs
  // supplied in branding fields from the server network.
  const path = new URL(logoUrl, "https://branding.invalid").pathname
    .match(/(\/objects\/uploads\/\d+\/[a-f0-9-]+\.(?:png|jpe?g))$/i)?.[1];
  if (!path) return [];
  const url = await getPrivateObjectDownloadUrl(path);
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok || !response.body) return [];
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); return []; }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const image = await Jimp.read(Buffer.concat(chunks));
  image.resize(64, 64);
  return dominantLogoColors(image.bitmap.data);
}

export function getAgencyLogoColors(logoUrl: string | null): Promise<string[]> {
  if (!logoUrl) return Promise.resolve([]);
  const hit = cache.get(logoUrl);
  if (hit && hit.expires > Date.now()) return hit.colors;
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<string[]>(resolve => { timeout = setTimeout(() => resolve([]), 6_000); });
  const colors = Promise.race([loadPalette(logoUrl), deadline])
    .catch(() => [] as string[])
    .then(result => {
      clearTimeout(timeout);
      const entry = cache.get(logoUrl);
      if (entry) entry.expires = Date.now() + (result.length ? 15 * 60_000 : 60_000);
      return result;
    });
  cache.set(logoUrl, { colors, expires: Date.now() + 15 * 60_000 });
  return colors;
}
