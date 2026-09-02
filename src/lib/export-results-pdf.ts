import { jsPDF } from 'jspdf';
import { downloadPdfBytes } from '@/lib/pdf-restore-attach';
import { SITE_URL } from '@/lib/lesson';
import {
  cheerBand,
  notesForResults,
  stripPromptForPdf,
  summarizeAttempts,
  type AttemptsMap,
  type CheerBand,
  type StudentResultsSummary,
} from '@/lib/student-results';
import type { LessonDocument } from '@/types/lesson';

const PDF_FONT_FAMILY = 'LecternText';

type PdfFontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

const TYPE = {
  body: 13,
  bodyLine: 20,
  heading: 18,
  headingLine: 24,
  kicker: 11,
  caption: 11,
  captionLine: 16,
  footer: 9,
  title: 26,
  titleLine: 32,
  banner: 14,
  bannerLine: 20,
} as const;

/** Localized strings for the results sheet (passed from UI). */
export interface StudentResultsPdfCopy {
  forTeacher: string;
  scoreLabel: string;
  cheer: Record<CheerBand, string>;
  missedHeading: string;
  allCorrectHeading: string;
  skippedLabel: string;
  yourAnswer: string;
  correctAnswer: string;
  nestedLabel: string;
  endLabel: string;
  notesHeading: string;
  noNotes: string;
  learnedLabel: string;
  studentLabel: string;
  dateLabel: string;
  handoffFooter: string;
  countsLine: (s: { correct: number; missed: number; skipped: number; total: number }) => string;
}

export interface ExportStudentResultsPdfInput {
  lesson: LessonDocument;
  attempts: AttemptsMap;
  studentName?: string;
  copy: StudentResultsPdfCopy;
}

function setType(doc: jsPDF, size: number, style: PdfFontStyle = 'normal'): void {
  doc.setFont(PDF_FONT_FAMILY, style);
  doc.setFontSize(size);
}

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

function safeFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || 'lesson';
}

function dateStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  margin: number,
  stampPage?: () => void,
  style: PdfFontStyle = 'normal',
): number {
  const prepared = stripPromptForPdf(text);
  if (!prepared) return y;
  const lines = doc.splitTextToSize(prepared, maxWidth) as string[];
  let cursor = y;
  for (const line of lines) {
    cursor = ensureSpace(doc, cursor, lineHeight, margin, stampPage);
    setType(doc, doc.getFontSize(), style);
    doc.text(line, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

function siteHostLabel(): string {
  return SITE_URL.replace(/^https?:\/\//, '');
}

function drawFooter(doc: jsPDF, page: number, handoff: string): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  setType(doc, TYPE.footer, 'normal');
  doc.setTextColor(92, 58, 33);
  const prefix = 'Lectern · ';
  doc.text(prefix, 48, pageH - 28);
  doc.textWithLink(siteHostLabel(), 48 + doc.getTextWidth(prefix), pageH - 28, { url: SITE_URL });
  doc.text(`${page}`, pageW - 48, pageH - 28, { align: 'right' });
  setType(doc, TYPE.footer, 'italic');
  doc.setTextColor(110, 90, 70);
  doc.text(handoff, 48, pageH - 16);
}

/**
 * Build and download a printable student→teacher results PDF.
 * No LCT1 restore; no inverted answer key.
 */
export async function exportStudentResultsPdf(
  input: ExportStudentResultsPdfInput,
): Promise<{ filename: string; summary: StudentResultsSummary; band: CheerBand }> {
  const { lesson, attempts, copy } = input;
  const studentName = input.studentName?.trim() || '';
  const summary = summarizeAttempts(lesson, attempts);
  const band = cheerBand(summary);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  await loadPdfReadingFonts(doc);

  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  const pageCounter = { value: 1 };

  const stamp = () => {
    drawFooter(doc, pageCounter.value, copy.handoffFooter);
  };

  stamp();
  let y = margin;

  setType(doc, TYPE.kicker, 'bold');
  doc.setTextColor(36, 56, 44);
  doc.text(copy.forTeacher.toUpperCase(), margin, y);
  y += TYPE.captionLine + 8;

  setType(doc, TYPE.title, 'bold');
  doc.setTextColor(28, 36, 32);
  y = writeWrapped(doc, lesson.meta.title || 'Lesson', margin, y, contentW, TYPE.titleLine, margin, () => {
    pageCounter.value += 1;
    stamp();
  });
  y += 8;

  setType(doc, TYPE.caption, 'normal');
  doc.setTextColor(92, 58, 33);
  if (studentName) {
    doc.text(`${copy.studentLabel}: ${studentName}`, margin, y);
    y += TYPE.captionLine;
  }
  doc.text(`${copy.dateLabel}: ${dateStamp()}`, margin, y);
  y += TYPE.captionLine + 12;

  doc.setFillColor(236, 245, 238);
  doc.roundedRect(margin, y, contentW, 72, 6, 6, 'F');
  setType(doc, TYPE.heading, 'bold');
  doc.setTextColor(36, 56, 44);
  doc.text(copy.scoreLabel, margin + 16, y + 24);
  setType(doc, TYPE.title, 'bold');
  doc.text(
    summary.total === 0 ? '—' : `${summary.correct} / ${summary.total}`,
    margin + 16,
    y + 52,
  );
  y += 88;

  setType(doc, TYPE.caption, 'normal');
  doc.setTextColor(92, 58, 33);
  doc.text(copy.countsLine(summary), margin, y);
  y += TYPE.captionLine + 10;

  setType(doc, TYPE.banner, 'italic');
  doc.setTextColor(36, 56, 44);
  y = writeWrapped(doc, copy.cheer[band], margin, y, contentW, TYPE.bannerLine, margin, () => {
    pageCounter.value += 1;
    stamp();
  });
  y += 20;

  y = ensureSpace(doc, y, 40, margin, () => {
    pageCounter.value += 1;
    stamp();
  });
  setType(doc, TYPE.heading, 'bold');
  doc.setTextColor(28, 36, 32);
  const reviewHeading =
    summary.missedOrSkipped.length === 0 && summary.total > 0
      ? copy.allCorrectHeading
      : copy.missedHeading;
  doc.text(reviewHeading, margin, y);
  y += TYPE.headingLine + 4;

  if (summary.missedOrSkipped.length === 0) {
    if (summary.total === 0) {
      setType(doc, TYPE.body, 'italic');
      doc.setTextColor(92, 58, 33);
      y = writeWrapped(doc, copy.cheer.started, margin, y, contentW, TYPE.bodyLine, margin, () => {
        pageCounter.value += 1;
        stamp();
      });
    }
  } else {
    let reviewIndex = 0;
    for (const row of summary.missedOrSkipped) {
      reviewIndex += 1;
      y = ensureSpace(doc, y, 56, margin, () => {
        pageCounter.value += 1;
        stamp();
      });

      const place =
        row.placement === 'section'
          ? `${copy.nestedLabel}${row.sectionTitle ? ` · ${row.sectionTitle}` : ''}`
          : copy.endLabel;

      setType(doc, TYPE.kicker, 'bold');
      doc.setTextColor(110, 90, 70);
      doc.text(`${reviewIndex}. ${place}`, margin, y);
      y += TYPE.captionLine;

      setType(doc, TYPE.body, 'normal');
      doc.setTextColor(28, 36, 32);
      y = writeWrapped(
        doc,
        stripPromptForPdf(row.item.prompt),
        margin,
        y,
        contentW,
        TYPE.bodyLine,
        margin,
        () => {
          pageCounter.value += 1;
          stamp();
        },
      );
      y += 4;

      const studentChoice =
        row.bucket === 'skipped' || row.attempt.choiceIndex === null
          ? copy.skippedLabel
          : stripPromptForPdf(row.item.choices[row.attempt.choiceIndex] ?? copy.skippedLabel);
      const correctChoice = stripPromptForPdf(row.item.choices[row.item.answerIndex] ?? '');

      setType(doc, TYPE.caption, 'normal');
      doc.setTextColor(92, 58, 33);
      y = writeWrapped(
        doc,
        `${copy.yourAnswer}: ${studentChoice}`,
        margin,
        y,
        contentW,
        TYPE.captionLine,
        margin,
        () => {
          pageCounter.value += 1;
          stamp();
        },
      );
      y = writeWrapped(
        doc,
        `${copy.correctAnswer}: ${correctChoice}`,
        margin,
        y,
        contentW,
        TYPE.captionLine,
        margin,
        () => {
          pageCounter.value += 1;
          stamp();
        },
        'bold',
      );
      y += 14;
    }
  }

  y = ensureSpace(doc, y, 48, margin, () => {
    pageCounter.value += 1;
    stamp();
  });
  setType(doc, TYPE.heading, 'bold');
  doc.setTextColor(28, 36, 32);
  doc.text(copy.notesHeading, margin, y);
  y += TYPE.headingLine + 4;

  const notes = notesForResults(lesson);
  if (notes.length === 0) {
    setType(doc, TYPE.body, 'italic');
    doc.setTextColor(92, 58, 33);
    y = writeWrapped(doc, copy.noNotes, margin, y, contentW, TYPE.bodyLine, margin, () => {
      pageCounter.value += 1;
      stamp();
    });
  } else {
    for (const note of notes) {
      y = ensureSpace(doc, y, 40, margin, () => {
        pageCounter.value += 1;
        stamp();
      });
      setType(doc, TYPE.kicker, 'bold');
      doc.setTextColor(110, 90, 70);
      doc.text(note.sectionTitle, margin, y);
      y += TYPE.captionLine;
      setType(doc, TYPE.body, 'normal');
      doc.setTextColor(28, 36, 32);
      const body = note.isLearned ? copy.learnedLabel : note.annotation.note;
      y = writeWrapped(doc, body, margin, y, contentW, TYPE.bodyLine, margin, () => {
        pageCounter.value += 1;
        stamp();
      });
      y += 10;
    }
  }

  const filename = `Lectern-results-${safeFilename(lesson.meta.title)}-${dateStamp()}.pdf`;
  const bytes = doc.output('arraybuffer');
  downloadPdfBytes(new Uint8Array(bytes), filename);
  return { filename, summary, band };
}
