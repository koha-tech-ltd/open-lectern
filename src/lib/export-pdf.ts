import { GState, jsPDF } from 'jspdf';
import { embedLessonMedia } from '@/lib/embed-lesson-media';
import {
  lessonLevelQuiz,
  quizAnswerKeyStripes,
  quizItemsForSection,
  SITE_URL,
} from '@/lib/lesson';
import { isBuiltinSectionKind } from '@/lib/section-kind';
import {
  normalizePdfTable,
  parsePdfManuscript,
  preparePdfInline,
  type PdfBlock,
  type PdfCalloutKind,
} from '@/lib/pdf-manuscript';
import {
  buildAttachmentRestoreMeta,
  downloadPdfBytes,
  embedRestorePayloadInPdf,
} from '@/lib/pdf-restore-attach';
import {
  flattenPackForInvisibleWrite,
  formatPdfSystemIntro,
  restorePayloadSizeWarning,
  splitPayloadForPdfPages,
} from '@/lib/pdf-restore-protocol';
import { buildRestoreBundle, type RestoreBundle } from '@/lib/restore-codec';
import type { LessonDocument, QuizItem } from '@/types/lesson';

export type PdfOrientation = 'portrait' | 'landscape';

export type PdfExportOptions = {
  orientation?: PdfOrientation;
};

const BUILTIN_KIND_LABEL = {
  material: 'Reading',
  example: 'Worked example',
  summary: 'Takeaways',
} as const;

function sectionKindPdfLabel(kind: string): string {
  return isBuiltinSectionKind(kind) ? BUILTIN_KIND_LABEL[kind] : kind;
}

const PDF_FONT_FAMILY = 'LecternText';
const AI_VISUAL_NOTICE =
  'Image notice: Visuals in this document are partly generated or edited with AI. Marked accordingly in line with EU AI Act transparency rules (Art. 50).';

/**
 * Mobile-first A4 type scale (pt). Body is sized so fit-to-width on a phone
 * stays readable without pinch-zoom, while remaining print-reasonable.
 * Source Serif 4 (Text optical size) is Lectern's reading face: true italics,
 * Latin + Cyrillic (including Ukrainian ґ є і ї), and open counters.
 */
const TYPE = {
  body: 14,
  bodyLine: 22,
  heading: 18,
  headingLine: 24,
  subhead: 16,
  kicker: 11,
  caption: 12,
  captionLine: 18,
  footer: 9,
  notice: 9,
  noticeLine: 13,
  overview: 14,
  overviewLine: 21,
  coverBrand: 14,
  coverTag: 12,
  coverTitle: 32,
  coverTitleLine: 38,
  coverMeta: 14,
  coverHow: 20,
  coverLead: 13,
  coverLeadLine: 19,
  coverCardTitle: 14,
  coverCardBody: 12,
  coverCardBodyLine: 18,
  coverNote: 13,
  coverNoteLine: 19,
  table: 11,
  tableLine: 16,
} as const;

type PdfFontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

type PdfRun = { text: string; style: PdfFontStyle };

function isAiVisual(src: string, name?: string, originSrc?: string): boolean {
  const probe = originSrc ?? src;
  return /(?:^|[-_])ai(?:[._-]|$)/i.test(probe) || /ai[- ]?generated/i.test(name ?? '');
}

function setType(doc: jsPDF, size: number, style: PdfFontStyle = 'normal'): void {
  doc.setFont(PDF_FONT_FAMILY, style);
  doc.setFontSize(size);
}

/** jsPDF's bundled fonts lack Cyrillic; embed Source Serif 4 (OFL) instead of Arial. */
async function loadPdfReadingFonts(doc: jsPDF): Promise<void> {
  const faces: Array<{ file: string; style: PdfFontStyle }> = [
    { file: 'SourceSerif4-Regular.ttf', style: 'normal' },
    { file: 'SourceSerif4-Bold.ttf', style: 'bold' },
    { file: 'SourceSerif4-Italic.ttf', style: 'italic' },
    { file: 'SourceSerif4-BoldItalic.ttf', style: 'bolditalic' },
  ];

  for (const { file, style } of faces) {
    const response = await fetch(`/fonts/${file}`);
    if (!response.ok) throw new Error(`Could not load embedded PDF font: ${file}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let start = 0; start < bytes.length; start += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
    }
    doc.addFileToVFS(file, btoa(binary));
    doc.addFont(file, PDF_FONT_FAMILY, style);
  }

  doc.setFont(PDF_FONT_FAMILY, 'normal');
  doc.setFontSize(TYPE.body);
  doc.setLineHeightFactor(1.45);
}

function combineFontStyle(base: PdfFontStyle, extra: PdfFontStyle): PdfFontStyle {
  const bold = base === 'bold' || base === 'bolditalic' || extra === 'bold' || extra === 'bolditalic';
  const italic = base === 'italic' || base === 'bolditalic' || extra === 'italic' || extra === 'bolditalic';
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function parseEmphasisRuns(input: string, base: PdfFontStyle): PdfRun[] {
  const runs: PdfRun[] = [];
  const re = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) {
    if (match.index > last) {
      runs.push({ text: input.slice(last, match.index), style: base });
    }
    if (match[2] != null) runs.push({ text: match[2], style: combineFontStyle(base, 'bolditalic') });
    else if (match[3] != null) runs.push({ text: match[3], style: combineFontStyle(base, 'bold') });
    else runs.push({ text: match[4], style: combineFontStyle(base, 'italic') });
    last = match.index + match[0].length;
  }
  if (last < input.length) runs.push({ text: input.slice(last), style: base });
  return runs.filter((run) => run.text.length > 0);
}

function safeFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || 'lectern-lesson';
}

/** jsPDF cannot embed SVG vectors. Rasterize at ~3× design size (~550 DPI on A4 content width). */
const SVG_PDF_MIN_LONG_EDGE = 2560;
const SVG_PDF_MAX_LONG_EDGE = 3840;
const SVG_PDF_SCALE = 3;
const PDF_IMAGE_COMPRESSION = 'FAST';
/** Extra 16pt under the figure (then trimmed 8pt after 34pt felt too open). */
const FIGURE_CAPTION_GAP = 26;
/** Match landscape Cossack figures (full-width 16:9). Portraits fit inside and stay centered. */
const FIGURE_MAX_HEIGHT_RATIO = 9 / 16;

function fitContainedSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const srcW = Math.max(1, sourceWidth);
  const srcH = Math.max(1, sourceHeight);
  const scale = Math.min(maxWidth / srcW, maxHeight / srcH);
  return { width: srcW * scale, height: srcH * scale };
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function rasterPixelSizeFromBytes(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const width = readU32(bytes, 16);
    const height = readU32(bytes, 20);
    if (width > 0 && height > 0) return { width, height };
    return null;
  }
  if (bytes.length > 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 8 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const length = readU16(bytes, i + 2);
      if (length < 2) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)) {
        const height = readU16(bytes, i + 5);
        const width = readU16(bytes, i + 7);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }
      i += 2 + length;
    }
  }
  return null;
}

function rasterPixelSizeFromDataUrl(dataUrl: string): { width: number; height: number } | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0 || !dataUrl.startsWith('data:image/')) return null;
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return rasterPixelSizeFromBytes(bytes);
  } catch {
    return null;
  }
}

function pdfImageBox(
  doc: jsPDF,
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const header = rasterPixelSizeFromDataUrl(dataUrl);
  if (header) return fitContainedSize(header.width, header.height, maxWidth, maxHeight);
  try {
    const props = doc.getImageProperties(dataUrl);
    return fitContainedSize(props.width, props.height, maxWidth, maxHeight);
  } catch {
    return fitContainedSize(16, 9, maxWidth, maxHeight);
  }
}

function parseSvgUserLength(value: string | null): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) return 0;
  const match = trimmed.match(/^([0-9]*\.?[0-9]+)/);
  return match ? Number(match[1]) : 0;
}

function parseSvgIntrinsicSize(svgText: string): { width: number; height: number } {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = parsed.documentElement;
  if (root.tagName.toLowerCase() === 'svg') {
    const viewBox = root.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { width: parts[2], height: parts[3] };
      }
    }
    const width = parseSvgUserLength(root.getAttribute('width'));
    const height = parseSvgUserLength(root.getAttribute('height'));
    if (width > 0 && height > 0) return { width, height };
  }
  return { width: 1280, height: 720 };
}

function svgRasterPixelSize(intrinsicWidth: number, intrinsicHeight: number): { width: number; height: number } {
  const aspect = intrinsicHeight / Math.max(intrinsicWidth, 1);
  const designLong = Math.max(intrinsicWidth, intrinsicHeight, 1);
  const targetLong = Math.min(
    SVG_PDF_MAX_LONG_EDGE,
    Math.max(SVG_PDF_MIN_LONG_EDGE, Math.round(designLong * SVG_PDF_SCALE)),
  );
  if (intrinsicWidth >= intrinsicHeight) {
    return { width: targetLong, height: Math.max(1, Math.round(targetLong * aspect)) };
  }
  return { width: Math.max(1, Math.round(targetLong / aspect)), height: targetLong };
}

function svgMarkupAtPixelSize(svgText: string, width: number, height: number): string {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = parsed.documentElement;
  if (root.tagName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) {
    throw new Error('Not a valid SVG document');
  }
  if (!root.getAttribute('viewBox')) {
    const fallbackW = parseSvgUserLength(root.getAttribute('width')) || width;
    const fallbackH = parseSvgUserLength(root.getAttribute('height')) || height;
    root.setAttribute('viewBox', `0 0 ${fallbackW} ${fallbackH}`);
  }
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  return new XMLSerializer().serializeToString(root);
}

function isSvgSource(src: string, blob: Blob): boolean {
  return (
    blob.type.includes('svg') ||
    /\.svg(\?|$)/i.test(src) ||
    /^data:image\/svg/i.test(src)
  );
}

async function loadHtmlImage(url: string, width: number, height: number): Promise<HTMLImageElement> {
  const element = new Image(width, height);
  element.src = url;
  if (typeof element.decode === 'function') {
    await element.decode();
    return element;
  }
  await new Promise<void>((resolve, reject) => {
    if (element.complete && element.naturalWidth > 0) {
      resolve();
      return;
    }
    element.onload = () => resolve();
    element.onerror = () => reject(new Error('SVG render failed'));
  });
  return element;
}

async function rasterizeSvgForPdf(blob: Blob): Promise<{ dataUrl: string; format: 'PNG' } | null> {
  try {
    const svgText = await blob.text();
    const intrinsic = parseSvgIntrinsicSize(svgText);
    const { width, height } = svgRasterPixelSize(intrinsic.width, intrinsic.height);
    const markup = svgMarkupAtPixelSize(svgText, width, height);
    const objectUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = await loadHtmlImage(objectUrl, width, height);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
      return { dataUrl: canvas.toDataURL('image/png'), format: 'PNG' };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

async function loadImageForPdf(src: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    let absolute = src;
    if (src.startsWith('/')) {
      absolute = `${window.location.origin}${src}`;
    }
    const res = await fetch(absolute);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (isSvgSource(src, blob)) return rasterizeSvgForPdf(blob);
    if (!blob.type.startsWith('image/') || blob.type.includes('gif')) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
    const format = blob.type.includes('png') || dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

const WATERMARK_OPACITY = 0.1;

async function loadBrandLogo(): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  return loadImageForPdf('/logo.png');
}

/** OSS default: Lectern watermark. Lectern Cloud sells school brand + watermark-free PDF. */
function drawBrandWatermark(doc: jsPDF, logo: { dataUrl: string; format: 'PNG' | 'JPEG' } | null) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cx = pageW / 2;
  const cy = pageH / 2;
  const angle = -32;

  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: WATERMARK_OPACITY }));

  if (logo) {
    const logoW = 88;
    const logoH = logoW * 0.72;
    try {
      doc.addImage(logo.dataUrl, logo.format, cx - logoW / 2, cy - 118, logoW, logoH);
    } catch {
      /* logo optional */
    }
  }

  setType(doc, 54, 'bold');
  doc.setTextColor(36, 56, 44);
  doc.text('LECTERN', cx, cy + 8, { align: 'center', angle });

  setType(doc, 12, 'normal');
  doc.setTextColor(184, 132, 58);
  doc.text('lectern.click', cx, cy + 38, { align: 'center', angle });

  doc.restoreGraphicsState();

  // Corner mark — lighter, still branded
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: WATERMARK_OPACITY * 0.75 }));
  setType(doc, TYPE.footer, 'bold');
  doc.setTextColor(36, 56, 44);
  doc.text('LECTERN', pageW - 48, pageH - 48, { align: 'right' });
  doc.restoreGraphicsState();
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  need: number,
  margin: number,
  stampPage?: () => void,
): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - margin) {
    doc.addPage();
    stampPage?.();
    return margin;
  }
  return y;
}

const CALLOUT_STYLE: Record<PdfCalloutKind, { bar: [number, number, number]; fill: [number, number, number] }> = {
  definition: { bar: [36, 56, 44], fill: [236, 239, 237] },
  notation: { bar: [36, 56, 44], fill: [236, 239, 237] },
  takeaway: { bar: [196, 163, 90], fill: [246, 237, 214] },
  warn: { bar: [139, 69, 24], fill: [245, 236, 228] },
  example: { bar: [184, 132, 58], fill: [247, 239, 224] },
  note: { bar: [58, 86, 68], fill: [236, 240, 237] },
};

type RichLine = PdfRun[];

function layoutRichLines(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  fontSize: number,
  baseStyle: PdfFontStyle,
): RichLine[] {
  const prepared = preparePdfInline(text);
  if (!prepared) return [];
  const lines: RichLine[] = [];
  for (const paragraph of prepared.split('\n')) {
    if (!paragraph) {
      lines.push([]);
      continue;
    }
    const tokens: PdfRun[] = [];
    for (const run of parseEmphasisRuns(paragraph, baseStyle)) {
      for (const part of run.text.split(/(\s+)/)) {
        if (part) tokens.push({ text: part, style: run.style });
      }
    }
    let current: PdfRun[] = [];
    let lineW = 0;
    for (const token of tokens) {
      setType(doc, fontSize, token.style);
      const isSpace = /^\s+$/.test(token.text);
      const width = doc.getTextWidth(token.text);
      if (!isSpace && lineW > 0 && lineW + width > maxWidth) {
        lines.push(current);
        current = [];
        lineW = 0;
      }
      if (!isSpace && width > maxWidth && current.length === 0) {
        const pieces = doc.splitTextToSize(token.text, maxWidth) as string[];
        for (let i = 0; i < pieces.length; i += 1) {
          if (i > 0) {
            lines.push(current);
            current = [];
          }
          current.push({ text: pieces[i], style: token.style });
          setType(doc, fontSize, token.style);
          lineW = doc.getTextWidth(pieces[i]);
        }
        continue;
      }
      if (isSpace && lineW <= 0) continue;
      current.push(token);
      lineW += width;
    }
    if (current.length > 0) lines.push(current);
  }
  return lines;
}

function drawRichLines(
  doc: jsPDF,
  lines: RichLine[],
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  margin: number,
  stampPage?: () => void,
): number {
  let cursor = y;
  for (const line of lines) {
    if (line.length === 0) {
      cursor = ensureSpace(doc, cursor, lineHeight * 0.5, margin, stampPage);
      cursor += lineHeight * 0.4;
      continue;
    }
    cursor = ensureSpace(doc, cursor, lineHeight, margin, stampPage);
    let lineX = x;
    for (const token of line) {
      setType(doc, fontSize, token.style);
      doc.text(token.text, lineX, cursor);
      lineX += doc.getTextWidth(token.text);
    }
    cursor += lineHeight;
  }
  return cursor;
}

function writeRichText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  margin: number,
  stampPage?: () => void,
  baseStyle: PdfFontStyle = 'normal',
): number {
  const fontSize = doc.getFontSize();
  const lines = layoutRichLines(doc, text, maxWidth, fontSize, baseStyle);
  if (lines.length === 0) return y;
  return drawRichLines(doc, lines, x, y, fontSize, lineHeight, margin, stampPage);
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  margin: number,
  stampPage?: () => void,
  baseStyle: PdfFontStyle = 'normal',
): number {
  return writeRichText(doc, text, x, y, maxWidth, lineHeight, margin, stampPage, baseStyle);
}

function pageContentBottom(doc: jsPDF, margin: number): number {
  return doc.internal.pageSize.getHeight() - margin;
}

function writePdfCallout(
  doc: jsPDF,
  kind: PdfCalloutKind,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  margin: number,
  stampPage?: () => void,
): number {
  const style = CALLOUT_STYLE[kind];
  const barW = 3.5;
  const padX = 12;
  const padTop = 10;
  const innerW = maxWidth - barW - padX * 2;
  setType(doc, TYPE.body, 'normal');
  const lines = layoutRichLines(doc, text, innerW, TYPE.body, 'normal');
  const lineCount = Math.max(1, lines.length);
  const boxH = padTop + lineCount * TYPE.bodyLine + 8;
  if (y + boxH > pageContentBottom(doc, margin) && boxH < pageContentBottom(doc, margin) - margin) {
    y = ensureSpace(doc, y, boxH, margin, stampPage);
  }
  const top = y - 2;
  doc.setFillColor(...style.fill);
  doc.roundedRect(x, top, maxWidth, boxH, 3, 3, 'F');
  doc.setFillColor(...style.bar);
  doc.rect(x, top, barW, boxH, 'F');
  doc.setTextColor(26, 22, 18);
  setType(doc, TYPE.body, 'normal');
  const textY = top + padTop + TYPE.body * 0.72;
  drawRichLines(doc, lines, x + barW + padX, textY, TYPE.body, TYPE.bodyLine, margin, stampPage);
  doc.setTextColor(26, 22, 18);
  return top + boxH + 14;
}

function writePdfQuote(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  margin: number,
  stampPage?: () => void,
): number {
  const barW = 3;
  const padX = 12;
  setType(doc, TYPE.body, 'italic');
  const lines = layoutRichLines(doc, text, maxWidth - barW - padX, TYPE.body, 'italic');
  const boxH = 8 + Math.max(1, lines.length) * TYPE.bodyLine + 4;
  y = ensureSpace(doc, y, boxH, margin, stampPage);
  const top = y - 2;
  doc.setFillColor(245, 240, 232);
  doc.rect(x, top, maxWidth, boxH, 'F');
  doc.setFillColor(92, 58, 33);
  doc.rect(x, top, barW, boxH, 'F');
  doc.setTextColor(92, 58, 33);
  drawRichLines(doc, lines, x + barW + padX, top + 8 + TYPE.body * 0.72, TYPE.body, TYPE.bodyLine, margin, stampPage);
  doc.setTextColor(26, 22, 18);
  setType(doc, TYPE.body, 'normal');
  return top + boxH + 12;
}

function writePdfMath(
  doc: jsPDF,
  latex: string,
  x: number,
  y: number,
  maxWidth: number,
  margin: number,
  stampPage?: () => void,
): number {
  const inner = preparePdfInline(latex);
  setType(doc, TYPE.body, 'italic');
  const wrapped = (doc.splitTextToSize(inner, maxWidth - 28) as string[]) || [inner];
  const boxH = 16 + wrapped.length * TYPE.bodyLine + 10;
  y = ensureSpace(doc, y, boxH, margin, stampPage);
  const top = y - 2;
  doc.setFillColor(250, 247, 241);
  doc.rect(x, top, maxWidth, boxH, 'F');
  doc.setDrawColor(196, 163, 90);
  doc.setLineWidth(0.8);
  doc.line(x, top, x + maxWidth, top);
  doc.line(x, top + boxH, x + maxWidth, top + boxH);
  doc.setTextColor(36, 56, 44);
  let cursor = top + 14 + TYPE.body * 0.55;
  for (const line of wrapped) {
    doc.text(line, x + maxWidth / 2, cursor, { align: 'center' });
    cursor += TYPE.bodyLine;
  }
  doc.setTextColor(26, 22, 18);
  setType(doc, TYPE.body, 'normal');
  return top + boxH + 14;
}

function writePdfList(
  doc: jsPDF,
  ordered: boolean,
  items: string[],
  x: number,
  y: number,
  maxWidth: number,
  margin: number,
  stampPage?: () => void,
): number {
  const markW = 18;
  setType(doc, TYPE.body, 'normal');
  doc.setTextColor(26, 22, 18);
  for (const [index, item] of items.entries()) {
    y = ensureSpace(doc, y, TYPE.bodyLine, margin, stampPage);
    const mark = ordered ? `${index + 1}.` : '•';
    doc.setTextColor(196, 163, 90);
    setType(doc, TYPE.body, 'bold');
    doc.text(mark, x, y);
    doc.setTextColor(26, 22, 18);
    setType(doc, TYPE.body, 'normal');
    y = writeRichText(doc, item, x + markW, y, maxWidth - markW, TYPE.bodyLine, margin, stampPage);
    y += 2;
  }
  return y + 6;
}

function tableColumnWidths(headers: string[], rows: string[][], maxWidth: number): number[] {
  const cols = headers.length;
  const weights = headers.map((header, i) => {
    let max = header.length;
    for (const row of rows) max = Math.max(max, (row[i] ?? '').length);
    return Math.min(36, Math.max(8, max));
  });
  const sum = weights.reduce((a, b) => a + b, 0) || cols;
  const raw = weights.map((w) => (w / sum) * maxWidth);
  const minW = Math.min(56, maxWidth / cols);
  const grown = raw.map((w) => Math.max(minW, w));
  const grownSum = grown.reduce((a, b) => a + b, 0);
  return grown.map((w) => (w / grownSum) * maxWidth);
}

function tableRowHeight(doc: jsPDF, cells: string[], colW: number[], padX: number, padY: number, style: PdfFontStyle): number {
  let lines = 1;
  for (let i = 0; i < cells.length; i += 1) {
    const inner = Math.max(24, colW[i] - padX * 2);
    const wrapped = layoutRichLines(doc, cells[i] ?? '', inner, TYPE.table, style);
    const count = wrapped.length === 0 ? 1 : wrapped.filter((line) => line.length > 0).length || 1;
    lines = Math.max(lines, count);
  }
  return padY * 2 + lines * TYPE.tableLine;
}

function writePdfTable(
  doc: jsPDF,
  block: Extract<PdfBlock, { type: 'table' }>,
  x: number,
  y: number,
  maxWidth: number,
  margin: number,
  stampPage?: () => void,
): number {
  const { headers, rows } = normalizePdfTable(block.headers, block.rows);
  const colW = tableColumnWidths(headers, rows, maxWidth);
  const padX = 7;
  const padY = 6;
  const border: [number, number, number] = [210, 198, 186];
  const headerFill: [number, number, number] = [236, 239, 237];
  const evenFill: [number, number, number] = [250, 247, 241];

  const paintRow = (cells: string[], top: number, isHeader: boolean, fill: [number, number, number] | null): number => {
    const style: PdfFontStyle = isHeader ? 'bold' : 'normal';
    const rowH = tableRowHeight(doc, cells, colW, padX, padY, style);
    let cursorTop = top;
    if (cursorTop + rowH > pageContentBottom(doc, margin) && cursorTop > margin + 1) {
      doc.addPage();
      stampPage?.();
      cursorTop = margin;
      if (!isHeader) {
        cursorTop = paintRow(headers, cursorTop, true, headerFill);
      }
    }
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(x, cursorTop, maxWidth, rowH, 'F');
    }
    doc.setDrawColor(...border);
    doc.setLineWidth(0.6);
    doc.rect(x, cursorTop, maxWidth, rowH, 'S');
    let cellX = x;
    for (let i = 0; i < cells.length; i += 1) {
      if (i > 0) doc.line(cellX, cursorTop, cellX, cursorTop + rowH);
      const innerW = Math.max(24, colW[i] - padX * 2);
      const lines = layoutRichLines(doc, cells[i] ?? '', innerW, TYPE.table, style);
      setType(doc, TYPE.table, style);
      doc.setTextColor(isHeader ? 36 : 26, isHeader ? 56 : 22, isHeader ? 44 : 18);
      let textY = cursorTop + padY + TYPE.table * 0.8;
      for (const line of lines) {
        let lineX = cellX + padX;
        for (const token of line) {
          setType(doc, TYPE.table, token.style);
          doc.text(token.text, lineX, textY);
          lineX += doc.getTextWidth(token.text);
        }
        textY += TYPE.tableLine;
      }
      cellX += colW[i];
    }
    return cursorTop + rowH;
  };

  let top = y + 4;
  top = paintRow(headers, top, true, headerFill);
  for (const [index, row] of rows.entries()) {
    const fill = index % 2 === 0 ? evenFill : null;
    top = paintRow(row, top, false, fill);
  }
  doc.setTextColor(26, 22, 18);
  setType(doc, TYPE.body, 'normal');
  return top + 16;
}

function writeManuscriptBlocks(
  doc: jsPDF,
  source: string,
  x: number,
  y: number,
  maxWidth: number,
  margin: number,
  stampPage?: () => void,
): number {
  const blocks = parsePdfManuscript(source);
  if (blocks.length === 0) return y;
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        setType(doc, TYPE.body, 'normal');
        doc.setTextColor(26, 22, 18);
        y = writeRichText(doc, block.text, x, y, maxWidth, TYPE.bodyLine, margin, stampPage);
        y += 6;
        break;
      case 'heading': {
        const size = block.level <= 2 ? TYPE.heading : TYPE.subhead;
        const lh = block.level <= 2 ? TYPE.headingLine : 20;
        y = ensureSpace(doc, y, lh + 8, margin, stampPage);
        setType(doc, size, 'bold');
        doc.setTextColor(36, 56, 44);
        y = writeRichText(doc, block.text, x, y, maxWidth, lh, margin, stampPage, 'bold');
        setType(doc, TYPE.body, 'normal');
        doc.setTextColor(26, 22, 18);
        y += 6;
        break;
      }
      case 'list':
        y = writePdfList(doc, block.ordered, block.items, x, y, maxWidth, margin, stampPage);
        break;
      case 'table':
        y = writePdfTable(doc, block, x, y, maxWidth, margin, stampPage);
        break;
      case 'callout':
        y = writePdfCallout(doc, block.kind, block.text, x, y, maxWidth, margin, stampPage);
        break;
      case 'quote':
        y = writePdfQuote(doc, block.text, x, y, maxWidth, margin, stampPage);
        break;
      case 'math':
        y = writePdfMath(doc, block.latex, x, y, maxWidth, margin, stampPage);
        break;
      default:
        break;
    }
  }
  return y;
}

async function writeQuizPromptItem(
  doc: jsPDF,
  item: QuizItem,
  qIndex: number,
  margin: number,
  maxWidth: number,
  y: number,
  stampPage: () => void,
): Promise<number> {
  y = ensureSpace(doc, y, 48, margin, stampPage);
  setType(doc, TYPE.body, 'bold');
  y = writeWrapped(
    doc,
    `Q${qIndex + 1}. ${item.prompt}`,
    margin,
    y,
    maxWidth,
    TYPE.bodyLine,
    margin,
    stampPage,
    'bold',
  );
  setType(doc, TYPE.body, 'normal');
  for (const [ci, choice] of item.choices.entries()) {
    const choiceMedia = item.choiceMedia?.[ci];
    if (choiceMedia?.kind === 'image') {
      const image = await loadImageForPdf(choiceMedia.src);
      if (image) {
        const choiceBox = pdfImageBox(doc, image.dataUrl, 150, 120);
        y = ensureSpace(doc, y, choiceBox.height + 24, margin, stampPage);
        try {
          doc.addImage(
            image.dataUrl,
            image.format,
            margin + 14,
            y,
            choiceBox.width,
            choiceBox.height,
            undefined,
            PDF_IMAGE_COMPRESSION,
          );
          y += choiceBox.height + FIGURE_CAPTION_GAP;
          if (isAiVisual(choiceMedia.src, choiceMedia.name, choiceMedia.originSrc)) {
            setType(doc, TYPE.notice, 'normal');
            doc.setTextColor(92, 58, 33);
            doc.text('Image created or edited with AI.', margin + 14, y);
            y += 12;
            doc.setTextColor(26, 22, 18);
            setType(doc, TYPE.body, 'normal');
          }
        } catch {
          /* Image remains optional in a printable quiz. */
        }
      }
    }
    y = writeWrapped(
      doc,
      `   ${String.fromCharCode(65 + ci)}. ${choice}`,
      margin,
      y,
      maxWidth,
      TYPE.bodyLine,
      margin,
      stampPage,
    );
  }
  return y + 12;
}

/**
 * Answer key: upright title, then stripes with 180°-rotated text laid out so that
 * when the sheet is turned around, Q1 reads left-aligned at the top (classic workbook).
 */
function writeInvertedAnswerKeyPages(
  doc: jsPDF,
  lesson: LessonDocument,
  pageCounter: { value: number },
  stampPage: () => void,
): void {
  const stripes = quizAnswerKeyStripes(lesson);
  if (stripes.length === 0) return;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageW - margin * 2;
  const stripeH = 52;
  const footerReserve = 56;

  let remaining = [...stripes];
  let firstPage = true;

  while (remaining.length > 0) {
    doc.addPage();
    pageCounter.value += 1;
    stampPage();
    drawFooter(doc, pageCounter.value, '', false);

    let contentTop = margin;
    if (firstPage) {
      setType(doc, TYPE.heading, 'bold');
      doc.setTextColor(36, 56, 44);
      doc.text('Answer key', margin, contentTop);
      contentTop += TYPE.headingLine;
      setType(doc, TYPE.caption, 'normal');
      doc.setTextColor(92, 58, 33);
      doc.text('Turn the sheet around to read the answers.', margin, contentTop);
      contentTop += 20;
      firstPage = false;
    } else {
      contentTop += 8;
    }

    const usableBottom = pageH - footerReserve;
    const usableHeight = usableBottom - contentTop;
    const perPage = Math.max(1, Math.floor(usableHeight / stripeH));
    const batch = remaining.slice(0, perPage);
    remaining = remaining.slice(perPage);

    // Draw from bottom upward so after a 180° paper flip, batch[0] is at the top.
    for (let i = 0; i < batch.length; i += 1) {
      const stripe = batch[i];
      const bandBottom = usableBottom - i * stripeH;
      const bandTop = bandBottom - stripeH;
      const alt = i % 2 === 0;
      if (alt) {
        doc.setFillColor(244, 239, 230);
      } else {
        doc.setFillColor(250, 247, 241);
      }
      doc.rect(margin - 6, bandTop, maxWidth + 12, stripeH, 'F');

      const label =
        stripe.placement === 'section' && stripe.sectionTitle
          ? `Q${stripe.localNumber} · ${stripe.sectionTitle}`
          : `Q${stripe.localNumber}`;
      const line1 = `${label}  ·  ${stripe.letter}. ${stripe.choiceText}`.normalize('NFC');
      const line2 = (stripe.explanation || '').normalize('NFC');

      // jsPDF rotates around the left baseline, so angle 180 draws leftward from
      // the origin. Anchor on the right margin: the run sits on the right of the
      // sheet, and after a 180° paper turn it reads left-aligned at the top.
      const originX = pageW - margin;
      const cy = bandTop + stripeH / 2;
      setType(doc, TYPE.caption, 'bold');
      doc.setTextColor(36, 56, 44);
      doc.text(line1.slice(0, 110), originX, cy - 6, { angle: 180 });
      if (line2.trim()) {
        setType(doc, TYPE.notice, 'normal');
        doc.setTextColor(92, 58, 33);
        doc.text(line2.slice(0, 120), originX, cy + 10, { angle: 180 });
      }
    }
  }
}

function siteHostLabel(): string {
  return SITE_URL.replace(/^https?:\/\//, '');
}

function drawSiteHostLink(doc: jsPDF, x: number, y: number): void {
  doc.textWithLink(siteHostLabel(), x, y, { url: SITE_URL });
}

function drawFooter(doc: jsPDF, page: number, totalHint: string, system = false) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  setType(doc, TYPE.footer, 'normal');
  doc.setTextColor(92, 58, 33);
  if (system) {
    doc.text('Lectern system page · not lesson content', 48, pageH - 28);
  } else {
    const prefix = 'Lectern · ';
    doc.text(prefix, 48, pageH - 28);
    drawSiteHostLink(doc, 48 + doc.getTextWidth(prefix), pageH - 28);
  }
  doc.text(`${page}${totalHint}`, pageW - 48, pageH - 28, { align: 'right' });
}

function drawCompactSystemBar(doc: jsPDF, margin: number, pageW: number) {
  doc.setFillColor(36, 56, 44);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(250, 247, 241);
  setType(doc, TYPE.footer, 'bold');
  doc.text('LECTERN · restore data', margin, 14);
}

const SYSTEM_MARGIN = 24;
const SYSTEM_PAYLOAD_TOP = 40;
const SYSTEM_PAYLOAD_BOTTOM = 36;

function writeAttachmentSystemPage(
  doc: jsPDF,
  meta: ReturnType<typeof buildAttachmentRestoreMeta>,
  pageCounter: { value: number },
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const payloadBottom = pageH - SYSTEM_PAYLOAD_BOTTOM;
  const margin = SYSTEM_MARGIN;

  doc.addPage();
  pageCounter.value += 1;
  drawCompactSystemBar(doc, margin, pageW);
  drawFooter(doc, pageCounter.value, ' · restore', true);

  let y = SYSTEM_PAYLOAD_TOP;
  for (const line of formatPdfSystemIntro(meta)) {
    const protocol =
      line.startsWith('%%') ||
      line.startsWith('meta:') ||
      line.startsWith('{') ||
      line.startsWith('"') ||
      /[{}]/.test(line);
    if (protocol) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(58, 86, 68);
    } else {
      doc.setFont(PDF_FONT_FAMILY, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(92, 58, 33);
    }
    const step = protocol ? 8 : 10;
    if (y + step > payloadBottom) break;
    doc.text(line, margin, y);
    y += step;
  }
}

function pdfContinuationUrl(): string {
  const origin = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
    ? window.location.origin
    : SITE_URL;
  return `${origin.replace(/\/$/, '')}/studio?mode=student&from=pdf`;
}

function drawLandscapeLessonCover(
  doc: jsPDF,
  lesson: LessonDocument,
  margin: number,
  pageW: number,
  continuationUrl: string,
) {
  const pageH = doc.internal.pageSize.getHeight();
  const title = (lesson.meta.title || 'Untitled lesson').normalize('NFC');
  const colGap = 28;
  const leftW = (pageW - margin * 2 - colGap) * 0.5;
  const rightX = margin + leftW + colGap;
  const rightW = pageW - margin - rightX;

  doc.setFillColor(36, 56, 44);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(196, 163, 90);
  doc.rect(0, 0, pageW, 8, 'F');

  let y = 44;
  doc.setTextColor(250, 247, 241);
  setType(doc, TYPE.coverBrand, 'bold');
  doc.text('LECTERN', margin, y);
  y += 18;
  setType(doc, TYPE.coverTag, 'normal');
  doc.text('materials · tests · knowledge', margin, y);

  y += 32;
  setType(doc, 26, 'bold');
  const titleLines = doc.splitTextToSize(title, leftW) as string[];
  for (const line of titleLines.slice(0, 4)) {
    doc.text(line, margin, y);
    y += 30;
  }
  y += 6;
  setType(doc, TYPE.coverMeta, 'normal');
  doc.setTextColor(232, 224, 196);
  const metaLines = doc.splitTextToSize(
    `${lesson.meta.subject || 'Subject'}${lesson.meta.audience ? ` · ${lesson.meta.audience}` : ''}`.normalize('NFC'),
    leftW,
  ) as string[];
  for (const line of metaLines.slice(0, 3)) {
    doc.text(line, margin, y);
    y += 18;
  }

  const panelY = 36;
  const panelH = pageH - panelY - 56;
  doc.setFillColor(250, 247, 241);
  doc.roundedRect(rightX, panelY, rightW, panelH, 12, 12, 'F');

  let innerY = panelY + 28;
  doc.setTextColor(36, 56, 44);
  setType(doc, 16, 'bold');
  doc.text('How to use this lesson', rightX + 18, innerY);
  innerY += 18;
  setType(doc, 11, 'normal');
  doc.setTextColor(92, 58, 33);
  const lead =
    'A self-contained landscape copy — wide figures and tables, with an optional Lectern continuation.';
  const leadLines = doc.splitTextToSize(lead, rightW - 36) as string[];
  doc.text(leadLines, rightX + 18, innerY);
  innerY += leadLines.length * 15 + 12;

  const cards = [
    {
      number: '1',
      title: 'Study this PDF',
      body: 'Read across the wide page, inspect illustrations, and answer the paper questions.',
    },
    {
      number: '2',
      title: 'Continue in Lectern',
      body: 'Open the Lectern link in Student mode, then upload this PDF to restore the interactive lesson.',
    },
  ];
  const cardH = Math.min(92, (panelH - (innerY - panelY) - 72) / 2 - 8);
  cards.forEach((card, index) => {
    const cardY = innerY + index * (cardH + 10);
    doc.setFillColor(index === 0 ? 239 : 232, index === 0 ? 229 : 241, index === 0 ? 195 : 218);
    doc.roundedRect(rightX + 16, cardY, rightW - 32, cardH, 8, 8, 'F');
    doc.setFillColor(196, 163, 90);
    doc.circle(rightX + 34, cardY + 22, 11, 'F');
    doc.setTextColor(36, 56, 44);
    setType(doc, 12, 'bold');
    doc.text(card.number, rightX + 34, cardY + 26, { align: 'center' });
    doc.text(card.title, rightX + 52, cardY + 26);
    setType(doc, 10, 'normal');
    doc.setTextColor(58, 56, 48);
    doc.text(doc.splitTextToSize(card.body, rightW - 64) as string[], rightX + 28, cardY + 46);
    if (index === 1) {
      setType(doc, TYPE.kicker, 'bold');
      doc.setTextColor(36, 86, 68);
      doc.textWithLink('Open in Lectern →', rightX + 28, cardY + cardH - 14, { url: continuationUrl });
    }
  });

  doc.setTextColor(232, 224, 196);
  setType(doc, TYPE.footer, 'normal');
  drawSiteHostLink(doc, margin, pageH - 28);
}

function drawLessonCover(
  doc: jsPDF,
  lesson: LessonDocument,
  margin: number,
  pageW: number,
  continuationUrl: string,
  orientation: PdfOrientation = 'portrait',
) {
  if (orientation === 'landscape') {
    drawLandscapeLessonCover(doc, lesson, margin, pageW, continuationUrl);
    return;
  }
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const title = (lesson.meta.title || 'Untitled lesson').normalize('NFC');

  doc.setFillColor(36, 56, 44);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(196, 163, 90);
  doc.rect(0, 0, pageW, 10, 'F');

  let y = 54;
  doc.setTextColor(250, 247, 241);
  setType(doc, TYPE.coverBrand, 'bold');
  doc.text('LECTERN', margin, y);
  y += 20;
  setType(doc, TYPE.coverTag, 'normal');
  doc.text('materials · tests · knowledge', margin, y);

  y += 42;
  setType(doc, TYPE.coverTitle, 'bold');
  const titleLines = doc.splitTextToSize(title, contentW) as string[];
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += TYPE.coverTitleLine;
  }
  y += 8;
  setType(doc, TYPE.coverMeta, 'normal');
  doc.setTextColor(232, 224, 196);
  doc.text(
    `${lesson.meta.subject || 'Subject'}${lesson.meta.audience ? ` · ${lesson.meta.audience}` : ''}`.normalize('NFC'),
    margin,
    y,
  );

  y += 32;
  const panelY = y;
  const cardH = 176;
  const lead =
    'A self-contained learning document — with an optional interactive Lectern continuation.';
  const note =
    'It is ready to read and print. The technical restore pack at the end lets Lectern rebuild this lesson later.';
  setType(doc, TYPE.coverLead, 'normal');
  const leadLines = doc.splitTextToSize(lead, contentW - 48) as string[];
  setType(doc, TYPE.coverNote, 'normal');
  const noteLines = doc.splitTextToSize(note, contentW - 48) as string[];
  const noteRuleGap = 28;
  const noteBodyOffset = 46;
  const panelBottomPad = 24;
  const panelH =
    42 +
    24 +
    leadLines.length * TYPE.coverLeadLine +
    16 +
    cardH +
    noteRuleGap +
    noteBodyOffset +
    Math.max(0, noteLines.length - 1) * TYPE.coverNoteLine +
    panelBottomPad;
  doc.setFillColor(250, 247, 241);
  doc.roundedRect(margin, panelY, contentW, panelH, 14, 14, 'F');

  let innerY = panelY + 42;
  doc.setTextColor(36, 56, 44);
  setType(doc, TYPE.coverHow, 'bold');
  doc.text('How to use this lesson', margin + 24, innerY);
  innerY += 24;
  setType(doc, TYPE.coverLead, 'normal');
  doc.setTextColor(92, 58, 33);
  doc.text(leadLines, margin + 24, innerY);
  innerY += leadLines.length * TYPE.coverLeadLine + 16;

  const cardGap = 14;
  const cardW = (contentW - 48 - cardGap) / 2;
  const cardY = innerY;
  const cards = [
    {
      number: '1',
      title: 'Study this PDF',
      body: 'Read the material, inspect the illustrations, discuss the prompts, and answer the paper questions.',
    },
    {
      number: '2',
      title: 'Continue in Lectern',
      body: 'Open this PDF’s Lectern link in Student mode. “Upload PDF” is highlighted so you can restore the interactive lesson.',
    },
  ];
  cards.forEach((card, index) => {
    const x = margin + 24 + index * (cardW + cardGap);
    doc.setFillColor(index === 0 ? 239 : 232, index === 0 ? 229 : 241, index === 0 ? 195 : 218);
    doc.roundedRect(x, cardY, cardW, cardH, 10, 10, 'F');
    doc.setFillColor(196, 163, 90);
    doc.circle(x + 22, cardY + 26, 13, 'F');
    doc.setTextColor(36, 56, 44);
    setType(doc, TYPE.coverCardTitle, 'bold');
    doc.text(card.number, x + 22, cardY + 31, { align: 'center' });
    doc.text(card.title, x + 44, cardY + 31);
    setType(doc, TYPE.coverCardBody, 'normal');
    doc.setTextColor(58, 56, 48);
    doc.setLineHeightFactor(TYPE.coverCardBodyLine / TYPE.coverCardBody);
    doc.text(doc.splitTextToSize(card.body, cardW - 28) as string[], x + 14, cardY + 64);
    doc.setLineHeightFactor(1.45);
    if (index === 1) {
      setType(doc, TYPE.kicker, 'bold');
      doc.setTextColor(36, 86, 68);
      doc.textWithLink('Open in Lectern →', x + 14, cardY + cardH - 28, { url: continuationUrl });
    }
  });

  const noteY = cardY + cardH + noteRuleGap;
  doc.setDrawColor(196, 163, 90);
  doc.setLineWidth(1);
  doc.line(margin + 24, noteY, pageW - margin - 24, noteY);
  doc.setTextColor(36, 56, 44);
  setType(doc, TYPE.coverNote, 'bold');
  doc.text('Keep this PDF.', margin + 24, noteY + 26);
  setType(doc, TYPE.coverNote, 'normal');
  doc.setTextColor(92, 58, 33);
  doc.setLineHeightFactor(TYPE.coverNoteLine / TYPE.coverNote);
  doc.text(noteLines, margin + 24, noteY + noteBodyOffset);
  doc.setLineHeightFactor(1.45);
  doc.setTextColor(232, 224, 196);
  setType(doc, TYPE.footer, 'normal');
  drawSiteHostLink(doc, margin, pageH - 42);
}

export async function exportLessonPdf(
  lesson: LessonDocument,
  options: PdfExportOptions = {},
): Promise<{
  filename: string;
  bundle: RestoreBundle;
  sizeWarning: string | null;
  embedWarnings: string[];
}> {
  const orientation: PdfOrientation = options.orientation ?? 'portrait';
  const { lesson: embedded, warnings: embedWarnings } = await embedLessonMedia(lesson);
  const bundle = buildRestoreBundle(embedded);
  const sizeWarning = restorePayloadSizeWarning(bundle.payload.length);
  const attachMeta = buildAttachmentRestoreMeta(bundle.lessonId, bundle.title, bundle.payload.length);
  const brandLogo = await loadBrandLogo();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation, compress: true });
  await loadPdfReadingFonts(doc);
  const stampPage = () => drawBrandWatermark(doc, brandLogo);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = orientation === 'landscape' ? 40 : 48;
  const maxWidth = pageW - margin * 2;
  let y = margin;
  let page = 1;

  // —— Dedicated title + onboarding page ——
  drawLessonCover(doc, lesson, margin, pageW, pdfContinuationUrl(), orientation);

  // —— Lesson overview ——
  doc.addPage();
  page += 1;
  stampPage();
  y = margin;
  setType(doc, TYPE.heading, 'bold');
  doc.setTextColor(36, 56, 44);
  doc.text('Lesson overview', margin, y);
  y += TYPE.headingLine;
  setType(doc, TYPE.overview, 'normal');
  doc.setTextColor(26, 22, 18);
  doc.text(
    `${lesson.meta.subject || 'Subject TBD'}${lesson.meta.audience ? `  ·  ${lesson.meta.audience}` : ''}`.normalize('NFC'),
    margin,
    y,
  );
  y += TYPE.overviewLine + 4;
  setType(doc, TYPE.kicker, 'normal');
  doc.setTextColor(184, 132, 58);
  doc.text('Standalone teaching copy · restore pack on system pages at the end', margin, y);
  y += 26;
  doc.setTextColor(26, 22, 18);

  if (lesson.meta.objectives.length > 0) {
    setType(doc, TYPE.subhead, 'bold');
    doc.text('Learning goals', margin, y);
    y += 20;
    setType(doc, TYPE.body, 'normal');
    for (const [i, objective] of lesson.meta.objectives.entries()) {
      y = writeWrapped(
        doc,
        `${i + 1}. ${objective}`,
        margin,
        y,
        maxWidth,
        TYPE.bodyLine,
        margin,
        stampPage,
      );
      y += 6;
    }
    y += 12;
  }

  // —— Sections ——
  const sorted = [...lesson.sections].sort((a, b) => a.order - b.order);
  for (const [index, section] of sorted.entries()) {
    y = ensureSpace(doc, y, 72, margin, stampPage);
    doc.setDrawColor(196, 163, 90);
    doc.setLineWidth(1);
    doc.line(margin, y, pageW - margin, y);
    y += 22;
    setType(doc, TYPE.kicker, 'bold');
    doc.setTextColor(58, 86, 68);
    doc.text(
      `${String(index + 1).padStart(2, '0')}  ·  ${sectionKindPdfLabel(section.kind).toUpperCase()}`,
      margin,
      y,
    );
    y += 20;
    doc.setTextColor(36, 56, 44);
    setType(doc, TYPE.heading, 'bold');
    y = writeWrapped(doc, section.title, margin, y, maxWidth, TYPE.headingLine, margin, stampPage, 'bold');
    y += 10;
    setType(doc, TYPE.body, 'normal');
    doc.setTextColor(26, 22, 18);
    y = writeManuscriptBlocks(doc, section.body, margin, y, maxWidth, margin, stampPage);
    const media = section.media ?? [];
    if (media.length > 0) {
      y += 8;
      for (const item of media) {
        const label = item.caption?.trim() || item.alt || item.name || 'Attached media';
        if (item.kind === 'image') {
          const loaded = item.src.startsWith('data:image/png') || item.src.startsWith('data:image/jpeg')
            ? {
                dataUrl: item.src,
                format: (item.src.startsWith('data:image/png') ? 'PNG' : 'JPEG') as 'PNG' | 'JPEG',
              }
            : await loadImageForPdf(item.src);
          if (loaded) {
            const maxFigureH = Math.min(maxWidth * FIGURE_MAX_HEIGHT_RATIO, pageH - margin * 2 - 72);
            const { width: imgW, height: imgH } = pdfImageBox(
              doc,
              loaded.dataUrl,
              maxWidth,
              maxFigureH,
            );
            const imgX = margin + (maxWidth - imgW) / 2;
            y = ensureSpace(doc, y, imgH + FIGURE_CAPTION_GAP + TYPE.captionLine, margin, stampPage);
            try {
              doc.addImage(
                loaded.dataUrl,
                loaded.format,
                imgX,
                y,
                imgW,
                imgH,
                undefined,
                PDF_IMAGE_COMPRESSION,
              );
              y += imgH + FIGURE_CAPTION_GAP;
            } catch {
              /* fall through to caption-only */
            }
          }
        }
        setType(doc, TYPE.caption, 'italic');
        doc.setTextColor(92, 58, 33);
        y = writeWrapped(
          doc,
          item.kind === 'video'
            ? `[video] ${label} — open in Lectern to play`
            : label,
          margin,
          y,
          maxWidth,
          TYPE.captionLine,
          margin,
          stampPage,
          'italic',
        );
        doc.setTextColor(26, 22, 18);
        setType(doc, TYPE.body, 'normal');
        y += 8;
        if (isAiVisual(item.src, item.name, item.originSrc)) {
          setType(doc, TYPE.notice, 'normal');
          doc.setTextColor(92, 58, 33);
          y = writeWrapped(doc, AI_VISUAL_NOTICE, margin, y, maxWidth, TYPE.noticeLine, margin, stampPage);
          doc.setTextColor(26, 22, 18);
          setType(doc, TYPE.body, 'normal');
          y += 8;
        }
      }
    }

    const nested = quizItemsForSection(lesson, section.id);
    if (nested.length > 0) {
      y += 8;
      y = ensureSpace(doc, y, 36, margin, stampPage);
      setType(doc, TYPE.subhead, 'bold');
      doc.setTextColor(36, 56, 44);
      doc.text('Check this idea', margin, y);
      y += 18;
      doc.setTextColor(26, 22, 18);
      for (const [qi, item] of nested.entries()) {
        y = await writeQuizPromptItem(doc, item, qi, margin, maxWidth, y, stampPage);
      }
    }
    y += 16;
  }

  // —— End-of-lesson quiz (prompts only) ——
  const endQuiz = lessonLevelQuiz(lesson);
  if (endQuiz.length > 0) {
    y = ensureSpace(doc, y, 50, margin, stampPage);
    setType(doc, TYPE.heading, 'bold');
    doc.setTextColor(36, 56, 44);
    doc.text('Check for understanding', margin, y);
    y += TYPE.headingLine;
    setType(doc, TYPE.caption, 'normal');
    doc.setTextColor(92, 58, 33);
    y = writeWrapped(
      doc,
      'Prompts print here for paper study. The answer key is on the last teaching page, printed upside down — turn the sheet around to read it.',
      margin,
      y,
      maxWidth,
      TYPE.captionLine,
      margin,
      stampPage,
    );
    y += 12;
    doc.setTextColor(26, 22, 18);
    for (const [qi, item] of endQuiz.entries()) {
      y = await writeQuizPromptItem(doc, item, qi, margin, maxWidth, y, stampPage);
    }
  }

  drawFooter(doc, page, '', false);

  // —— Inverted answer key (before restore system page) ——
  const pageCounter = { value: page };
  if (lesson.quiz.length > 0) {
    writeInvertedAnswerKeyPages(doc, lesson, pageCounter, stampPage);
  }

  // —— LECTERN_PDF/v1 embedded restore (binary inside PDF + one marker page) ——
  writeAttachmentSystemPage(doc, attachMeta, pageCounter);
  page = pageCounter.value;

  const filename = `${safeFilename(lesson.meta.title)}${orientation === 'landscape' ? '-landscape' : ''}.pdf`;
  const rawPdf = new Uint8Array(doc.output('arraybuffer'));
  const withRestore = await embedRestorePayloadInPdf(rawPdf, bundle.payload);
  downloadPdfBytes(withRestore, filename);
  return { filename, bundle, sizeWarning, embedWarnings };
}

export function downloadRestoreText(bundle: RestoreBundle, title: string): void {
  const pack = splitPayloadForPdfPages(bundle.payload, bundle.lessonId, bundle.title);
  const body = [
    `# Lectern restore · ${bundle.title}`,
    `# Upload the PDF in Lectern, or use the LECTERN_PDF/v1 blocks below.`,
    ...formatPdfSystemIntro(pack.meta),
    '',
    ...flattenPackForInvisibleWrite(pack),
    '',
  ].join('\n');
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(title)}.lectern.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
