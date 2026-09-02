/** Lectern compressed restore wire magic (shared with restore-codec). */
export const LECTERN_RESTORE_MAGIC = 'LCT1';
export const LECTERN_RESTORE_ATTACH = 'lectern-restore.lct1';
export const LECTERN_PDF_BEGIN = '%%LECTERN_PDF/v1/BEGIN%%';
export const LECTERN_PDF_END = '%%LECTERN_PDF/v1/END%%';
export const LECTERN_PDF_PART = '%%LECTERN_PDF/v1/PART';
export const LECTERN_PDF_PART_END = '%%LECTERN_PDF/v1/PART_END%%';

/** Dense invisible payload packing (Courier 6pt on A4, ~24pt margins). */
export const PDF_DENSE_LINE_WIDTH = 152;
export const PDF_DENSE_PART_CHAR_BUDGET = 18_000;

/** Legacy sparse export (import-only; no longer written). */
export const PDF_PART_CHAR_BUDGET = 3000;
export const PDF_LINE_WIDTH = 72;

/** Hard cap for embedded restore payload (~20 MB). */
export const MAX_RESTORE_PAYLOAD_BYTES = 20 * 1024 * 1024;

/** Soft warning threshold (~8 MB). */
export const WARN_RESTORE_PAYLOAD_BYTES = 8 * 1024 * 1024;

export interface PdfRestoreMeta {
  v: 1;
  id: string;
  title: string;
  parts: number;
  bytes: number;
  magic: typeof LECTERN_RESTORE_MAGIC;
  /** Characters per payload part (dense packing). */
  partChars?: number;
  /** Courier line width when writing parts. */
  lineWidth?: number;
  /** Embedded PDF file name when parts is 0. */
  attach?: string;
}

export interface PdfRestorePack {
  meta: PdfRestoreMeta;
  parts: string[];
}

const PART_HEADER_RE =
  /%%LECTERN_PDF\/v1\/PART\/(\d+)\/(\d+)%%/g;

/** Words pdf.js may mix in from watermarks / headers / footers — never payload lines. */
const CHROME_TOKENS = new Set([
  'LECTERN',
  'Lectern',
  'lectern',
  'click',
  'TECHNICAL',
  'RESTORE',
  'APPENDIX',
  'SYSTEM',
  'System',
  'system',
  'PAGE',
  'Page',
  'page',
  'pages',
  'content',
  'lesson',
  'Embedded',
  'payload',
  'Upload',
  'PDF',
]);

function pageCharBudget(meta: PdfRestoreMeta): number {
  return meta.partChars ?? PDF_DENSE_PART_CHAR_BUDGET;
}

function lineWidthForMeta(meta: PdfRestoreMeta): number {
  return meta.lineWidth ?? PDF_DENSE_LINE_WIDTH;
}

export function splitPayloadForPdfPages(
  payload: string,
  lessonId: string,
  title: string,
  pageCharBudget = PDF_DENSE_PART_CHAR_BUDGET,
  lineWidth = PDF_DENSE_LINE_WIDTH,
): PdfRestorePack {
  if (payload.length > MAX_RESTORE_PAYLOAD_BYTES) {
    throw new Error(
      `Lesson restore data is too large (${Math.round(payload.length / 1024 / 1024)} MB). ` +
        'Use Download .lectern or remove some media before exporting PDF.',
    );
  }
  const parts: string[] = [];
  const n = Math.max(1, Math.ceil(payload.length / pageCharBudget));
  for (let i = 0; i < n; i += 1) {
    parts.push(payload.slice(i * pageCharBudget, (i + 1) * pageCharBudget));
  }
  return {
    meta: {
      v: 1,
      id: lessonId,
      title,
      parts: n,
      bytes: payload.length,
      magic: LECTERN_RESTORE_MAGIC,
      partChars: pageCharBudget,
      lineWidth,
    },
    parts,
  };
}

export function wrapPartLines(chunk: string, lineWidth = PDF_DENSE_LINE_WIDTH): string[] {
  const lines: string[] = [];
  for (let i = 0; i < chunk.length; i += lineWidth) {
    lines.push(chunk.slice(i, i + lineWidth));
  }
  return lines;
}

export function formatPdfSystemIntro(meta: PdfRestoreMeta): string[] {
  const metaJson = JSON.stringify({
    v: meta.v,
    magic: meta.magic,
    parts: meta.parts,
    bytes: meta.bytes,
    attach: meta.attach,
    partChars: meta.partChars ?? PDF_DENSE_PART_CHAR_BUDGET,
    lineWidth: meta.lineWidth ?? PDF_DENSE_LINE_WIDTH,
    id: meta.id,
    title: meta.title,
  });
  return [
    LECTERN_PDF_BEGIN,
    'meta:',
    ...wrapPartLines(metaJson, meta.lineWidth ?? PDF_DENSE_LINE_WIDTH),
    '',
    'Lectern restore data — upload this PDF in Save & load lesson.',
  ];
}

export function formatPdfSystemPart(
  index: number,
  total: number,
  chunk: string,
  isLast: boolean,
  lineWidth = PDF_DENSE_LINE_WIDTH,
): string[] {
  const lines = [
    `${LECTERN_PDF_PART}/${index}/${total}%%`,
    ...wrapPartLines(chunk, lineWidth),
    LECTERN_PDF_PART_END,
  ];
  if (isLast) lines.push(LECTERN_PDF_END);
  return lines;
}

/** Collapse pdf.js spaces inserted inside protocol markers. */
export function normalizeProtocolMarkers(text: string): string {
  return text
    .replace(/%%\s*LECTERN_PDF\s*\/\s*v1\s*\/\s*PART_END\s*%%/g, LECTERN_PDF_PART_END)
    .replace(/%%\s*LECTERN_PDF\s*\/\s*v1\s*\/\s*BEGIN\s*%%/g, LECTERN_PDF_BEGIN)
    .replace(/%%\s*LECTERN_PDF\s*\/\s*v1\s*\/\s*END\s*%%/g, LECTERN_PDF_END)
    .replace(
      /%%\s*LECTERN_PDF\s*\/\s*v1\s*\/\s*PART\s*\/\s*(\d+)\s*\/\s*(\d+)\s*%%/g,
      `${LECTERN_PDF_PART}/$1/$2%%`,
    );
}

export function pdfTextHasRestoreBegin(text: string): boolean {
  if (text.includes(LECTERN_PDF_BEGIN)) return true;
  return text.replace(/\s+/g, '').includes(LECTERN_PDF_BEGIN);
}

function sliceMatchingBraces(source: string, openIndex: number): string | null {
  if (openIndex < 0 || source[openIndex] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return null;
}

function parseMetaFromText(text: string): PdfRestoreMeta | null {
  const marker = text.search(/meta:\s*/);
  if (marker < 0) return null;
  const open = text.indexOf('{', marker);
  if (open < 0) return null;
  const raw = sliceMatchingBraces(text, open);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PdfRestoreMeta;
  } catch {
    /* wrapPartLines may insert newlines inside the title string */
  }
  try {
    return JSON.parse(raw.replace(/[\n\r\t]/g, '')) as PdfRestoreMeta;
  } catch {
    /* pdf.js may insert spaces between glyphs inside the JSON */
  }
  try {
    return JSON.parse(raw.replace(/\s+/g, '')) as PdfRestoreMeta;
  } catch {
    return null;
  }
}

function expectedPartLength(meta: PdfRestoreMeta, index: number): number {
  const budget = pageCharBudget(meta);
  if (index < meta.parts) return budget;
  const full = Math.max(0, meta.bytes);
  return Math.max(0, full - budget * (meta.parts - 1));
}

function isPayloadToken(token: string, lineWidth: number): boolean {
  if (!token) return false;
  if (CHROME_TOKENS.has(token)) return false;
  if (token === 'lectern.click') return false;
  if (token.startsWith(`${LECTERN_RESTORE_MAGIC}.`)) {
    return /^LCT1\.[A-Za-z0-9_-]+$/.test(token);
  }
  if (token.includes('.')) return false;
  return /^[A-Za-z0-9_-]+$/.test(token) && token.length <= lineWidth;
}

/** Keep LCT1 payload characters; drop header/footer punctuation that pdf.js concatenates. */
export function sanitizePayloadChars(raw: string): string {
  const compact = raw.replace(/[\s\u00a0]+/g, '');
  if (compact.startsWith(`${LECTERN_RESTORE_MAGIC}.`)) {
    return `${LECTERN_RESTORE_MAGIC}.${compact.slice(LECTERN_RESTORE_MAGIC.length + 1).replace(/[^A-Za-z0-9_-]/g, '')}`;
  }
  return compact.replace(/[^A-Za-z0-9_-]/g, '');
}

function assemblePartBody(raw: string, expectedLen: number, lineWidth: number): string | null {
  const delimited = sanitizePayloadChars(raw);
  if (expectedLen > 0) {
    if (delimited.length === expectedLen) return delimited;
    if (delimited.length > expectedLen) {
      const prefix = delimited.slice(0, expectedLen);
      if (/^[A-Za-z0-9_-]+$/.test(prefix)) return prefix;
    }
  } else if (delimited.length > 0) {
    return delimited;
  }

  const tokens = raw
    .split(/[\s\u00a0]+/)
    .map((t) => t.replace(/[\u2010-\u2015\u2212]/g, '-'))
    .filter((t) => isPayloadToken(t, lineWidth));

  let joined = tokens.join('');
  if (expectedLen > 0 && joined.length >= expectedLen) {
    return joined.slice(0, expectedLen);
  }

  const long = tokens.filter(
    (t) => t.length === lineWidth || t.startsWith(`${LECTERN_RESTORE_MAGIC}.`) || t.length > PDF_LINE_WIDTH,
  );
  joined = long.join('');
  if (expectedLen > 0 && joined.length < expectedLen) {
    const need = expectedLen - joined.length;
    const remainder = tokens.find((t) => t.length === need && !long.includes(t));
    if (remainder) joined += remainder;
  }

  if (expectedLen > 0 && joined.length === expectedLen) return joined;
  if (expectedLen > 0 && joined.length > expectedLen) return joined.slice(0, expectedLen);
  if (joined.length > 0 && expectedLen <= 0) return joined;
  return null;
}

function parsePartBodies(text: string, meta: PdfRestoreMeta): Map<number, string> {
  const bodies = new Map<number, string>();
  const lineWidth = lineWidthForMeta(meta);
  const headers: Array<{ index: number; start: number; bodyAt: number }> = [];
  PART_HEADER_RE.lastIndex = 0;
  for (const match of text.matchAll(PART_HEADER_RE)) {
    const index = Number(match[1]);
    if (!Number.isFinite(index) || match.index == null) continue;
    headers.push({
      index,
      start: match.index,
      bodyAt: match.index + match[0].length,
    });
  }

  for (let h = 0; h < headers.length; h += 1) {
    const header = headers[h];
    const nextHeader = headers[h + 1];
    const regionEnd = nextHeader ? nextHeader.start : text.length;
    let slice = text.slice(header.bodyAt, regionEnd);
    const partEndAt = slice.indexOf(LECTERN_PDF_PART_END);
    if (partEndAt >= 0) slice = slice.slice(0, partEndAt);
    const endAt = slice.indexOf(LECTERN_PDF_END);
    if (endAt >= 0) slice = slice.slice(0, endAt);
    const expected = expectedPartLength(meta, header.index);
    const body = assemblePartBody(slice, expected, lineWidth);
    if (body) bodies.set(header.index, body);
  }

  return bodies;
}

function finalizePayload(joined: string, meta: PdfRestoreMeta): string | null {
  const payload = joined.startsWith(`${LECTERN_RESTORE_MAGIC}.`)
    ? joined
    : `${LECTERN_RESTORE_MAGIC}.${joined}`;
  const clean = sanitizePayloadChars(payload);
  if (!/^LCT1\.[A-Za-z0-9_-]+$/.test(clean)) return null;
  if (meta.bytes > 0 && clean.length !== meta.bytes) {
    const bodyLen = clean.length - LECTERN_RESTORE_MAGIC.length - 1;
    if (bodyLen !== meta.bytes && clean.length !== meta.bytes) {
      if (clean.length < 8) return null;
    }
  }
  return clean;
}

/** Extract LCT1.… payload from PDF text using LECTERN_PDF/v1 protocol. */
export function extractPayloadFromPdfText(text: string): string | null {
  const normalized = normalizeProtocolMarkers(text);
  if (!pdfTextHasRestoreBegin(normalized) && !pdfTextHasRestoreBegin(text)) return null;

  const meta = parseMetaFromText(normalized);
  if (!meta) return null;
  if (meta.v !== 1 || meta.magic !== LECTERN_RESTORE_MAGIC) return null;
  if (meta.parts === 0 && meta.attach) return null;
  if (!Number.isFinite(meta.parts) || meta.parts < 1) return null;

  const bodies = parsePartBodies(normalized, meta);
  if (bodies.size === 0) return null;

  let joined = '';
  for (let i = 1; i <= meta.parts; i += 1) {
    const part = bodies.get(i);
    if (!part) return null;
    joined += part;
  }

  return finalizePayload(joined, meta);
}

export function extractPayloadFromPdfPages(pageTexts: string[]): string | null {
  for (let tail = 1; tail <= Math.min(pageTexts.length, 64); tail += 1) {
    const slice = pageTexts.slice(-tail).join('\n\n');
    if (!pdfTextHasRestoreBegin(slice)) continue;
    const found = extractPayloadFromPdfText(slice);
    if (found) return found;
  }

  return extractPayloadFromPdfText(pageTexts.join('\n\n'));
}

export function restorePayloadSizeWarning(payloadLength: number): string | null {
  if (payloadLength > WARN_RESTORE_PAYLOAD_BYTES) {
    const mb = (payloadLength / (1024 * 1024)).toFixed(1);
    return `Restore pack is ~${mb} MB — lesson and media are embedded inside the PDF file.`;
  }
  return null;
}

/** Flatten pack parts into invisible courier lines for PDF writing. */
export function flattenPackForInvisibleWrite(pack: PdfRestorePack): string[] {
  const lineWidth = pack.meta.lineWidth ?? PDF_DENSE_LINE_WIDTH;
  const lines: string[] = [];
  for (let idx = 0; idx < pack.parts.length; idx += 1) {
    const partNum = idx + 1;
    lines.push(`${LECTERN_PDF_PART}/${partNum}/${pack.parts.length}%%`);
    lines.push(...wrapPartLines(pack.parts[idx], lineWidth));
    lines.push(LECTERN_PDF_PART_END);
    if (partNum === pack.parts.length) lines.push(LECTERN_PDF_END);
  }
  return lines;
}
