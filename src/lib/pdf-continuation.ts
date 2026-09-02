export const PDF_CONTINUATION_PARAM = 'from';
export const PDF_CONTINUATION_VALUE = 'pdf';

type PdfContinuationAction = 'landing' | 'pdf_uploaded' | 'restored';

type PdfContinuationEvent = {
  action: PdfContinuationAction;
  at: string;
  path: string;
};

const STORAGE_KEY = 'lectern.pdf-continuation.v1';

export function isPdfContinuation(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(PDF_CONTINUATION_PARAM) === PDF_CONTINUATION_VALUE;
}

/** Lightweight client-side attribution for a continuation opened from an exported PDF. */
export function trackPdfContinuation(action: PdfContinuationAction): void {
  if (typeof window === 'undefined') return;
  const event: PdfContinuationEvent = {
    action,
    at: new Date().toISOString(),
    path: `${window.location.pathname}${window.location.search}`,
  };
  try {
    const previous = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '[]') as PdfContinuationEvent[];
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...previous.slice(-19), event]));
  } catch {
    // Tracking must never interrupt loading a student's lesson.
  }
  window.dispatchEvent(new CustomEvent('lectern:pdf-continuation', { detail: event }));
}
