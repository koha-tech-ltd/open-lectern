import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  extractPayloadFromPdfPages,
  pdfTextHasRestoreBegin,
  LECTERN_RESTORE_ATTACH,
} from '@/lib/pdf-restore-protocol';
import {
  RESTORE_MAGIC,
  addRestoreSheet,
  decodeRestoreInput,
  extractRestoreRawFromDocument,
} from '@/lib/restore-codec';

// pdf.js 4 treats a .mjs workerSrc as `new Worker(url, { type: "module" })`.
// lectern.click nginx must serve .mjs as application/javascript (see nginx/default.conf).
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): (new (opts: { formats: string[] }) => BarcodeDetectorLike) | null {
  const w = window as Window & {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  };
  return w.BarcodeDetector ?? null;
}

function textContentToString(content: { items: Array<unknown> }): string {
  const chunks: string[] = [];
  for (const item of content.items) {
    if (typeof item !== 'object' || item === null || !('str' in item)) continue;
    const str = (item as { str: unknown }).str;
    if (typeof str !== 'string' || str.length === 0) continue;
    chunks.push(str);
    const hasEOL = 'hasEOL' in item && Boolean((item as { hasEOL?: boolean }).hasEOL);
    chunks.push(hasEOL ? '\n' : ' ');
  }
  return chunks.join('');
}

async function extractPageTextsFromPdfBytes(data: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    pages.push(textContentToString(content));
  }
  return pages;
}

async function extractQrLinesFromPdfBytes(data: Uint8Array): Promise<string[]> {
  const Detector = getBarcodeDetector();
  if (!Detector) return [];

  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  const startPage = Math.max(1, doc.numPages - 30);

  for (let pageNum = startPage; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const detector = new Detector({ formats: ['qr_code'] });
    try {
      const codes = await detector.detect(canvas);
      for (const code of codes) {
        if (code.rawValue?.includes(RESTORE_MAGIC)) {
          lines.push(code.rawValue.trim());
        }
      }
    } catch {
      /* skip page */
    }
  }

  return lines;
}

async function extractAttachmentPayload(data: Uint8Array): Promise<string | null> {
  try {
    const doc = await pdfjs.getDocument({ data }).promise;
    const attachments = (await doc.getAttachments()) as Record<
      string,
      { content?: Uint8Array | ArrayBuffer | number[] }
    > | null;
    if (!attachments) return null;
    const readContent = (content: Uint8Array | ArrayBuffer | number[]): string => {
      const bytes =
        content instanceof Uint8Array
          ? content
          : content instanceof ArrayBuffer
            ? new Uint8Array(content)
            : new Uint8Array(content);
      return new TextDecoder().decode(bytes);
    };
    const direct = attachments[LECTERN_RESTORE_ATTACH];
    if (direct?.content) return readContent(direct.content);
    for (const [name, file] of Object.entries(attachments)) {
      if (!name.endsWith('.lct1') || !file?.content) continue;
      return readContent(file.content);
    }
    return null;
  } catch {
    return null;
  }
}

export type PdfRestoreExtractResult =
  | { ok: true; raw: string; method: 'pdf-protocol' | 'pdf-text' | 'pdf-qr' | 'pdf-text+qr' }
  | { ok: false; error: string; progress?: { have: number; need: number } };

/** Read a Lectern lesson PDF and return restore raw suitable for decodeRestoreInput. */
export async function extractRestoreFromPdfFile(file: File): Promise<PdfRestoreExtractResult> {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, error: 'Upload a Lectern lesson PDF (.pdf).' };
  }

  const data = new Uint8Array(await file.arrayBuffer());

  const attachmentPayload = await extractAttachmentPayload(data);
  if (attachmentPayload) {
    const decoded = decodeRestoreInput(attachmentPayload);
    if (decoded.ok) {
      return { ok: true, raw: attachmentPayload, method: 'pdf-protocol' };
    }
    return { ok: false, error: decoded.error, progress: decoded.progress };
  }

  let pageTexts: string[] = [];
  try {
    pageTexts = await extractPageTextsFromPdfBytes(data);
  } catch {
    return { ok: false, error: 'Could not read this PDF. Try re-exporting from Lectern.' };
  }

  const fullText = pageTexts.join('\n\n');

  // 1. LECTERN_PDF/v1 protocol (preferred — last pages first)
  const protocolPayload = extractPayloadFromPdfPages(pageTexts);
  if (protocolPayload) {
    const decoded = decodeRestoreInput(protocolPayload);
    if (decoded.ok) {
      return { ok: true, raw: protocolPayload, method: 'pdf-protocol' };
    }
    return { ok: false, error: decoded.error, progress: decoded.progress };
  }

  // 2. Legacy text markers / payload block / sheet lines
  const fromText = extractRestoreRawFromDocument(fullText);
  if (fromText) {
    const decoded = decodeRestoreInput(fromText);
    if (decoded.ok) {
      return { ok: true, raw: fromText, method: 'pdf-text' };
    }
    if (decoded.progress) {
      const qrLines = await extractQrLinesFromPdfBytes(data);
      if (qrLines.length > 0) {
        let combined = fromText;
        for (const line of qrLines) {
          combined = addRestoreSheet(combined, line);
        }
        const merged = decodeRestoreInput(combined);
        if (merged.ok) {
          return { ok: true, raw: combined, method: 'pdf-text+qr' };
        }
        if (merged.progress) {
          return { ok: false, error: merged.error, progress: merged.progress };
        }
      }
      return { ok: false, error: decoded.error, progress: decoded.progress };
    }
  }

  // 3. Legacy QR-only PDFs (old exports)
  const qrLines = await extractQrLinesFromPdfBytes(data);
  if (qrLines.length > 0) {
    let combined = '';
    for (const line of qrLines) {
      combined = addRestoreSheet(combined, line);
    }
    const decoded = decodeRestoreInput(combined);
    if (decoded.ok) {
      return { ok: true, raw: combined, method: 'pdf-qr' };
    }
    if (decoded.progress) {
      return { ok: false, error: decoded.error, progress: decoded.progress };
    }
  }

  if (pdfTextHasRestoreBegin(fullText)) {
    return {
      ok: false,
      error: 'Found LECTERN_PDF restore markers but could not assemble the payload. Re-export from Lectern.',
    };
  }

  return {
    ok: false,
    error:
      'No Lectern restore data found. Export from Lectern (PDF includes technical restore pages at the end).',
  };
}
