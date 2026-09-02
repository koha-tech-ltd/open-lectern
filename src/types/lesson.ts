export type SectionMediaKind = 'image' | 'video';

export interface SectionMedia {
  id: string;
  kind: SectionMediaKind;
  /** Public path, remote URL, data: URL, or cas:sha256:… handle */
  src: string;
  /** AMDP content-addressed URI when bytes are in this tab’s CAS */
  cas?: string;
  /** Original URL/path before export inlined bytes into src */
  originSrc?: string;
  alt: string;
  caption?: string;
  name?: string;
}

export type LessonMode = 'teacher' | 'student';

export type SectionKind = 'material' | 'example' | 'summary' | (string & {});

export interface LessonSection {
  id: string;
  kind: SectionKind;
  title: string;
  body: string;
  order: number;
  media?: SectionMedia[];
}

export interface QuizItem {
  id: string;
  prompt: string;
  choices: string[];
  /** Optional visual card for each choice, aligned by choice index. */
  choiceMedia?: Array<SectionMedia | null>;
  /** 0-based index of the correct choice */
  answerIndex: number;
  explanation: string;
  order: number;
  /**
   * When set to a known section id, render after that section.
   * Omit for the end-of-lesson quiz. Unknown ids are treated as lesson-level on read.
   */
  sectionId?: string;
}

export interface Annotation {
  id: string;
  sectionId: string;
  note: string;
  kind?: 'learned' | 'note';
  createdAt: string;
}

export interface LessonMeta {
  title: string;
  audience: string;
  objectives: string[];
  subject: string;
}

export interface LessonDocument {
  id: string;
  version: number;
  published: boolean;
  meta: LessonMeta;
  sections: LessonSection[];
  quiz: QuizItem[];
  annotations: Annotation[];
  updatedAt: string;
}

export interface LessonGap {
  code: string;
  severity: 'warning' | 'blocker';
  message: string;
  count?: number;
}
