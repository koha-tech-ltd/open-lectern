import { nowIso } from './lesson';
import { embedLessonMedia } from './embed-lesson-media';
import type { LessonDocument } from '../types/lesson';

export const LECTERN_FILE_FORMAT = 'lectern/1';

export interface LecternFileDocument {
  format: typeof LECTERN_FILE_FORMAT;
  exportedAt: string;
  lesson: LessonDocument;
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

export function lecternFilename(title: string): string {
  return `${safeFilename(title)}.lectern`;
}

export function buildLecternFile(lesson: LessonDocument): LecternFileDocument {
  return {
    format: LECTERN_FILE_FORMAT,
    exportedAt: nowIso(),
    lesson: {
      ...lesson,
      annotations: [],
    },
  };
}

export function serializeLecternFile(lesson: LessonDocument): string {
  return `${JSON.stringify(buildLecternFile(lesson), null, 2)}\n`;
}

export async function downloadLecternFile(
  lesson: LessonDocument,
): Promise<{ warnings: string[]; embeddedCount: number }> {
  const { lesson: embedded, warnings, embeddedCount } = await embedLessonMedia(lesson);
  const body = serializeLecternFile(embedded);
  const blob = new Blob([body], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lecternFilename(lesson.meta.title);
  a.click();
  URL.revokeObjectURL(url);
  return { warnings, embeddedCount };
}

export function parseLecternFile(raw: string): LessonDocument | null {
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<LecternFileDocument>;
    if (parsed?.format !== LECTERN_FILE_FORMAT || !parsed.lesson) return null;
    const lesson = parsed.lesson;
    if (!lesson.meta || !Array.isArray(lesson.sections) || !Array.isArray(lesson.quiz)) {
      return null;
    }
    return {
      ...lesson,
      annotations: Array.isArray(lesson.annotations) ? lesson.annotations : [],
    };
  } catch {
    return null;
  }
}
