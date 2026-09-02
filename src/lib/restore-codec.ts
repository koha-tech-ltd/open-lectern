import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { parseLecternFile } from '@/lib/export-lectern';
import { extractPayloadFromPdfText } from '@/lib/pdf-restore-protocol';
import type { LessonDocument } from '@/types/lesson';

/** Wire format version for compressed restore payloads. */
export const RESTORE_MAGIC = 'LCT1';

/** Legacy PDF / .lectern.txt markers (v0 exports). */
export const RESTORE_PAYLOAD_START = '%%LECTERN_RESTORE_PAYLOAD_START%%';
export const RESTORE_PAYLOAD_END = '%%LECTERN_RESTORE_PAYLOAD_END%%';
export const RESTORE_SHEET_START = '%%LECTERN_RESTORE_SHEET_START%%';
export const RESTORE_SHEET_END = '%%LECTERN_RESTORE_SHEET_END%%';

/** Legacy QR sheet chunk size (import only). */
export const QR_CHUNK_CHARS = 700;

const B64_CHUNK = 0x8000;

export interface RestoreBundle {
  magic: typeof RESTORE_MAGIC;
  lessonId: string;
  title: string;
  /** Deflated JSON as base64url (no chunking). */
  payload: string;
  /** Legacy QR-ready chunks (import only). */
  sheets: string[];
  byteLength: number;
  sheetCount: number;
}

function bytesToBinary(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    const slice = bytes.subarray(i, i + B64_CHUNK);
    let chunk = '';
    for (let j = 0; j < slice.length; j += 1) {
      chunk += String.fromCharCode(slice[j]);
    }
    parts.push(chunk);
  }
  return parts.join('');
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(token: string): Uint8Array {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function lessonToRestorePayload(lesson: LessonDocument): string {
  const clean: LessonDocument = {
    ...lesson,
    published: true,
    annotations: [],
  };
  const json = JSON.stringify(clean);
  const deflated = deflateSync(strToU8(json), { level: 9 });
  return `${RESTORE_MAGIC}.${toBase64Url(deflated)}`;
}

export function buildRestoreBundle(lesson: LessonDocument): RestoreBundle {
  const payload = lessonToRestorePayload(lesson);
  const body = payload.slice(RESTORE_MAGIC.length + 1);
  const sheets: string[] = [];
  const n = Math.max(1, Math.ceil(body.length / QR_CHUNK_CHARS));
  for (let i = 0; i < n; i += 1) {
    const chunk = body.slice(i * QR_CHUNK_CHARS, (i + 1) * QR_CHUNK_CHARS);
    sheets.push(`${RESTORE_MAGIC}|${i + 1}/${n}|${lesson.id}|${chunk}`);
  }
  return {
    magic: RESTORE_MAGIC,
    lessonId: lesson.id,
    title: lesson.meta.title,
    payload,
    sheets,
    byteLength: payload.length,
    sheetCount: sheets.length,
  };
}

function parseLessonJson(json: string): LessonDocument | null {
  try {
    const parsed = JSON.parse(json) as LessonDocument;
    if (!parsed?.meta || !Array.isArray(parsed.sections) || !Array.isArray(parsed.quiz)) {
      return null;
    }
    return {
      ...parsed,
      published: true,
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
    };
  } catch {
    return null;
  }
}

function inflatePayloadBody(body: string): LessonDocument | null {
  try {
    const bytes = fromBase64Url(body);
    const json = strFromU8(inflateSync(bytes));
    return parseLessonJson(json);
  } catch {
    return null;
  }
}

function isTightRestoreToken(text: string): boolean {
  if (text.startsWith(`${RESTORE_MAGIC}.`)) return true;
  if (text.startsWith('{')) return true;
  if (/^LCT1\|\d+\/\d+\|/.test(text)) return true;
  return false;
}

function isDocumentLikeRestoreInput(text: string): boolean {
  if (text.includes('%%LECTERN_PDF/v1/')) return true;
  if (text.includes(RESTORE_PAYLOAD_START)) return true;
  if (text.includes(RESTORE_SHEET_START)) return true;
  if (text.includes('LECTERN RESTORE')) return true;
  if (text.includes('# Full payload:')) return true;
  if (text.length > 800 && !isTightRestoreToken(text)) return true;
  return false;
}

function decodeRestoreCore(text: string):
  | { ok: true; lesson: LessonDocument; source: string }
  | { ok: false; error: string; progress?: { have: number; need: number } } {
  if (text.startsWith('{')) {
    const fromLecternFile = parseLecternFile(text);
    if (fromLecternFile) {
      return { ok: true, lesson: fromLecternFile, source: 'lectern-file' };
    }
  }

  if (text.startsWith(`${RESTORE_MAGIC}.`)) {
    const lesson = inflatePayloadBody(text.slice(RESTORE_MAGIC.length + 1));
    if (!lesson) return { ok: false, error: 'Restore code is corrupted or incomplete.' };
    return { ok: true, lesson, source: 'payload' };
  }

  if (!text.includes('|') && !text.includes('{') && text.length > 40) {
    try {
      const padded = text.replace(/-/g, '+').replace(/_/g, '/');
      const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
      const binary = atob(padded + pad);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      const lesson = parseLessonJson(json);
      if (lesson) return { ok: true, lesson, source: 'share-token' };
    } catch {
      /* fall through */
    }
  }

  if (text.startsWith('{')) {
    const lesson = parseLessonJson(text);
    if (!lesson) return { ok: false, error: 'JSON does not look like a Lectern lesson.' };
    return { ok: true, lesson, source: 'json' };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const sheetRe = /^LCT1\|(\d+)\/(\d+)\|([^|]+)\|(.+)$/;
  const parts = new Map<number, { n: number; id: string; chunk: string }>();
  for (const line of lines) {
    const m = line.match(sheetRe);
    if (!m) continue;
    const i = Number(m[1]);
    const n = Number(m[2]);
    const chunk = m[4];
    if (!Number.isFinite(i) || !Number.isFinite(n) || i < 1 || i > n) {
      return { ok: false, error: `Bad sheet index in: ${line.slice(0, 48)}…` };
    }
    parts.set(i, { n, id: m[3], chunk });
  }

  if (parts.size === 0) {
    return {
      ok: false,
      error: 'Unrecognized restore data. Upload a Lectern PDF or .lectern file.',
    };
  }

  const first = parts.values().next().value;
  if (!first) return { ok: false, error: 'No sheet parts found.' };
  const need = first.n;
  if (parts.size < need) {
    return {
      ok: false,
      error: `Found ${parts.size} of ${need} legacy restore parts — re-export the PDF.`,
      progress: { have: parts.size, need },
    };
  }

  let body = '';
  for (let i = 1; i <= need; i += 1) {
    const part = parts.get(i);
    if (!part) {
      return {
        ok: false,
        error: `Missing part ${i}/${need}.`,
        progress: { have: parts.size, need },
      };
    }
    if (part.n !== need) {
      return { ok: false, error: 'Restore parts disagree — use one export pack.' };
    }
    body += part.chunk;
  }

  const lesson = inflatePayloadBody(body);
  if (!lesson) return { ok: false, error: 'Restore parts did not decode. Re-export the PDF.' };
  return { ok: true, lesson, source: 'legacy-sheets' };
}

/** Accept LCT1 payload, .lectern JSON, legacy sheets, or PDF/.lectern.txt dumps. */
export function decodeRestoreInput(raw: string):
  | { ok: true; lesson: LessonDocument; source: string }
  | { ok: false; error: string; progress?: { have: number; need: number } } {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'No restore data provided.' };

  if (isDocumentLikeRestoreInput(text)) {
    const pdfPayload = extractPayloadFromPdfText(text);
    if (pdfPayload) return decodeRestoreCore(pdfPayload);

    const extracted = extractRestoreRawFromDocument(text);
    if (extracted && extracted !== text) {
      return decodeRestoreCore(extracted);
    }
  }

  return decodeRestoreCore(text);
}

export function addRestoreSheet(existing: string, nextLine: string): string {
  const lines = new Set(
    existing
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const trimmed = nextLine.trim();
  if (trimmed) lines.add(trimmed);
  return [...lines].sort((a, b) => {
    const ma = a.match(/^LCT1\|(\d+)\//);
    const mb = b.match(/^LCT1\|(\d+)\//);
    if (ma && mb) return Number(ma[1]) - Number(mb[1]);
    return a.localeCompare(b);
  }).join('\n');
}

export function normalizeRestoreDocumentText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/(LCT1\.[A-Za-z0-9_-]*)\n([A-Za-z0-9_-]+)/g, '$1$2');
}

const SHEET_LINE_RE = /^LCT1\|(\d+)\/(\d+)\|([^|]+)\|(.+)$/;

function uniqueSortedSheets(lines: string[]): string[] {
  const map = new Map<number, string>();
  for (const line of lines) {
    const m = line.match(SHEET_LINE_RE);
    if (m) map.set(Number(m[1]), line);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, line]) => line);
}

/** Legacy + PDF text dump extraction (single pass; no recursion). */
export function extractRestoreRawFromDocument(text: string): string | null {
  const pdfPayload = extractPayloadFromPdfText(text);
  if (pdfPayload) return pdfPayload;

  const normalized = normalizeRestoreDocumentText(text);

  const marked = normalized.match(
    /%%LECTERN_RESTORE_PAYLOAD_START%%([\s\S]*?)%%LECTERN_RESTORE_PAYLOAD_END%%/,
  );
  if (marked) {
    const payload = marked[1].replace(/\s+/g, '').trim();
    if (payload.startsWith(`${RESTORE_MAGIC}.`)) return payload;
  }

  const payloadMatches = [...normalized.matchAll(/LCT1\.[A-Za-z0-9_-]+/g)].map((m) => m[0]);
  if (payloadMatches.length > 0) {
    payloadMatches.sort((a, b) => b.length - a.length);
    return payloadMatches[0];
  }

  const markedSheets: string[] = [];
  const sheetBlockRe = /%%LECTERN_RESTORE_SHEET_START%%([\s\S]*?)%%LECTERN_RESTORE_SHEET_END%%/g;
  for (const match of normalized.matchAll(sheetBlockRe)) {
    const line = match[1].replace(/\s+/g, '').trim();
    if (SHEET_LINE_RE.test(line)) markedSheets.push(line);
  }
  if (markedSheets.length > 0) {
    return uniqueSortedSheets(markedSheets).join('\n');
  }

  const sheetLines = [...normalized.matchAll(/^LCT1\|\d+\/\d+\|[^|\n]+\|[A-Za-z0-9_-]+$/gm)].map((m) => m[0]);
  if (sheetLines.length > 0) {
    return uniqueSortedSheets(sheetLines).join('\n');
  }

  const loose = normalized
    .split(/\n/)
    .map((l) => l.trim().replace(/\s+/g, ''))
    .filter((l) => l.startsWith(`${RESTORE_MAGIC}|`));
  if (loose.length > 0) {
    return uniqueSortedSheets(loose).join('\n');
  }

  return null;
}
