import { PDFDocument } from 'pdf-lib';
import {
  LECTERN_RESTORE_ATTACH,
  type PdfRestoreMeta,
} from './pdf-restore-protocol';

export function buildAttachmentRestoreMeta(
  lessonId: string,
  title: string,
  payloadBytes: number,
): PdfRestoreMeta {
  return {
    v: 1,
    id: lessonId,
    title,
    parts: 0,
    bytes: payloadBytes,
    magic: 'LCT1',
    attach: LECTERN_RESTORE_ATTACH,
  };
}

/** Embed LCT1 payload bytes inside the PDF (same file — not a sidecar download). */
export async function embedRestorePayloadInPdf(
  pdfBytes: Uint8Array,
  payload: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  await pdfDoc.attach(new TextEncoder().encode(payload), LECTERN_RESTORE_ATTACH, {
    mimeType: 'application/octet-stream',
    description: 'Lectern lesson restore payload (LCT1)',
  });
  return pdfDoc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
