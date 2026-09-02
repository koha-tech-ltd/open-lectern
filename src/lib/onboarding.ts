import type { LecternMediaId } from '@/lib/media';

export type OnboardingMode = 'teacher' | 'student';

const KEYS: Record<OnboardingMode, string> = {
  teacher: 'lectern.onboarding.teacher.v1',
  student: 'lectern.onboarding.student.v1',
};

export function hasCompletedOnboarding(mode: OnboardingMode): boolean {
  try {
    return localStorage.getItem(KEYS[mode]) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingComplete(mode: OnboardingMode): void {
  try {
    localStorage.setItem(KEYS[mode], '1');
  } catch {
    // ignore quota / private mode
  }
}

export function resetOnboarding(mode: OnboardingMode): void {
  try {
    localStorage.removeItem(KEYS[mode]);
  } catch {
    // ignore
  }
}

export const TEACHER_STEPS: ReadonlyArray<{
  title: string;
  body: string;
  media: LecternMediaId;
}> = [
  {
    title: 'A lesson is materials and tests',
    body: 'Draft what students will read and how you will check understanding. Knowledge is what they leave with.',
    media: 'draft',
  },
  {
    title: 'Pair with the WebMCP co-pilot',
    body: 'Keep this page open in ChatGPT or Chrome with WebMCP. Ask the agent to list gaps, expand sections, and add quiz items — watch attention on the page.',
    media: 'copilot',
  },
  {
    title: 'Publish a student copy',
    body: 'When the checklist is clear, publish. Students get a read-only link to mark and ask the same agent.',
    media: 'publish',
  },
];

export const STUDENT_STEPS: ReadonlyArray<{
  title: string;
  body: string;
  media: LecternMediaId;
}> = [
  {
    title: 'This is your read-only lesson',
    body: 'Materials and checks are locked. Read, try the quiz, and leave marks where you are stuck.',
    media: 'student',
  },
  {
    title: 'Leave a mark in the margin',
    body: 'Mark a section as learned, or write a note where the idea still feels fuzzy. Your marks stay on this copy.',
    media: 'mark',
  },
  {
    title: 'Ask the co-pilot on this page',
    body: 'Ask the agent to explain a section (lectern_get_section) or leave a mark. Copy reference on a material and paste it so the agent knows which section you mean. The co-pilot panel shows what it is doing.',
    media: 'copilot',
  },
];
