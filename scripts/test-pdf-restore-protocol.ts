/**
 * Smoke test: LECTERN_PDF/v1 dense text extract + embedded PDF attachment roundtrip.
 * Run: npm run test:pdf-restore
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { jsPDF } from 'jspdf';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import {
  extractPayloadFromPdfText,
  flattenPackForInvisibleWrite,
  formatPdfSystemIntro,
  LECTERN_RESTORE_ATTACH,
  PDF_DENSE_LINE_WIDTH,
  splitPayloadForPdfPages,
} from '../src/lib/pdf-restore-protocol.ts';

function buildAttachmentRestoreMeta(lessonId: string, title: string, payloadBytes: number) {
  return {
    v: 1 as const,
    id: lessonId,
    title,
    parts: 0,
    bytes: payloadBytes,
    magic: 'LCT1' as const,
    attach: LECTERN_RESTORE_ATTACH,
  };
}

const require = createRequire(import.meta.url);
GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).href;

const RESTORE_MAGIC = 'LCT1';

function bytesToBinary(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    const slice = bytes.subarray(i, i + 0x8000);
    let chunk = '';
    for (let j = 0; j < slice.length; j += 1) chunk += String.fromCharCode(slice[j]);
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
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function lessonToRestorePayload(lesson: object): string {
  const json = JSON.stringify({ ...lesson, published: true, annotations: [] });
  const deflated = deflateSync(strToU8(json), { level: 9 });
  return `${RESTORE_MAGIC}.${toBase64Url(deflated)}`;
}

function inflatePayload(payload: string): {
  meta: { title: string };
  sections: Array<{ media?: Array<{ src: string }> }>;
  quiz: Array<{ answerIndex: number }>;
} {
  const body = payload.slice(RESTORE_MAGIC.length + 1);
  const bytes = fromBase64Url(body);
  return JSON.parse(strFromU8(inflateSync(bytes))) as ReturnType<typeof inflatePayload>;
}

const lesson = {
  id: 'test-lesson',
  meta: { title: 'Roundtrip', subject: 'Bio', audience: 'G9', objectives: ['Learn X'] },
  sections: [
    {
      id: 's1',
      kind: 'material',
      title: 'Photosynthesis',
      body: 'Plants convert light.',
      order: 0,
      media: [
        {
          id: 'm1',
          kind: 'image',
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          alt: 'pixel',
        },
      ],
    },
  ],
  quiz: [
    {
      id: 'q1',
      prompt: 'What is produced?',
      choices: ['O2', 'N2'],
      answerIndex: 0,
      explanation: 'Oxygen is the exhaust.',
      order: 0,
    },
  ],
  annotations: [],
  updatedAt: new Date().toISOString(),
  published: false,
};

const blob = Buffer.from(Array.from({ length: 80000 }, (_, i) => (i * 17 + 31) & 0xff)).toString('base64');
lesson.sections[0].media[0].src = `data:image/png;base64,${blob}`;

const payload = lessonToRestorePayload(lesson);
const pack = splitPayloadForPdfPages(payload, lesson.id, lesson.meta.title);

function assertExtracted(label: string, extracted: string | null, expected = payload) {
  if (!extracted) throw new Error(`${label}: extract failed`);
  if (extracted !== expected) {
    throw new Error(
      `${label}: payload mismatch (got ${extracted.length} chars, expected ${expected.length})`,
    );
  }
}

assertExtracted(
  'clean-lesson-text',
  extractPayloadFromPdfText(
    [...formatPdfSystemIntro(pack.meta), '', ...flattenPackForInvisibleWrite(pack)].join('\n'),
  ),
);

const restored = inflatePayload(payload);
if (restored.meta.title !== lesson.meta.title) throw new Error('title mismatch');
if (restored.sections[0].media?.[0]?.src !== lesson.sections[0].media[0].src) {
  throw new Error('data URL media not preserved');
}

const multiPayload = `LCT1.${'Ab0_-Xy9'.repeat(2500)}`;
const attachMeta = buildAttachmentRestoreMeta('lesson_probe', 'Photosynthesis', multiPayload.length);
const doc = new jsPDF();
doc.text('Lesson placeholder', 48, 72);
doc.addPage();
let y = 40;
for (const line of formatPdfSystemIntro(attachMeta)) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(line, 24, y);
  y += 10;
}
const rawPdf = new Uint8Array(doc.output('arraybuffer'));
const pdfDoc = await PDFDocument.load(rawPdf);
await pdfDoc.attach(new TextEncoder().encode(multiPayload), LECTERN_RESTORE_ATTACH, {
  mimeType: 'application/octet-stream',
});
const embedded = await pdfDoc.save();
const pdf = await getDocument({ data: embedded }).promise;
const attachments = await pdf.getAttachments();
const file = attachments?.[LECTERN_RESTORE_ATTACH];
if (!file?.content) throw new Error('attachment missing');
const attachmentText = new TextDecoder().decode(
  file.content instanceof Uint8Array ? file.content : new Uint8Array(file.content),
);
if (attachmentText !== multiPayload) {
  throw new Error(`attachment payload mismatch (${attachmentText.length} vs ${multiPayload.length})`);
}
if (pdf.numPages > attachMeta.parts + 3) {
  throw new Error(`too many pages for attachment export: ${pdf.numPages}`);
}

console.log('OK: LECTERN_PDF/v1 roundtrip', {
  lessonPayloadChars: payload.length,
  attachmentBytes: multiPayload.length,
  pdfPages: pdf.numPages,
  lineWidth: PDF_DENSE_LINE_WIDTH,
  mediaPreserved: true,
});
