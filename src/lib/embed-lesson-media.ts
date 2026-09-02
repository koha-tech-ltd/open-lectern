import { resolveMediaSrc } from './section-media';
import type { LessonDocument, SectionMedia } from '../types/lesson';

export interface EmbedLessonMediaResult {
  lesson: LessonDocument;
  embeddedCount: number;
  warnings: string[];
}

function cloneMedia(media: SectionMedia): SectionMedia {
  return { ...media };
}

function cloneLesson(lesson: LessonDocument): LessonDocument {
  return {
    ...lesson,
    meta: { ...lesson.meta, objectives: [...lesson.meta.objectives] },
    sections: lesson.sections.map((section) => ({
      ...section,
      media: section.media?.map(cloneMedia),
    })),
    quiz: lesson.quiz.map((item) => ({
      ...item,
      choices: [...item.choices],
      choiceMedia: item.choiceMedia?.map((entry) => (entry ? cloneMedia(entry) : null)),
    })),
    annotations: [...lesson.annotations],
  };
}

async function embedSectionMedia(media: SectionMedia, warnings: string[]): Promise<SectionMedia> {
  if (media.src.startsWith('data:')) return media;
  const resolved = await resolveMediaSrc(media.src, media.kind);
  if (!resolved.ok) {
    warnings.push(`${media.alt || media.name || 'Media'}: ${resolved.error}`);
    return media;
  }
  return {
    ...media,
    src: resolved.src,
    originSrc: media.originSrc ?? media.src,
  };
}

/** Clone lesson and inline path/URL media as data URLs for self-contained export/restore. */
export async function embedLessonMedia(lesson: LessonDocument): Promise<EmbedLessonMediaResult> {
  const cloned = cloneLesson(lesson);
  const warnings: string[] = [];
  let embeddedCount = 0;

  for (const section of cloned.sections) {
    if (!section.media?.length) continue;
    section.media = await Promise.all(
      section.media.map(async (item) => {
        if (item.src.startsWith('data:')) return item;
        const next = await embedSectionMedia(item, warnings);
        if (next.src !== item.src) embeddedCount += 1;
        return next;
      }),
    );
  }

  for (const item of cloned.quiz) {
    if (!item.choiceMedia?.length) continue;
    item.choiceMedia = await Promise.all(
      item.choiceMedia.map(async (entry) => {
        if (!entry || entry.src.startsWith('data:')) return entry;
        const next = await embedSectionMedia(entry, warnings);
        if (next.src !== entry.src) embeddedCount += 1;
        return next;
      }),
    );
  }

  return { lesson: cloned, embeddedCount, warnings };
}
