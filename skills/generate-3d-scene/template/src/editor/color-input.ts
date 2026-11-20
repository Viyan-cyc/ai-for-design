/** Editor input conversions in sRGB; persisted values remain six-digit HEX. */
export function normalizeHex(value: string): string | null {
  return /^#?[\da-f]{6}$/i.test(value.trim()) ? `#${value.trim().replace(/^#/, '').toLowerCase()}` : null;
}
const byte = (n: number): string => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
export function hexToHsv(hex: string): [number, number, number] | null {
  const value = normalizeHex(hex);
  if (!value) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max === 0 ? 0 : d / max * 100, max * 100];
}
export function hsvToHex(h: number, s: number, v: number): string | null {
  if (![h, s, v].every(Number.isFinite) || h < 0 || h > 360 || s < 0 || s > 100 || v < 0 || v > 100) return null;
  const c = v / 100 * s / 100, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v / 100 - c;
  const rgb = h < 60 || h === 360 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${rgb.map(n => byte((n + m) * 255)).join('')}`;
}
/** Approximate temperature-to-sRGB fit, not a physical spectrum or inverse CCT. */
export function kelvinToHex(k: number): string | null {
  if (!Number.isFinite(k) || k < 1000 || k > 40000) return null;
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return `#${[r, g, b].map(byte).join('')}`;
}
