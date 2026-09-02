import type { Annotation, LessonDocument, QuizItem } from '@/types/lesson';

export type QuizAttemptStatus = 'unanswered' | 'correct' | 'incorrect';

export interface QuizAttempt {
  quizItemId: string;
  /** null when unanswered / skipped */
  choiceIndex: number | null;
  status: QuizAttemptStatus;
}

export type AttemptsMap = Record<string, QuizAttempt>;

export type CheerBand = 'perfect' | 'strong' | 'learning' | 'started';

export interface AttemptReviewItem {
  item: QuizItem;
  placement: 'section' | 'lesson';
  sectionId?: string;
  sectionTitle?: string;
  localIndex: number;
  attempt: QuizAttempt;
  /** Derived bucket for the results sheet */
  bucket: 'correct' | 'missed' | 'skipped';
}

export interface StudentResultsSummary {
  total: number;
  correct: number;
  missed: number;
  skipped: number;
  items: AttemptReviewItem[];
  missedOrSkipped: AttemptReviewItem[];
}

export function recordQuizAttempt(item: QuizItem, choiceIndex: number): QuizAttempt {
  return {
    quizItemId: item.id,
    choiceIndex,
    status: choiceIndex === item.answerIndex ? 'correct' : 'incorrect',
  };
}

function emptyAttempt(quizItemId: string): QuizAttempt {
  return { quizItemId, choiceIndex: null, status: 'unanswered' };
}

function bucketFor(attempt: QuizAttempt): AttemptReviewItem['bucket'] {
  if (attempt.status === 'correct') return 'correct';
  if (attempt.status === 'incorrect') return 'missed';
  return 'skipped';
}

function sortQuizItems(items: QuizItem[]): QuizItem[] {
  return [...items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Local reading-order walk (mirrors lesson.quizItemsInReadingOrder; Node-safe). */
function quizItemsInReadingOrder(lesson: LessonDocument): Array<{
  item: QuizItem;
  placement: 'section' | 'lesson';
  sectionId?: string;
  localIndex: number;
}> {
  const sectionIds = new Set(lesson.sections.map((s) => s.id));
  const out: Array<{
    item: QuizItem;
    placement: 'section' | 'lesson';
    sectionId?: string;
    localIndex: number;
  }> = [];

  const sections = [...lesson.sections].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  for (const section of sections) {
    const nested = sortQuizItems(lesson.quiz.filter((item) => item.sectionId === section.id));
    nested.forEach((item, index) => {
      out.push({ item, placement: 'section', sectionId: section.id, localIndex: index });
    });
  }

  const lessonLevel = sortQuizItems(
    lesson.quiz.filter((item) => {
      const sid = item.sectionId?.trim();
      if (!sid) return true;
      return !sectionIds.has(sid);
    }),
  );
  lessonLevel.forEach((item, index) => {
    out.push({ item, placement: 'lesson', localIndex: index });
  });

  return out;
}

/**
 * Summarize in-session attempts against the lesson quiz in reading order.
 * Missing map entries count as skipped (no export gate).
 */
export function summarizeAttempts(
  lesson: LessonDocument,
  attempts: AttemptsMap,
): StudentResultsSummary {
  const items: AttemptReviewItem[] = quizItemsInReadingOrder(lesson).map(
    ({ item, placement, sectionId, localIndex }) => {
      const attempt = attempts[item.id] ?? emptyAttempt(item.id);
      const sectionTitle =
        placement === 'section' && sectionId
          ? lesson.sections.find((s) => s.id === sectionId)?.title
          : undefined;
      return {
        item,
        placement,
        sectionId,
        sectionTitle,
        localIndex,
        attempt,
        bucket: bucketFor(attempt),
      };
    },
  );

  let correct = 0;
  let missed = 0;
  let skipped = 0;
  for (const row of items) {
    if (row.bucket === 'correct') correct += 1;
    else if (row.bucket === 'missed') missed += 1;
    else skipped += 1;
  }

  return {
    total: items.length,
    correct,
    missed,
    skipped,
    items,
    missedOrSkipped: items.filter((row) => row.bucket !== 'correct'),
  };
}

/**
 * Cheerful band for copy. Never shame: even 0 correct with attempts is "learning".
 */
export function cheerBand(summary: StudentResultsSummary): CheerBand {
  if (summary.total === 0) return 'started';
  if (summary.skipped === summary.total) return 'started';
  if (summary.correct === summary.total) return 'perfect';
  const ratio = summary.correct / summary.total;
  if (ratio >= 0.7) return 'strong';
  return 'learning';
}

export interface NoteForResults {
  annotation: Annotation;
  sectionTitle: string;
  isLearned: boolean;
}

export function notesForResults(lesson: LessonDocument): NoteForResults[] {
  return lesson.annotations.map((annotation) => {
    const section = lesson.sections.find((s) => s.id === annotation.sectionId);
    const isLearned = annotation.kind === 'learned' || annotation.note === 'Learned';
    return {
      annotation,
      sectionTitle: section?.title ?? annotation.sectionId,
      isLearned,
    };
  });
}

export function stripPromptForPdf(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/^>\s*/gm, '')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, math: string) => `[ ${math.trim()} ]`)
    .replace(/\$([^$\n]+)\$/g, (_, math: string) => math.trim())
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
