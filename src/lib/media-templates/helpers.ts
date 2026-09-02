const W = 1280;
const H = 720;

export const PALETTE = {
  cream: '#F4EFE6',
  ivory: '#FAF7F1',
  forest: '#24382C',
  pine: '#3A5644',
  walnut: '#5C3A21',
  brass: '#C4A35A',
  ochre: '#B8843A',
  ink: '#1A1612',
  paper: '#E8DFD0',
} as const;

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, max)
    .map((s) => s.trim());
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asBoolean(value: unknown): boolean {
  return value === true;
}

export function svgDoc(body: string, bg: string = PALETTE.cream): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
}

export function header(title: string, subtitle?: string, y = 64): string {
  const sub = subtitle
    ? `<text x="64" y="${y + 36}" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.walnut}">${esc(subtitle)}</text>`
    : '';
  return `<text x="64" y="${y}" font-family="Georgia, serif" font-size="34" fill="${PALETTE.forest}" font-weight="600">${esc(title)}</text>${sub}`;
}

export function clampLines(lines: string[], min: number, max: number): string[] {
  const out = lines.slice(0, max);
  while (out.length < min) out.push('...');
  return out;
}

export { W, H };
