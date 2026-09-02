import { useEffect, useRef, useState } from 'react';
import type { LessonStore } from '@/hooks/useLessonStore';
import {
  checkoutActivity,
  checkoutActivityHead,
  getActivityForAgent,
  listActivityForAgent,
  wrapToolExecute,
} from '@/lib/agent-activity';
import {
  htmlLangFor,
  isLocaleCode,
  LOCALE_LABELS,
  localeTextDir,
  normalizeLocale,
  SUPPORTED_LOCALES,
} from '@/i18n/locales';
import { getUiLocale, setUiLocale } from '@/i18n/locale-store';
import { translate } from '@/i18n/catalogs';
import {
  DEMO_LESSON_IDS,
  isDemoLessonId,
  LECTERN_DEMO_IDS,
  SITE_URL,
  type LecternDemoId,
} from '@/lib/lesson';
import { conversionLecternExported } from '@/lib/product-events';
import { AMDP_INTAKE_RANKS, CHUNKED_MEDIA_HINT } from '@/lib/webmcp-catalog';
import { isWebMcpAvailable, registerTools, toolText, unregisterTools } from '@/lib/webmcp';
import { parseSectionIdFromReference } from '@/lib/section-reference';
import { normalizeSectionKind } from '@/lib/section-kind';
import { mediaUploadRegistry } from '@/lib/webmcp-media-upload';
import { lecternAmdp, compressAmdpRaster, rasterNeedsCompress, LECTERN_MAX_IMAGE_BYTES } from '@/lib/amdp-lectern';
import type { ModelContextTool, ToolExecuteCallback } from '@/types/webmcp';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function withActivity(tool: string, execute: ToolExecuteCallback): ToolExecuteCallback {
  return async (args) => wrapToolExecute(tool, args ?? {}, () => execute(args ?? {}));
}

async function persistIllustration(
  store: LessonStore,
  sectionId: string,
  src: string,
  alt: string,
  caption?: string,
) {
  const { urlToPersistedSectionMedia } = await import('@/lib/section-media');
  const built = await urlToPersistedSectionMedia(src, 'image', alt);
  if (!built.ok) return built;
  if (/\.svg(?:\?|$)/i.test(built.media.src) || built.media.src.startsWith('data:image/svg')) {
    return { ok: false as const, error: 'Use lectern_generate_section_media for SVG explainers; this tool requires a raster illustration.' };
  }
  built.media.name = `${built.media.name?.replace(/\.[^.]+$/, '') || 'illustration'}-ai.png`;
  const label = (caption ?? built.media.alt).trim();
  built.media.caption = `${label} Image created or edited with AI.`.trim();
  return store.addSectionMedia(sectionId, built.media);
}

async function persistSectionMedia(
  store: LessonStore,
  sectionId: string,
  src: string,
  kind: 'image' | 'video',
  alt: string,
  caption?: string,
) {
  const { urlToPersistedSectionMedia } = await import('@/lib/section-media');
  const built = await urlToPersistedSectionMedia(src, kind, alt);
  if (!built.ok) return built;
  if (caption?.trim()) built.media.caption = caption.trim();
  return store.addSectionMedia(sectionId, built.media);
}

async function persistQuizChoiceMedia(
  store: LessonStore,
  quizId: string,
  choiceIndex: number,
  src: string,
  alt: string,
) {
  const quiz = store.getLiveLesson().quiz.find((item) => item.id === quizId);
  if (!quiz) return { ok: false as const, error: 'Quiz item not found.' };
  if (choiceIndex < 0 || choiceIndex >= quiz.choices.length) {
    return { ok: false as const, error: 'choiceIndex must point at an existing answer choice.' };
  }
  const { urlToPersistedSectionMedia } = await import('@/lib/section-media');
  const built = await urlToPersistedSectionMedia(src, 'image', alt);
  if (!built.ok) return built;
  if (/\.svg(?:\?|$)/i.test(built.media.src) || built.media.src.startsWith('data:image/svg')) {
    return { ok: false as const, error: 'Quiz answer cards need a raster image, not an SVG schematic.' };
  }
  built.media.name = `${built.media.name?.replace(/\.[^.]+$/, '') || `choice-${choiceIndex + 1}`}-ai.png`;
  built.media.caption = 'Image created or edited with AI.';
  const choiceMedia = [...(quiz.choiceMedia ?? [])];
  choiceMedia[choiceIndex] = built.media;
  return store.upsertQuizItem({ ...quiz, choiceMedia });
}

async function persistBoundMedia(
  store: LessonStore,
  purpose: 'illustration' | 'section' | 'quiz-choice',
  src: string,
  kind: 'image' | 'video',
  alt: string,
  caption: string | undefined,
  sectionId: string,
  quizId: string,
  choiceIndex: number,
) {
  if (purpose === 'illustration') {
    if (kind !== 'image') {
      return { ok: false as const, error: 'purpose=illustration requires a raster image, not video.' };
    }
    return persistIllustration(store, sectionId, src, alt, caption);
  }
  if (purpose === 'quiz-choice') {
    if (kind !== 'image') {
      return { ok: false as const, error: 'Quiz answer cards need a raster image, not video.' };
    }
    return persistQuizChoiceMedia(store, quizId, choiceIndex, src, alt);
  }
  return persistSectionMedia(store, sectionId, src, kind, alt || 'Lesson media', caption);
}

const LOCALE_LIST = SUPPORTED_LOCALES.join(', ');

const SHARE_HINTS = {
  student:
    'Export a Lectern PDF from the Export panel. Students upload it in Save & load to study.',
  teacher:
    'Download a .lectern file to keep writing. Teacher mode reopens from a Lectern file, not from the PDF.',
} as const;

const IMPORT_RESTORE_DESCRIPTION =
  'Load a lesson from a Lectern PDF (upload in UI reads LECTERN_PDF/v1 system pages), LCT1 payload, legacy QR sheet lines, or .lectern JSON. Pass the full LCT1.… payload, LECTERN_PDF/v1 text blocks, raw JSON, or newline-joined legacy QR lines (LCT1|i/n|id|chunk). A .lectern file opens teacher (authoring). PDF / LCT1 restore opens student mode and does not reopen the teacher tab — switching to teacher shows this device’s draft or an empty page, not the PDF lesson. To keep writing, load a .lectern file.';

const DEMO_TITLES: Record<LecternDemoId, string> = {
  photosynthesis: 'Photosynthesis',
  webmcp: 'WebMCP explained',
  cossacks: 'Ukrainian Cossacks',
};

function libraryPayload(store: LessonStore) {
  const lesson = store.getLiveLesson();
  const yours = store
    .getLiveLibraryItems()
    .filter((item) => !isDemoLessonId(item.id) && (!item.sparse || item.id === lesson.id))
    .map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      current: item.id === lesson.id,
      sparse: item.sparse,
    }));
  const demos = LECTERN_DEMO_IDS.map((demoId) => ({
    demoId,
    id: DEMO_LESSON_IDS[demoId],
    title: DEMO_TITLES[demoId],
    current: lesson.id === DEMO_LESSON_IDS[demoId],
  }));
  return {
    currentId: lesson.id,
    currentTitle: lesson.meta.title.trim() || 'Untitled lesson',
    yours,
    demos,
    hint: 'Switch working materials with lectern_switch_lesson (id from yours, or demoId photosynthesis|webmcp|cossacks). Start blank with lectern_new_lesson (current stays in Your materials). Persist and download .lectern with lectern_save_lesson. Load a file payload with lectern_import_restore.',
  };
}

function localePayload(locale: ReturnType<typeof getUiLocale>) {
  return {
    locale,
    label: LOCALE_LABELS[locale],
    dir: localeTextDir(locale),
    htmlLang: htmlLangFor(locale),
    supported: SUPPORTED_LOCALES.map((code) => ({
      locale: code,
      label: LOCALE_LABELS[code],
      dir: localeTextDir(code),
    })),
  };
}

function buildTools(store: LessonStore): ModelContextTool[] {
  const localeTools: ModelContextTool[] = [
    {
      name: 'lectern_list_locales',
      title: 'List UI languages',
      description:
        'List Lectern interface languages (flags in the header). Includes Arabic RTL. Russian is not supported. Does not translate lesson content.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_list_locales', async () =>
        toolText(localePayload(getUiLocale())),
      ),
    },
    {
      name: 'lectern_get_locale',
      title: 'Get UI language',
      description:
        'Return the current Lectern interface language, text direction (ltr/rtl), and the supported locale list.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_get_locale', async () => {
        const locale = getUiLocale();
        return toolText({
          ...localePayload(locale),
          message: translate(locale, 'language.current', {
            label: LOCALE_LABELS[locale],
            locale,
            dir: localeTextDir(locale),
          }),
        });
      }),
    },
    {
      name: 'lectern_set_locale',
      title: 'Set UI language',
      description: `Change the Lectern chrome language (header, buttons, onboarding, co-pilot). Does not rewrite lesson manuscript content. Supported: ${LOCALE_LIST}. Arabic (ar) switches the page to RTL. Russian is not available.`,
      inputSchema: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            description: `Locale code: ${LOCALE_LIST}`,
          },
        },
        required: ['locale'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_set_locale', async (args) => {
        const raw = asString(args.locale).trim();
        if (!raw) return toolText({ ok: false, error: 'locale is required' });
        if (/^ru\b/i.test(raw)) {
          const current = getUiLocale();
          return toolText({
            ok: false,
            error: translate(current, 'language.unknown', { list: LOCALE_LIST }),
          });
        }
        if (!isLocaleCode(raw) && normalizeLocale(raw) === 'en' && !/^en\b/i.test(raw)) {
          const current = getUiLocale();
          return toolText({
            ok: false,
            error: translate(current, 'language.unknown', { list: LOCALE_LIST }),
          });
        }
        const locale = isLocaleCode(raw) ? raw : normalizeLocale(raw);
        setUiLocale(locale);
        return toolText({
          ok: true,
          ...localePayload(locale),
          message: translate(locale, 'language.changed', {
            label: LOCALE_LABELS[locale],
            locale,
          }),
        });
      }),
    },
  ];

  const common: ModelContextTool[] = [
    ...localeTools,
    {
      name: 'lectern_get_lesson',
      title: 'Get lesson',
      description:
        'Return the full Lectern lesson document: meta, sections (each has kind: built-in material/example/summary or a custom short label), quiz items, gaps, mode, and annotations. Use this before editing or answering student questions. Do not scrape the DOM; tool descriptions are the how-to (rasters/video: lectern_offer_media). Users may paste a LECTERN_QUIZ reference copied from Q1/Q2 — extract quizId and use that item.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_get_lesson', async () =>
        toolText({
          mode: store.getLiveMode(),
          lesson: store.getLiveLesson(),
          gaps: store.getLiveGaps(),
          studioUrl: `${SITE_URL}/studio`,
          share: SHARE_HINTS,
        }),
      ),
    },
    {
      name: 'lectern_list_gaps',
      title: 'List lesson gaps',
      description:
        'Analyze whether the lesson is complete enough to teach: title, objectives, materials, and tests. Prefer fixing blockers before publish. Pair-write on the page; do not dump a worksheet in chat.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_list_gaps', async () =>
        toolText({
          gaps: store.getLiveGaps(),
          readyToPublish: store.getLiveGaps().every((g) => g.severity !== 'blocker'),
        }),
      ),
    },
    {
      name: 'lectern_list_activity',
      title: 'List co-pilot activity',
      description:
        'List the co-pilot activity history on this tab (newest first): agent tool calls and teacher edits, with ids for lectern_get_activity / lectern_restore_activity. Does not add a card to the log. Use this instead of scraping the co-pilot panel.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max cards to return (default 40, max 100)',
          },
        },
        additionalProperties: false,
      },
      execute: withActivity('lectern_list_activity', async (args) =>
        toolText(listActivityForAgent(typeof args.limit === 'number' ? args.limit : 40)),
      ),
    },
    {
      name: 'lectern_get_activity',
      title: 'Get one activity card',
      description:
        'Fetch one co-pilot history card by id from lectern_list_activity, including folded AMDP/json-chunk steps when present.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Activity event id from lectern_list_activity' },
        },
        required: ['eventId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_get_activity', async (args) =>
        toolText(getActivityForAgent(asString(args.eventId))),
      ),
    },
    {
      name: 'lectern_get_section',
      title: 'Get section',
      description:
        'Fetch one lesson section by id (title, body, kind, media) and any nested quiz checks for that section so the agent can answer grounded questions without inventing content. kind may be a built-in role or a custom label the teacher defined. Users may paste a LECTERN_SECTION reference copied from a material — extract sectionId from that block and call this tool.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'Section id from lectern_get_lesson, or from a pasted LECTERN_SECTION reference' },
        },
        required: ['sectionId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_get_section', async (args) => {
        const raw = asString(args.sectionId);
        const sectionId = parseSectionIdFromReference(raw) ?? raw.trim();
        return toolText(store.getSection(sectionId));
      }),
    },
    {
      name: 'lectern_set_mode',
      title: 'Set Lectern mode',
      description: 'Switch between teacher (authoring) and student (read-only + annotations) modes.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['teacher', 'student'],
            description: 'teacher = edit materials/tests; student = read + annotate',
          },
        },
        required: ['mode'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_set_mode', async (args) => {
        const mode = asString(args.mode);
        if (mode !== 'teacher' && mode !== 'student') {
          return toolText({ ok: false, error: 'mode must be teacher or student' });
        }
        store.setMode(mode);
        return toolText({ ok: true, mode });
      }),
    },
  ];

  const teacherTools: ModelContextTool[] = [
    {
      name: 'lectern_restore_activity',
      title: 'Restore lesson from a history card',
      description:
        'Check out a past co-pilot card and load that lesson snapshot into the teacher manuscript (same as tapping Restore on the card). Later cards stay until the next edit. Use lectern_activity_head to return to now.',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Activity event id from lectern_list_activity' },
        },
        required: ['eventId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_restore_activity', async (args) => {
        const result = await checkoutActivity(asString(args.eventId));
        if (!result.ok) return toolText(result);
        store.applyHistoryLesson(result.lesson);
        return toolText({ ok: true, eventId: asString(args.eventId), restored: true });
      }),
    },
    {
      name: 'lectern_activity_head',
      title: 'Return to current activity head',
      description:
        'Leave a checked-out history card and restore the current (newest) lesson snapshot. Same as Return to current on the co-pilot banner.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_activity_head', async () => {
        const result = await checkoutActivityHead();
        if (!result.ok) return toolText(result);
        store.applyHistoryLesson(result.lesson);
        return toolText({ ok: true, atHead: true });
      }),
    },
    {
      name: 'lectern_set_meta',
      title: 'Set lesson meta',
      description:
        'Update lesson title, audience, subject, and learning objectives. Use this to harden a teacher draft into a complete lesson header.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Lesson title' },
          audience: { type: 'string', description: 'Who the lesson is for' },
          subject: { type: 'string', description: 'Subject area' },
          objectives: {
            type: 'array',
            items: { type: 'string' },
            description: 'Learning objectives students should leave with',
          },
        },
        additionalProperties: false,
      },
      execute: withActivity('lectern_set_meta', async (args) => {
        const patch: {
          title?: string;
          audience?: string;
          subject?: string;
          objectives?: string[];
        } = {};
        if (typeof args.title === 'string') patch.title = args.title;
        if (typeof args.audience === 'string') patch.audience = args.audience;
        if (typeof args.subject === 'string') patch.subject = args.subject;
        if (Array.isArray(args.objectives)) patch.objectives = asStringArray(args.objectives);
        return toolText(store.setMeta(patch));
      }),
    },
    {
      name: 'lectern_upsert_section',
      title: 'Upsert lesson section',
      description:
        'Create or update a lesson section as textbook manuscript prose. Set kind to material, example, or summary when those roles fit; when they do not, pass a custom short label (Lab, Discussion, Warm-up, Primary source, …) instead of forcing a built-in. Prefer complete educational writing with paragraphs, callouts, and KaTeX math. Pair sections with schematic figures via lectern_generate_section_media (30 templates) or lectern_attach_section_media. Body format: Markdown with blank-line paragraphs; inline math $...$; display math with $$...$$ on their own lines; callouts as blockquotes starting with **Definition.**, **Takeaway.**, **Notation.**, **Note.**, **Misconception.**, or **Example.**; lists and tables welcome. Pass id to update an existing section.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Existing section id (omit to create)' },
          title: { type: 'string', description: 'Section heading' },
          body: {
            type: 'string',
            description:
              'Manuscript body (Markdown + LaTeX). Use $$ display equations and > **Takeaway.** callouts so the page renders like a textbook.',
          },
          kind: {
            type: 'string',
            description:
              'Page badge for this section. Prefer built-ins when they fit: material (reading), example (worked example), summary (takeaways). If the pedagogical role does not fit those three, invent a custom short Title Case label (max 40 chars) such as Lab, Discussion, or Primary source — do not force-fit a built-in. Omit on create to default to material.',
          },
          order: { type: 'number', description: 'Display order, 0-based' },
        },
        required: ['title', 'body'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_upsert_section', async (args) =>
        toolText(
          store.upsertSection({
            id: typeof args.id === 'string' ? args.id : undefined,
            title: asString(args.title),
            body: asString(args.body),
            kind: typeof args.kind === 'string' ? (normalizeSectionKind(args.kind) ?? undefined) : undefined,
            order: typeof args.order === 'number' ? args.order : undefined,
          }),
        ),
      ),
    },
    {
      name: 'lectern_plan_visual_learning',
      title: 'Plan an illustration + explainer pair',
      description:
        'Create a visual-learning plan for one section. Returns an ImageGen-ready prompt for an engaging raster illustration AND a recommended Lectern SVG template for explaining the idea. Use this proactively when enriching materials, even if the teacher did not explicitly request visuals. Then generate the raster, attach it with AMDP (lectern_offer_media, then every intake rank until CAS present, then bind and STOP), and create the schematic with lectern_generate_section_media.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { sectionId: { type: 'string', description: 'Section to enrich' } },
        required: ['sectionId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_plan_visual_learning', async (args) => {
        const lesson = store.getLiveLesson();
        const section = lesson.sections.find((item) => item.id === asString(args.sectionId));
        if (!section) return toolText({ ok: false, error: 'Section not found.' });
        const { buildIllustrationBrief, recommendExplainer } = await import('@/lib/visual-learning');
        const explainer = recommendExplainer(section, lesson.meta.subject);
        return toolText({
          ok: true,
          sectionId: section.id,
          illustration: { medium: 'generated-raster', brief: buildIllustrationBrief(section, lesson) },
          schematic: explainer,
          workflow: [
            'Generate the illustration using the brief.',
            'Call lectern_attach_generated_illustration with a small URL/data URL, or lectern_begin_media_upload → append chunks → lectern_commit_media_upload so the PDF can draw and restore the bytes.',
            'Call lectern_generate_section_media with the recommended templateId and adapted params.',
            'Call lectern_audit_visual_learning before publishing.',
          ],
        });
      }),
    },
    {
      name: 'lectern_attach_generated_illustration',
      title: 'Attach AI-generated illustration',
      description:
        `Attach a raster illustration that you generated for a section. This preserves an AI marker and the required transparency caption automatically. Use after lectern_plan_visual_learning; do not use SVG here - SVG explainers belong in lectern_generate_section_media. ${CHUNKED_MEDIA_HINT}`,
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'Section to enrich' },
          src: { type: 'string', description: 'Public image URL, /media path, or a small data URL from the generated raster image' },
          alt: { type: 'string', description: 'Specific accessible description of the illustration' },
          caption: { type: 'string', description: 'Optional learner-facing caption' },
        },
        required: ['sectionId', 'src', 'alt'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_attach_generated_illustration', async (args) =>
        toolText(
          await persistIllustration(
            store,
            asString(args.sectionId),
            asString(args.src),
            asString(args.alt),
            typeof args.caption === 'string' ? args.caption : undefined,
          ),
        ),
      ),
    },
    {
      name: 'lectern_begin_media_upload',
      title: 'Begin chunked media upload',
      description:
        'Rank 4 AMDP intake (json-chunk). Use only after cas-hit, plane-put, and merkle-slice failed or were unavailable — then stop after commit succeeds. WebMCP tool calls are JSON — do not pass a full data URL when it is larger than a few thousand characters. Returns uploadId and maxChunkChars. Then call lectern_append_media_chunk repeatedly and lectern_commit_media_upload. Commit stores a data URL on the lesson so the exported PDF both draws the figure and embeds the bytes in the LCT1 restore pack (not IndexedDB-only).',
      inputSchema: {
        type: 'object',
        properties: {
          mimeType: {
            type: 'string',
            description: 'Raster or video MIME type, e.g. image/jpeg, image/png, video/mp4',
          },
          filename: { type: 'string', description: 'Optional original filename for the attached media' },
          kind: {
            type: 'string',
            enum: ['image', 'video'],
            description: 'Optional override; inferred from mimeType when omitted',
          },
        },
        required: ['mimeType'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_begin_media_upload', async (args) =>
        toolText(
          mediaUploadRegistry.begin({
            mimeType: asString(args.mimeType),
            filename: typeof args.filename === 'string' ? args.filename : undefined,
            kind: args.kind === 'video' || args.kind === 'image' ? args.kind : undefined,
          }),
        ),
      ),
    },
    {
      name: 'lectern_append_media_chunk',
      title: 'Append media upload chunk',
      description:
        'Append one base64 slice to an upload started with lectern_begin_media_upload. Pass at most 6000 characters (4000 is safer for CDP). Raw standard/URL-safe base64, or a slice of a data URL, is accepted; whitespace is ignored. Repeat until the file is complete, then lectern_commit_media_upload.',
      inputSchema: {
        type: 'object',
        properties: {
          uploadId: { type: 'string', description: 'id from lectern_begin_media_upload' },
          chunk: {
            type: 'string',
            description: 'Next base64 slice (max 6000 chars), optionally including a data:…;base64, prefix on the first slice',
          },
          index: {
            type: 'number',
            description: 'Optional 0-based sequential index; must match the next expected chunk',
          },
        },
        required: ['uploadId', 'chunk'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_append_media_chunk', async (args) =>
        toolText(
          mediaUploadRegistry.append({
            uploadId: asString(args.uploadId),
            chunk: asString(args.chunk),
            index: typeof args.index === 'number' ? args.index : undefined,
          }),
        ),
      ),
    },
    {
      name: 'lectern_commit_media_upload',
      title: 'Commit chunked media upload',
      description:
        'Finish a chunked upload and attach the bytes to the lesson document as a data URL (same persistence as the one-shot attach tools). The exported PDF draws raster images on the page and stores the same bytes in the LCT1 restore protocol so a later PDF upload rebuilds the media. Video is kept in LCT1 for restore; the printable PDF shows a caption. purpose: illustration, section, or quiz-choice.',
      inputSchema: {
        type: 'object',
        properties: {
          uploadId: { type: 'string', description: 'id from lectern_begin_media_upload' },
          purpose: {
            type: 'string',
            enum: ['illustration', 'section', 'quiz-choice'],
            description: 'Where to attach: AI illustration, generic section media, or a quiz answer card',
          },
          sectionId: { type: 'string', description: 'Required for illustration and section' },
          quizId: { type: 'string', description: 'Required for quiz-choice' },
          choiceIndex: { type: 'number', description: '0-based quiz choice index; required for quiz-choice' },
          alt: { type: 'string', description: 'Accessible description of the media' },
          caption: { type: 'string', description: 'Optional learner-facing caption (illustration and section)' },
          kind: {
            type: 'string',
            enum: ['image', 'video'],
            description: 'Required for purpose=section when you need to force image vs video',
          },
        },
        required: ['uploadId', 'purpose', 'alt'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_commit_media_upload', async (args) => {
        const purpose = asString(args.purpose).trim();
        if (purpose !== 'illustration' && purpose !== 'section' && purpose !== 'quiz-choice') {
          return toolText({ ok: false, error: 'purpose must be illustration, section, or quiz-choice.' });
        }
        const assembled = await mediaUploadRegistry.assemble(asString(args.uploadId));
        if (!assembled.ok) return toolText(assembled);
        let src = assembled.src;
        if (assembled.kind === 'image') {
          const compressed = await compressAmdpRaster(assembled.sha256);
          if (!compressed.ok) return toolText(compressed);
          const next = lecternAmdp.toDataUrl(compressed.sha256);
          if (!next) return toolText({ ok: false, error: 'Compressed raster is not in CAS.' });
          src = next;
        }
        const alt = asString(args.alt);
        const caption = typeof args.caption === 'string' ? args.caption : undefined;
        const finish = async (result: { ok?: boolean }) => {
          if (result.ok) mediaUploadRegistry.abort(assembled.uploadId);
          return toolText(result);
        };
        if (purpose === 'illustration') {
          if (assembled.kind !== 'image') {
            return toolText({ ok: false, error: 'purpose=illustration requires a raster image upload, not video.' });
          }
          return finish(
            await persistIllustration(store, asString(args.sectionId), src, alt, caption),
          );
        }
        if (purpose === 'quiz-choice') {
          if (assembled.kind !== 'image') {
            return toolText({ ok: false, error: 'Quiz answer cards need a raster image, not video.' });
          }
          return finish(
            await persistQuizChoiceMedia(
              store,
              asString(args.quizId),
              asNumber(args.choiceIndex, -1),
              src,
              alt,
            ),
          );
        }
        const kind = args.kind === 'video' || args.kind === 'image' ? args.kind : assembled.kind;
        return finish(
          await persistSectionMedia(store, asString(args.sectionId), src, kind, alt || 'Lesson media', caption),
        );
      }),
    },
    {
      name: 'lectern_offer_media',
      title: 'Offer media by content hash',
      description:
        'AMDP control plane: cite a raster/video by sha256, byteLength, and mimeType. Does not send pixels. Returns disposition have (bind immediately) or intake (plane-put, merkle-slice, or json-chunk). ' +
        AMDP_INTAKE_RANKS +
        ' Call lectern_compress_media so the page shrinks the raster (do not recompress with your image generator), then lectern_bind_media with the returned sha256.',
      inputSchema: {
        type: 'object',
        properties: {
          sha256: { type: 'string', description: 'SHA-256 of the raw bytes, 64 hex characters' },
          byteLength: { type: 'number', description: 'Exact byte length of the file' },
          mimeType: { type: 'string', description: 'Raster or video MIME type, e.g. image/jpeg' },
          filename: { type: 'string', description: 'Optional original filename' },
          width: { type: 'number', description: 'Optional pixel width' },
          height: { type: 'number', description: 'Optional pixel height' },
          merkleChunkSize: { type: 'number', description: 'Optional Merkle slice size in bytes' },
          merkleLeaves: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional SHA-256 hex of each slice, in order, for lectern_put_media_slice',
          },
        },
        required: ['sha256', 'byteLength', 'mimeType'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_offer_media', async (args) => {
        const leaves = Array.isArray(args.merkleLeaves)
          ? args.merkleLeaves.filter((item): item is string => typeof item === 'string')
          : [];
        return toolText(
          lecternAmdp.offer({
            sha256: asString(args.sha256),
            byteLength: asNumber(args.byteLength, -1),
            mimeType: asString(args.mimeType),
            filename: typeof args.filename === 'string' ? args.filename : undefined,
            width: typeof args.width === 'number' ? args.width : undefined,
            height: typeof args.height === 'number' ? args.height : undefined,
            merkle:
              leaves.length > 0
                ? {
                    chunkSize: typeof args.merkleChunkSize === 'number' ? args.merkleChunkSize : 65536,
                    leaves,
                  }
                : undefined,
          }),
        );
      }),
    },
    {
      name: 'lectern_put_media_slice',
      title: 'Put one AMDP Merkle slice',
      description:
        'AMDP merkle-slice intake: send one verified slice after lectern_offer_media with merkleLeaves. Pass the slice as base64 (raw bytes of that slice only). Repeat until complete is true, then lectern_compress_media if it is a raster, then lectern_bind_media.',
      inputSchema: {
        type: 'object',
        properties: {
          sha256: { type: 'string', description: 'File SHA-256 from the offer' },
          index: { type: 'number', description: '0-based slice index' },
          chunk: { type: 'string', description: 'Base64 of this slice’s raw bytes' },
        },
        required: ['sha256', 'index', 'chunk'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_put_media_slice', async (args) =>
        toolText(
          await lecternAmdp.putMerkleSlice({
            sha256: asString(args.sha256),
            index: asNumber(args.index, -1),
            chunk: asString(args.chunk),
          }),
        ),
      ),
    },
    {
      name: 'lectern_compress_media',
      title: 'Compress CAS raster on this page',
      description:
        'Shrink a raster already in this tab’s CAS (after plane-put or json-chunk). Lectern downscales and JPEG-encodes on the page — do not recompress with your image generator. Returns sha256 / byteLength / mimeType to bind. If changed is false, bind the same hash. Call this before lectern_bind_media when the generated file is large. Video is not compressed (keep under 6 MB).',
      inputSchema: {
        type: 'object',
        properties: {
          sha256: { type: 'string', description: 'SHA-256 of a raster already in this tab’s CAS' },
        },
        required: ['sha256'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_compress_media', async (args) =>
        toolText(await compressAmdpRaster(asString(args.sha256))),
      ),
    },
    {
      name: 'lectern_bind_media',
      title: 'Bind CAS media onto the lesson',
      description:
        'AMDP bind: attach a hash already in this tab’s CAS (after offer cas-hit, put, merkle complete, json-chunk assemble, or lectern_compress_media). If the raster is over ~1.8 MB, call lectern_compress_media first and bind the returned sha256. Writes a data URL onto the lesson for PDF draw + LCT1 restore. purpose: illustration, section, or quiz-choice.',
      inputSchema: {
        type: 'object',
        properties: {
          sha256: { type: 'string', description: 'SHA-256 already in CAS' },
          purpose: {
            type: 'string',
            enum: ['illustration', 'section', 'quiz-choice'],
            description: 'Where to attach',
          },
          sectionId: { type: 'string', description: 'Required for illustration and section' },
          quizId: { type: 'string', description: 'Required for quiz-choice' },
          choiceIndex: { type: 'number', description: '0-based quiz choice index; required for quiz-choice' },
          alt: { type: 'string', description: 'Accessible description of the media' },
          caption: { type: 'string', description: 'Optional learner-facing caption' },
          kind: {
            type: 'string',
            enum: ['image', 'video'],
            description: 'Optional override for purpose=section',
          },
        },
        required: ['sha256', 'purpose', 'alt'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_bind_media', async (args) => {
        const purpose = asString(args.purpose).trim();
        if (purpose !== 'illustration' && purpose !== 'section' && purpose !== 'quiz-choice') {
          return toolText({ ok: false, error: 'purpose must be illustration, section, or quiz-choice.' });
        }
        const bound = lecternAmdp.bind({
          sha256: asString(args.sha256),
          purpose,
          alt: asString(args.alt),
          caption: typeof args.caption === 'string' ? args.caption : undefined,
          target: {
            sectionId: asString(args.sectionId),
            quizId: asString(args.quizId),
            choiceIndex: asNumber(args.choiceIndex, -1),
          },
        });
        if (!bound.ok) return toolText(bound);
        if (rasterNeedsCompress(bound.sha256)) {
          return toolText({
            ok: false,
            error: `Raster is ${bound.byteLength} bytes; lesson limit is ${LECTERN_MAX_IMAGE_BYTES}. Call lectern_compress_media with sha256=${bound.sha256}, then bind the returned sha256.`,
          });
        }
        const kind = args.kind === 'video' || args.kind === 'image' ? args.kind : bound.kind === 'video' ? 'video' : 'image';
        return toolText(
          await persistBoundMedia(
            store,
            purpose,
            bound.src,
            kind,
            bound.alt,
            bound.caption,
            asString(args.sectionId),
            asString(args.quizId),
            asNumber(args.choiceIndex, -1),
          ),
        );
      }),
    },
    {
      name: 'lectern_media_status',
      title: 'Media CAS status',
      description:
        'AMDP status: whether this tab already has the cited sha256, plus merkle progress if an offer is in flight. Read-only.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          sha256: { type: 'string', description: 'SHA-256 to look up' },
        },
        required: ['sha256'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_media_status', async (args) =>
        toolText(lecternAmdp.status(asString(args.sha256))),
      ),
    },
    {
      name: 'lectern_audit_visual_learning',
      title: 'Audit visual learning coverage',
      description:
        'Check whether the lesson has both AI-generated raster illustrations for engagement and SVG schematics/templates for explanation. Call this before publishing; use the returned recommendations to fill missing variety.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_audit_visual_learning', async () => {
        const { auditVisualLearning } = await import('@/lib/visual-learning');
        return toolText(auditVisualLearning(store.getLiveLesson()));
      }),
    },
    {
      name: 'lectern_list_media_templates',
      title: 'List media templates',
      description:
        'List Lectern schematic / animated figure templates (30 presets). Each entry includes id, title, description, tags, params schema, and whenToUse guidance. Call this before lectern_generate_section_media so you pick the right layout (graph, cycle, compare, WebMCP bridge, custom SVG, etc.).',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          tag: { type: 'string', description: 'Filter by tag (e.g. graph, cycle, webmcp, animation)' },
          query: { type: 'string', description: 'Search id, title, description, or tags' },
          animatedOnly: { type: 'boolean', description: 'If true, only animated templates' },
        },
        additionalProperties: false,
      },
      execute: withActivity('lectern_list_media_templates', async (args) => {
        const { listMediaTemplateSummaries } = await import('@/lib/media-templates');
        const templates = listMediaTemplateSummaries({
          tag: typeof args.tag === 'string' ? args.tag : undefined,
          query: typeof args.query === 'string' ? args.query : undefined,
          animatedOnly: args.animatedOnly === true,
        });
        return toolText({
          count: templates.length,
          templates: templates.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            whenToUse: t.whenToUse,
            medium: t.medium,
            animated: t.animated,
            tags: t.tags,
            params: t.params,
          })),
          hint: 'Render with lectern_preview_media_template or attach with lectern_generate_section_media.',
        });
      }),
    },
    {
      name: 'lectern_preview_media_template',
      title: 'Preview media template',
      description:
        'Render a schematic or animated SVG from a template id + params without attaching. Returns dataUrl for inspection. Use lectern_list_media_templates for ids and param keys.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'Template id from lectern_list_media_templates' },
          params: {
            type: 'object',
            description: 'Template-specific parameters (title, steps, labels, svg markup for custom-svg, etc.)',
            additionalProperties: true,
          },
        },
        required: ['templateId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_preview_media_template', async (args) => {
        try {
          const { renderMediaTemplate } = await import('@/lib/media-templates');
          const params =
            args.params && typeof args.params === 'object' && !Array.isArray(args.params)
              ? (args.params as Record<string, unknown>)
              : {};
          const rendered = renderMediaTemplate(asString(args.templateId), params);
          return toolText({
            ok: true,
            templateId: rendered.templateId,
            width: rendered.width,
            height: rendered.height,
            animated: rendered.animated,
            dataUrl: rendered.dataUrl,
            svgBytes: rendered.svg.length,
            hint: 'If it looks right, call lectern_generate_section_media with the same templateId and params.',
          });
        } catch (err) {
          return toolText({
            ok: false,
            error: err instanceof Error ? err.message : 'Could not render template.',
          });
        }
      }),
    },
    {
      name: 'lectern_generate_section_media',
      title: 'Generate section media from template',
      description:
        'Render a Lectern-styled schematic or animated SVG from a catalog template, then attach it to a section. Workflow: lectern_list_media_templates -> pick id -> fill params -> this tool. For fully bespoke art, use templateId custom-svg with params.svg, or attach remote images with lectern_attach_section_media.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'Section id to attach the figure to' },
          templateId: { type: 'string', description: 'Template id from lectern_list_media_templates' },
          params: {
            type: 'object',
            description: 'Template-specific parameters',
            additionalProperties: true,
          },
          caption: { type: 'string', description: 'Figure caption shown under the image' },
          alt: { type: 'string', description: 'Accessible alt text' },
          attach: {
            type: 'boolean',
            description: 'Attach to section (default true). If false, only returns rendered dataUrl.',
          },
        },
        required: ['sectionId', 'templateId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_generate_section_media', async (args) => {
        try {
          const { renderMediaTemplate } = await import('@/lib/media-templates');
          const params =
            args.params && typeof args.params === 'object' && !Array.isArray(args.params)
              ? (args.params as Record<string, unknown>)
              : {};
          const rendered = renderMediaTemplate(asString(args.templateId), params);
          const shouldAttach = args.attach !== false;
          const alt = asString(args.alt, asString(params.title, 'Generated figure'));
          const caption = typeof args.caption === 'string' ? args.caption.trim() : alt;

          if (!shouldAttach) {
            return toolText({
              ok: true,
              attached: false,
              templateId: rendered.templateId,
              dataUrl: rendered.dataUrl,
              animated: rendered.animated,
            });
          }

          const media = {
            id: (await import('@/lib/lesson')).createId('media'),
            kind: 'image' as const,
            src: rendered.dataUrl,
            alt,
            caption,
            name: `${rendered.templateId}.svg`,
          };
          const result = store.addSectionMedia(asString(args.sectionId), media);
          return toolText({
            ...result,
            templateId: rendered.templateId,
            animated: rendered.animated,
            dataUrlPreview: rendered.dataUrl.slice(0, 80) + '…',
          });
        } catch (err) {
          return toolText({
            ok: false,
            error: err instanceof Error ? err.message : 'Could not generate section media.',
          });
        }
      }),
    },
    {
      name: 'lectern_attach_section_media',
      title: 'Attach media to a section',
      description:
        `Attach an image or video to a material section by URL or site path (e.g. /media/demo/leaf-factory.svg). Remote and blob URLs are inlined immediately; site paths are embedded when exporting .lectern or PDF. For schematic/animated figures, prefer lectern_generate_section_media with a catalog template. ${CHUNKED_MEDIA_HINT}`,
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'Section id' },
          src: { type: 'string', description: 'https URL, /path, or data URL' },
          kind: { type: 'string', enum: ['image', 'video'], description: 'Media kind' },
          alt: { type: 'string', description: 'Accessible alt text' },
          caption: { type: 'string', description: 'Figure caption' },
        },
        required: ['sectionId', 'src', 'kind'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_attach_section_media', async (args) => {
        const kind = args.kind === 'video' ? 'video' : 'image';
        return toolText(
          await persistSectionMedia(
            store,
            asString(args.sectionId),
            asString(args.src),
            kind,
            asString(args.alt, 'Lesson media'),
            typeof args.caption === 'string' ? args.caption : undefined,
          ),
        );
      }),
    },
    {
      name: 'lectern_remove_section_media',
      title: 'Remove section media',
      description: 'Remove an attached photo/video from a section by media id.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string' },
          mediaId: { type: 'string' },
        },
        required: ['sectionId', 'mediaId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_remove_section_media', async (args) =>
        toolText(store.removeSectionMedia(asString(args.sectionId), asString(args.mediaId))),
      ),
    },
    {
      name: 'lectern_remove_section',
      title: 'Remove section',
      description: 'Delete a lesson section by id.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Section id' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_remove_section', async (args) =>
        toolText(store.removeSection(asString(args.id))),
      ),
    },
    {
      name: 'lectern_upsert_quiz_item',
      title: 'Upsert quiz item',
      description:
        'Create or update a multiple-choice check for understanding. A good Lectern lesson needs materials AND tests. Optional sectionId places the check after that section (soft pause); omit sectionId for the end-of-lesson quiz. For concrete objects or visual recognition, follow creation with lectern_attach_quiz_choice_media once per choice so students can answer with image cards.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Existing quiz id (omit to create)' },
          prompt: {
            type: 'string',
            description: 'Question prompt; Markdown + $math$ / $$display$$ supported',
          },
          choices: {
            type: 'array',
            items: { type: 'string' },
            description: 'Answer choices (at least 2)',
          },
          choiceMedia: {
            type: 'array',
            description: 'Optional media cards aligned to choices; use lectern_attach_quiz_choice_media after creation for generated images.',
          },
          answerIndex: {
            type: 'number',
            description: '0-based index of the correct choice',
          },
          explanation: { type: 'string', description: 'Why the answer is correct' },
          order: { type: 'number', description: 'Display order' },
          sectionId: {
            type: 'string',
            description:
              'Optional section id: place this check after that section. Omit for the end-of-lesson “Check for understanding” block.',
          },
        },
        required: ['prompt', 'choices', 'answerIndex'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_upsert_quiz_item', async (args) =>
        toolText(
          store.upsertQuizItem({
            id: typeof args.id === 'string' ? args.id : undefined,
            prompt: asString(args.prompt),
            choices: asStringArray(args.choices),
            choiceMedia: Array.isArray(args.choiceMedia)
              ? args.choiceMedia.map((item) => (item && typeof item === 'object' ? item as import('@/types/lesson').SectionMedia : null))
              : undefined,
            answerIndex: asNumber(args.answerIndex, -1),
            explanation: typeof args.explanation === 'string' ? args.explanation : undefined,
            order: typeof args.order === 'number' ? args.order : undefined,
            ...(typeof args.sectionId === 'string' ? { sectionId: args.sectionId } : {}),
          }),
        ),
      ),
    },
    {
      name: 'lectern_attach_quiz_choice_media',
      title: 'Attach generated image to a quiz answer',
      description:
        `Attach a generated raster image as a selectable visual answer card for one quiz choice. Use this proactively for concrete vocabulary, tools, animals, maps, objects, or symbols (for example, show four tool cards for “Which tool holds hot metal?”). First generate four clear, age-appropriate, label-free images with your image-generation capability; then attach one image per answer index. Students see the cards and choose as normal. ${CHUNKED_MEDIA_HINT}`,
      inputSchema: {
        type: 'object',
        properties: {
          quizId: { type: 'string', description: 'Quiz id from lectern_get_lesson' },
          choiceIndex: { type: 'number', description: '0-based answer-choice index' },
          src: { type: 'string', description: 'Public raster image URL, /media path, or data URL from image generation' },
          alt: { type: 'string', description: 'Accessible description of the pictured answer choice' },
        },
        required: ['quizId', 'choiceIndex', 'src', 'alt'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_attach_quiz_choice_media', async (args) =>
        toolText(
          await persistQuizChoiceMedia(
            store,
            asString(args.quizId),
            asNumber(args.choiceIndex, -1),
            asString(args.src),
            asString(args.alt),
          ),
        ),
      ),
    },
    {
      name: 'lectern_remove_quiz_item',
      title: 'Remove quiz item',
      description: 'Delete a quiz item by id.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Quiz item id' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_remove_quiz_item', async (args) =>
        toolText(store.removeQuizItem(asString(args.id))),
      ),
    },
    {
      name: 'lectern_list_library',
      title: 'List Your materials',
      description:
        'List lessons on this device from Save & load → Your materials, plus Demo materials. Returns ids for lectern_switch_lesson. Use this instead of scraping the Save & load panel when the teacher wants to work on a different saved draft. Does not return the full manuscript — call lectern_get_lesson after switching.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_list_library', async () => toolText(libraryPayload(store))),
    },
    {
      name: 'lectern_switch_lesson',
      title: 'Switch working materials',
      description:
        'Switch the teacher manuscript to another lesson on this device — same as opening a row under Your materials, or a Demo materials card. Pass id from lectern_list_library (yours[].id) or a demo id (photosynthesis, webmcp, cossacks). The current lesson stays listed under Your materials unless it is a blank unused draft. Do not scrape the Save & load panel.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'Lesson id from lectern_list_library (yours[].id), or a demo id: photosynthesis, webmcp, cossacks',
          },
        },
        required: ['id'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_switch_lesson', async (args) =>
        toolText(await store.switchLesson(asString(args.id))),
      ),
    },
    {
      name: 'lectern_new_lesson',
      title: 'Start a blank lesson',
      description:
        'Start a new blank lesson in Teacher mode (same as New blank in Save & load). The current lesson stays listed under Your materials. Use this when the teacher wants a fresh page, not when they asked to switch to an existing draft.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_new_lesson', async () => toolText(await store.newLesson())),
    },
    {
      name: 'lectern_save_lesson',
      title: 'Save lesson (.lectern)',
      description:
        'Persist the current lesson under Your materials on this device and download a .lectern file (same as Download .lectern in Save & load). Teachers reopen authoring from that file. Does not export a student PDF. Blank unused drafts are saved to the library but not downloaded. To load a file payload, use lectern_import_restore.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_save_lesson', async () => {
        const saved = await store.saveToLibrary();
        if (saved.sparse) {
          return toolText({
            ...saved,
            downloaded: false,
            hint: 'Blank draft is listed under Your materials. Add a title or a section before downloading a .lectern file.',
          });
        }
        const { downloadLecternFile, lecternFilename } = await import('@/lib/export-lectern');
        const lesson = store.getLiveLesson();
        const { warnings, embeddedCount } = await downloadLecternFile(lesson);
        conversionLecternExported({ source: 'webmcp' });
        return toolText({
          ...saved,
          downloaded: true,
          filename: lecternFilename(lesson.meta.title),
          embeddedCount,
          warnings,
        });
      }),
    },
    {
      name: 'lectern_publish_lesson',
      title: 'Publish lesson',
      description:
        'Validate gaps and mark the lesson ready. Does not mint a student URL — the studio URL stays https://lectern.click/studio. Tell the teacher to export a PDF for students and a .lectern file to keep writing. Students upload the PDF in Save & load; teachers reopen authoring from .lectern only.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_publish_lesson', async () => toolText(store.publish())),
    },
    {
      name: 'lectern_get_restore_payload',
      title: 'Get PDF restore payload',
      description:
        'Return the compressed Lectern restore payload (LCT1.…) and LECTERN_PDF/v1 part blocks used on system pages at the end of an exported PDF. Teachers export PDF from the UI; this tool gives the agent the same machine-readable pack so a student can later call lectern_import_restore.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_get_restore_payload', async () => {
        const { embedLessonMedia } = await import('@/lib/embed-lesson-media');
        const { buildRestoreBundle } = await import('@/lib/restore-codec');
        const { lesson: embedded, warnings } = await embedLessonMedia(store.getLiveLesson());
        const bundle = buildRestoreBundle(embedded);
        return toolText({
          title: bundle.title,
          lessonId: bundle.lessonId,
          sheetCount: bundle.sheetCount,
          payload: bundle.payload,
          sheets: bundle.sheets,
          embedWarnings: warnings,
          hint: 'Export PDF from the Publish panel (invisible restore data at the end) or pass payload / LECTERN_PDF blocks to lectern_import_restore.',
        });
      }),
    },
  ];

  const studentTools: ModelContextTool[] = [
    {
      name: 'lectern_import_restore',
      title: 'Import lesson from PDF restore data',
      description: IMPORT_RESTORE_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Restore payload, LECTERN_PDF/v1 blocks, legacy QR lines, or lesson JSON',
          },
        },
        required: ['data'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_import_restore', async (args) =>
        toolText(store.importRestorePayload(asString(args.data))),
      ),
    },
    {
      name: 'lectern_add_annotation',
      title: 'Add student annotation',
      description:
        'Leave a student mark on a section. Use kind "learned" for a one-click learned mark, or kind "note" (default) for confusion, questions, or takeaways.',
      inputSchema: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'Section id to annotate' },
          note: { type: 'string', description: 'Note text (optional when kind is learned)' },
          kind: {
            type: 'string',
            enum: ['learned', 'note'],
            description: 'learned = mark section understood; note = free-text margin mark',
          },
        },
        required: ['sectionId'],
        additionalProperties: false,
      },
      execute: withActivity('lectern_add_annotation', async (args) => {
        const kind = args.kind === 'learned' ? 'learned' : 'note';
        return toolText(store.addAnnotation(asString(args.sectionId), asString(args.note), kind));
      }),
    },
    {
      name: 'lectern_list_annotations',
      title: 'List annotations',
      description: 'List all student annotations on the current lesson.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: withActivity('lectern_list_annotations', async () =>
        toolText({ annotations: store.getLiveLesson().annotations }),
      ),
    },
  ];

  // Teachers can also import a PDF pack while preparing.
  const teacherImport: ModelContextTool = {
    name: 'lectern_import_restore',
    title: 'Import lesson from PDF restore data',
    description: IMPORT_RESTORE_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Restore payload, LECTERN_PDF/v1 blocks, legacy QR lines, or lesson JSON',
        },
      },
      required: ['data'],
      additionalProperties: false,
    },
    execute: withActivity('lectern_import_restore', async (args) =>
      toolText(store.importRestorePayload(asString(args.data))),
    ),
  };

  return store.mode === 'teacher'
    ? [...common, ...teacherTools, teacherImport]
    : [...common, ...studentTools];
}

export function useWebMcpTools(store: LessonStore) {
  const storeRef = useRef(store);
  storeRef.current = store;

  const [status, setStatus] = useState<'idle' | 'ready' | 'missing' | 'error'>('idle');
  const [detail, setDetail] = useState('Checking WebMCP…');
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [polyfill, setPolyfill] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const proxyStore = new Proxy({} as LessonStore, {
      get(_target, prop) {
        const value = storeRef.current[prop as keyof LessonStore];
        return typeof value === 'function' ? value.bind(storeRef.current) : value;
      },
    });

    const tools = buildTools(proxyStore);
    const names = tools.map((t) => t.name);

    async function run() {
      if (!isWebMcpAvailable()) {
        if (!cancelled) {
          setStatus('missing');
          setDetail(
            'Open this page in ChatGPT’s in-app browser, or Chrome with chrome://flags/#enable-webmcp-testing.',
          );
          setToolNames([]);
          setPolyfill(false);
          setError(null);
        }
        return;
      }

      const result = await registerTools(tools, controller.signal);
      if (cancelled) return;
      if (result.ok) {
        setStatus('ready');
        const isPolyfill =
          typeof window !== 'undefined' && window.__lecternWebMcpDemo?.isPolyfill === true;
        setPolyfill(isPolyfill);
        setError(null);
        setDetail(
          isPolyfill
            ? `Registered ${result.registered.length} tools via local WebMCP polyfill (${store.mode} mode). Native WebMCP preferred for judges.`
            : `Registered ${result.registered.length} native WebMCP tools for ${store.mode} mode.`,
        );
        setToolNames(result.registered);
      } else {
        setStatus('error');
        setPolyfill(false);
        setError(result.error || 'Failed to register WebMCP tools.');
        setDetail(result.error || 'Failed to register WebMCP tools.');
        setToolNames(result.registered);
      }
    }

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      void unregisterTools(names);
    };
  }, [store.mode]);

  return { status, detail, toolNames, available: status === 'ready', polyfill, error };
}
