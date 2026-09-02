import type { LessonMode } from '@/types/lesson';

export const SECTION_REFERENCE_TOKEN = 'LECTERN_SECTION';
export const QUIZ_REFERENCE_TOKEN = 'LECTERN_QUIZ';

export type SectionReferenceInput = {
  sectionId: string;
  title: string;
  kind: string;
  mode: LessonMode;
  lesson: string;
  instructions: string;
};

/**
 * Stable, pasteable pointer to one manuscript section.
 * Field names stay English so an agent can parse them in any UI language,
 * then call lectern_get_section with the sectionId.
 */
export function buildSectionReference(input: SectionReferenceInput): string {
  const sectionId = input.sectionId.trim();
  const title = input.title.trim() || '(untitled section)';
  const kind = input.kind.trim() || 'material';
  const lesson = input.lesson.trim() || '(untitled)';
  const instructions = input.instructions.trim();
  return [
    SECTION_REFERENCE_TOKEN,
    `sectionId: ${sectionId}`,
    `title: ${title}`,
    `kind: ${kind}`,
    `mode: ${input.mode}`,
    `lesson: ${lesson}`,
    '',
    instructions,
  ].join('\n');
}

/** Pull a section id from a pasted LECTERN_SECTION block or a bare id. */
export function parseSectionIdFromReference(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const labeled = trimmed.match(/(?:^|\n)\s*sectionId:\s*(\S+)/i);
  if (labeled?.[1]) return labeled[1].replace(/^["']|["']$/g, '');
  const quoted = trimmed.match(/lectern_get_section[^\n]*sectionId\s*=\s*["']([^"']+)["']/i);
  if (quoted?.[1]) return quoted[1];
  if (/^[A-Za-z0-9._:-]+$/.test(trimmed)) return trimmed;
  return null;
}

export type QuizReferenceInput = {
  quizId: string;
  label: string;
  prompt: string;
  mode: LessonMode;
  lesson: string;
  sectionId?: string;
  instructions: string;
};

/**
 * Stable pointer to one check (Q1, Q2, …). Agents look it up from
 * lectern_get_lesson (and lectern_get_section when nested).
 */
export function buildQuizReference(input: QuizReferenceInput): string {
  const quizId = input.quizId.trim();
  const label = input.label.trim() || 'Q';
  const prompt = input.prompt.trim().replace(/\s+/g, ' ').slice(0, 160) || '(untitled check)';
  const lesson = input.lesson.trim() || '(untitled)';
  const sectionId = input.sectionId?.trim();
  const lines = [
    QUIZ_REFERENCE_TOKEN,
    `quizId: ${quizId}`,
    `label: ${label}`,
    `prompt: ${prompt}`,
  ];
  if (sectionId) lines.push(`sectionId: ${sectionId}`);
  lines.push(`mode: ${input.mode}`, `lesson: ${lesson}`, '', input.instructions.trim());
  return lines.join('\n');
}

export function parseQuizIdFromReference(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const labeled = trimmed.match(/(?:^|\n)\s*quizId:\s*(\S+)/i);
  if (labeled?.[1]) return labeled[1].replace(/^["']|["']$/g, '');
  const quoted = trimmed.match(/quizId\s*=\s*["']([^"']+)["']/i);
  if (quoted?.[1]) return quoted[1];
  return null;
}
