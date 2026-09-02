/**
 * Static WebMCP tool catalog for Lectern.
 *
 * Chrome evals require the full tool list for the application state under test
 * (https://developer.chrome.com/docs/ai/webmcp/evals). Keep this file as the
 * source of truth for names, descriptions, and input schemas. Execute handlers
 * live in `useWebMcpTools.ts` and wrap these entries.
 */
import type { LessonMode } from '../types/lesson';
import type { JsonSchema } from '../types/webmcp';

/** Keep in sync with `SUPPORTED_LOCALES` in `src/i18n/locales.ts` (eval runner asserts). */
export const CATALOG_LOCALE_LIST =
  'en, es, pt-BR, zh-Hans, hi, ar, ja, ko, fr, de, uk, tr, vi, id, th, it, pl';

export type WebMcpToolMode = LessonMode;

export interface WebMcpCatalogTool {
  name: string;
  title: string;
  description: string;
  modes: readonly WebMcpToolMode[];
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  inputSchema: JsonSchema;
}

const emptyObject: JsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

/** Ranked AMDP intake: try each until CAS present, then bind and STOP. */
export const AMDP_INTAKE_RANKS =
  'Try AMDP intakes in this order until lectern_media_status present is true (or offer disposition is have), then lectern_compress_media if it is a raster, lectern_bind_media, and STOP. Do not skip a later rank because an earlier one failed. Do not keep transferring after success. ' +
  '1) cas-hit: bind immediately. ' +
  '2) plane-put: stage the file in the OS temp directory (%TEMP% / $TMPDIR), not the workspace — Chrome’s upload tool often has no workspace roots and only allows temp. Create a temporary <input type="file"> on this page, append it to document.body, and leave it there (Lectern hides it visually). Upload that temp file. The page plane-puts on change. Optional: read arrayBuffer() in-page → window.__lecternAmdp.put. If DOM.setFileInputFiles is denied or files stay empty, go to rank 3. Never pass base64 through evaluate_script.args. Do not use a section Attach-media picker. ' +
  '3) merkle-slice: re-offer with merkleLeaves, then lectern_put_media_slice until complete. ' +
  '4) json-chunk: lectern_begin_media_upload → append → commit. Last rank, still required if 1–3 failed.';

export const CHUNKED_MEDIA_HINT =
  `AMDP is the default for rasters and video — do not put pixels in chat JSON. Cite first: lectern_offer_media (sha256, byteLength, mimeType). ${AMDP_INTAKE_RANKS} Bind/commit write a data URL onto the lesson so the exported PDF both draws the figure and stores the bytes in the LCT1 restore pack. SVG explainers stay on lectern_generate_section_media. Call lectern_compress_media with that sha256 so the page shrinks the raster — do not recompress with your image generator — then lectern_bind_media with the returned sha256.`;

export const WEB_MCP_TOOL_CATALOG: readonly WebMcpCatalogTool[] = [
  {
    name: 'lectern_list_locales',
    title: 'List UI languages',
    description:
      'List Lectern interface languages (flags in the header). Includes Arabic RTL. Russian is not supported. Does not translate lesson content.',
    modes: ['teacher', 'student'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_get_locale',
    title: 'Get UI language',
    description:
      'Return the current Lectern interface language, text direction (ltr/rtl), and the supported locale list.',
    modes: ['teacher', 'student'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_set_locale',
    title: 'Set UI language',
    description: `Change the Lectern chrome language (header, buttons, onboarding, co-pilot). Does not rewrite lesson manuscript content. Supported: ${CATALOG_LOCALE_LIST}. Arabic (ar) switches the page to RTL. Russian is not available.`,
    modes: ['teacher', 'student'],
    inputSchema: {
      type: 'object',
      properties: {
        locale: {
          type: 'string',
          description: `Locale code: ${CATALOG_LOCALE_LIST}`,
        },
      },
      required: ['locale'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_get_lesson',
    title: 'Get lesson',
    description:
      'Return the full Lectern lesson document: meta, sections (each has kind: built-in material/example/summary or a custom short label), quiz items, gaps, mode, and annotations. Use this before editing or answering student questions. Do not scrape the DOM; tool descriptions are the how-to (rasters/video: lectern_offer_media). Users may paste a LECTERN_QUIZ reference copied from Q1/Q2 — extract quizId and use that item.',
    modes: ['teacher', 'student'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_list_gaps',
    title: 'List lesson gaps',
    description:
      'Analyze whether the lesson is complete enough to teach: title, objectives, materials, and tests. Prefer fixing blockers before publish. Pair-write on the page; do not dump a worksheet in chat.',
    modes: ['teacher', 'student'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_list_activity',
    title: 'List co-pilot activity',
    description:
      'List the co-pilot activity history on this tab (newest first): agent tool calls and teacher edits, with ids for lectern_get_activity / lectern_restore_activity. Does not add a card to the log. Use this instead of scraping the co-pilot panel.',
    modes: ['teacher', 'student'],
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
  },
  {
    name: 'lectern_get_activity',
    title: 'Get one activity card',
    description:
      'Fetch one co-pilot history card by id from lectern_list_activity, including folded AMDP/json-chunk steps when present.',
    modes: ['teacher', 'student'],
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Activity event id from lectern_list_activity' },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_restore_activity',
    title: 'Restore lesson from a history card',
    description:
      'Check out a past co-pilot card and load that lesson snapshot into the teacher manuscript (same as tapping Restore on the card). Later cards stay until the next edit. Use lectern_activity_head to return to now.',
    modes: ['teacher'],
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Activity event id from lectern_list_activity' },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_activity_head',
    title: 'Return to current activity head',
    description:
      'Leave a checked-out history card and restore the current (newest) lesson snapshot. Same as Return to current on the co-pilot banner.',
    modes: ['teacher'],
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_get_section',
    title: 'Get section',
    description:
      'Fetch one lesson section by id (title, body, kind, media) and any nested quiz checks for that section so the agent can answer grounded questions without inventing content. kind may be a built-in role or a custom label the teacher defined. Users may paste a LECTERN_SECTION reference copied from a material — extract sectionId from that block and call this tool.',
    modes: ['teacher', 'student'],
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
          sectionId: { type: 'string', description: 'Section id from lectern_get_lesson, or from a pasted LECTERN_SECTION reference' },
      },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_set_mode',
    title: 'Set Lectern mode',
    description: 'Switch between teacher (authoring) and student (read-only + annotations) modes. After a PDF restore, switching to teacher does not open the PDF for editing — load a .lectern file to keep writing (unless ALLOW_PDF_RESTORE_AUTHORING is enabled).',
    modes: ['teacher', 'student'],
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
  },
  {
    name: 'lectern_set_meta',
    title: 'Set lesson meta',
    description:
      'Update lesson title, audience, subject, and learning objectives. Use this to harden a teacher draft into a complete lesson header.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_upsert_section',
    title: 'Upsert lesson section',
    description:
      'Create or update a lesson section as textbook manuscript prose. Set kind to material, example, or summary when those roles fit; when they do not, pass a custom short label (Lab, Discussion, Warm-up, Primary source, …) instead of forcing a built-in. Prefer complete educational writing with paragraphs, callouts, and KaTeX math. Pair sections with schematic figures via lectern_generate_section_media (30 templates) or lectern_attach_section_media. Body format: Markdown with blank-line paragraphs; inline math $...$; display math with $$...$$ on their own lines; callouts as blockquotes starting with **Definition.**, **Takeaway.**, **Notation.**, **Note.**, **Misconception.**, or **Example.**; lists and tables welcome. Pass id to update an existing section.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_plan_visual_learning',
    title: 'Plan an illustration + explainer pair',
    description:
      'Create a visual-learning plan for one section. Returns an ImageGen-ready prompt for an engaging raster illustration AND a recommended Lectern SVG template for explaining the idea. Use this proactively when enriching materials, even if the teacher did not explicitly request visuals. Then generate the raster, attach it with AMDP (lectern_offer_media, then every intake rank until CAS present, then bind and STOP), and create the schematic with lectern_generate_section_media.',
    modes: ['teacher'],
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: { sectionId: { type: 'string', description: 'Section to enrich' } },
      required: ['sectionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_attach_generated_illustration',
    title: 'Attach AI-generated illustration',
    description:
      `Attach a raster illustration that you generated for a section. This preserves an AI marker and the required transparency caption automatically. Use after lectern_plan_visual_learning; do not use SVG here - SVG explainers belong in lectern_generate_section_media. ${CHUNKED_MEDIA_HINT}`,
    modes: ['teacher'],
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string', description: 'Section to enrich' },
        src: {
          type: 'string',
          description: 'Public image URL, /media path, or a small data URL from the generated raster image',
        },
        alt: { type: 'string', description: 'Specific accessible description of the illustration' },
        caption: { type: 'string', description: 'Optional learner-facing caption' },
      },
      required: ['sectionId', 'src', 'alt'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_begin_media_upload',
    title: 'Begin chunked media upload',
    description:
      'Rank 4 AMDP intake (json-chunk). Use only after cas-hit, plane-put, and merkle-slice failed or were unavailable — then stop after commit succeeds. WebMCP tool calls are JSON — do not pass a full data URL when it is larger than a few thousand characters. Returns uploadId and maxChunkChars. Then call lectern_append_media_chunk repeatedly and lectern_commit_media_upload. Commit stores a data URL on the lesson so the exported PDF both draws the figure and embeds the bytes in the LCT1 restore pack (not IndexedDB-only).',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_append_media_chunk',
    title: 'Append media upload chunk',
    description:
      'Append one base64 slice to an upload started with lectern_begin_media_upload. Pass at most 6000 characters (4000 is safer for CDP). Raw standard/URL-safe base64, or a slice of a data URL, is accepted; whitespace is ignored. Repeat until the file is complete, then lectern_commit_media_upload.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_commit_media_upload',
    title: 'Commit chunked media upload',
    description:
      'Finish a chunked upload and attach the bytes to the lesson document as a data URL (same persistence as the one-shot attach tools). The exported PDF draws raster images on the page and stores the same bytes in the LCT1 restore protocol so a later PDF upload rebuilds the media. Video is kept in LCT1 for restore; the printable PDF shows a caption. purpose: illustration, section, or quiz-choice.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_offer_media',
    title: 'Offer media by content hash',
    description:
      'AMDP control plane: cite a raster/video by sha256, byteLength, and mimeType. Does not send pixels. Returns disposition have (bind immediately) or intake (plane-put, merkle-slice, or json-chunk). ' +
      AMDP_INTAKE_RANKS +
      ' Call lectern_compress_media so the page shrinks the raster (do not recompress with your image generator), then lectern_bind_media with the returned sha256.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_put_media_slice',
    title: 'Put one AMDP Merkle slice',
    description:
      'AMDP merkle-slice intake: send one verified slice after lectern_offer_media with merkleLeaves. Pass the slice as base64 (raw bytes of that slice only). Repeat until complete is true, then lectern_compress_media if it is a raster, then lectern_bind_media.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_compress_media',
    title: 'Compress CAS raster on this page',
    description:
      'Shrink a raster already in this tab’s CAS (after plane-put or json-chunk). Lectern downscales and JPEG-encodes on the page — do not recompress with your image generator. Returns sha256 / byteLength / mimeType to bind. If changed is false, bind the same hash. Call this before lectern_bind_media when the generated file is large. Video is not compressed (keep under 6 MB).',
    modes: ['teacher'],
    inputSchema: {
      type: 'object',
      properties: {
        sha256: { type: 'string', description: 'SHA-256 of a raster already in this tab’s CAS' },
      },
      required: ['sha256'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_bind_media',
    title: 'Bind CAS media onto the lesson',
    description:
      'AMDP bind: attach a hash already in this tab’s CAS (after offer cas-hit, put, merkle complete, json-chunk assemble, or lectern_compress_media). If the raster is over ~1.8 MB, call lectern_compress_media first and bind the returned sha256. Writes a data URL onto the lesson for PDF draw + LCT1 restore. purpose: illustration, section, or quiz-choice.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_media_status',
    title: 'Media CAS status',
    description:
      'AMDP status: whether this tab already has the cited sha256, plus merkle progress if an offer is in flight. Read-only.',
    modes: ['teacher'],
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        sha256: { type: 'string', description: 'SHA-256 to look up' },
      },
      required: ['sha256'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_audit_visual_learning',
    title: 'Audit visual learning coverage',
    description:
      'Check whether the lesson has both AI-generated raster illustrations for engagement and SVG schematics/templates for explanation. Call this before publishing; use the returned recommendations to fill missing variety.',
    modes: ['teacher'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_list_media_templates',
    title: 'List media templates',
    description:
      'List Lectern schematic / animated figure templates (30 presets). Each entry includes id, title, description, tags, params schema, and whenToUse guidance. Call this before lectern_generate_section_media so you pick the right layout (graph, cycle, compare, WebMCP bridge, custom SVG, etc.).',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_preview_media_template',
    title: 'Preview media template',
    description:
      'Render a schematic or animated SVG from a template id + params without attaching. Returns dataUrl for inspection. Use lectern_list_media_templates for ids and param keys.',
    modes: ['teacher'],
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'Template id from lectern_list_media_templates' },
        params: {
          type: 'object',
          description:
            'Template-specific parameters (title, steps, labels, svg markup for custom-svg, etc.)',
          additionalProperties: true,
        },
      },
      required: ['templateId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_generate_section_media',
    title: 'Generate section media from template',
    description:
      'Render a Lectern-styled schematic or animated SVG from a catalog template, then attach it to a section. Workflow: lectern_list_media_templates -> pick id -> fill params -> this tool. For fully bespoke art, use templateId custom-svg with params.svg, or attach remote images with lectern_attach_section_media.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_attach_section_media',
    title: 'Attach media to a section',
    description:
      `Attach an image or video to a material section by URL or site path (e.g. /media/demo/leaf-factory.svg). Remote and blob URLs are inlined immediately; site paths are embedded when exporting .lectern or PDF. For schematic/animated figures, prefer lectern_generate_section_media with a catalog template. ${CHUNKED_MEDIA_HINT}`,
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_remove_section_media',
    title: 'Remove section media',
    description: 'Remove an attached photo/video from a section by media id.',
    modes: ['teacher'],
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: { type: 'string' },
        mediaId: { type: 'string' },
      },
      required: ['sectionId', 'mediaId'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_remove_section',
    title: 'Remove section',
    description: 'Delete a lesson section by id.',
    modes: ['teacher'],
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Section id' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_upsert_quiz_item',
    title: 'Upsert quiz item',
    description:
      'Create or update a multiple-choice check for understanding. A good Lectern lesson needs materials AND tests. Optional sectionId places the check after that section (soft pause); omit sectionId for the end-of-lesson quiz. For concrete objects or visual recognition, follow creation with lectern_attach_quiz_choice_media once per choice so students can answer with image cards.',
    modes: ['teacher'],
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
          description:
            'Optional media cards aligned to choices; use lectern_attach_quiz_choice_media after creation for generated images.',
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
  },
  {
    name: 'lectern_attach_quiz_choice_media',
    title: 'Attach generated image to a quiz answer',
    description:
      `Attach a generated raster image as a selectable visual answer card for one quiz choice. Use this proactively for concrete vocabulary, tools, animals, maps, objects, or symbols (for example, show four tool cards for “Which tool holds hot metal?”). First generate four clear, age-appropriate, label-free images with your image-generation capability; then attach one image per answer index. Students see the cards and choose as normal. ${CHUNKED_MEDIA_HINT}`,
    modes: ['teacher'],
    inputSchema: {
      type: 'object',
      properties: {
        quizId: { type: 'string', description: 'Quiz id from lectern_get_lesson' },
        choiceIndex: { type: 'number', description: '0-based answer-choice index' },
        src: {
          type: 'string',
          description: 'Public raster image URL, /media path, or data URL from image generation',
        },
        alt: { type: 'string', description: 'Accessible description of the pictured answer choice' },
      },
      required: ['quizId', 'choiceIndex', 'src', 'alt'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_remove_quiz_item',
    title: 'Remove quiz item',
    description: 'Delete a quiz item by id.',
    modes: ['teacher'],
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Quiz item id' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'lectern_list_library',
    title: 'List Your materials',
    description:
      'List lessons on this device from Save & load → Your materials, plus Demo materials. Returns ids for lectern_switch_lesson. Use this instead of scraping the Save & load panel when the teacher wants to work on a different saved draft. Does not return the full manuscript — call lectern_get_lesson after switching.',
    modes: ['teacher'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_switch_lesson',
    title: 'Switch working materials',
    description:
      'Switch the teacher manuscript to another lesson on this device — same as opening a row under Your materials, or a Demo materials card. Pass id from lectern_list_library (yours[].id) or a demo id (photosynthesis, webmcp, cossacks). The current lesson stays listed under Your materials unless it is a blank unused draft. Do not scrape the Save & load panel.',
    modes: ['teacher'],
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
  },
  {
    name: 'lectern_new_lesson',
    title: 'Start a blank lesson',
    description:
      'Start a new blank lesson in Teacher mode (same as New blank in Save & load). The current lesson stays listed under Your materials. Use this when the teacher wants a fresh page, not when they asked to switch to an existing draft.',
    modes: ['teacher'],
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_save_lesson',
    title: 'Save lesson (.lectern)',
    description:
      'Persist the current lesson under Your materials on this device and download a .lectern file (same as Download .lectern in Save & load). Teachers reopen authoring from that file. Does not export a student PDF. Blank unused drafts are saved to the library but not downloaded. To load a file payload, use lectern_import_restore.',
    modes: ['teacher'],
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_publish_lesson',
    title: 'Publish lesson',
    description:
      'Validate gaps and mark the lesson ready. Does not mint a student URL — the studio URL stays https://lectern.click/studio. Tell the teacher to export a PDF for students and a .lectern file to keep writing. Students upload the PDF in Save & load; teachers reopen authoring from .lectern only.',
    modes: ['teacher'],
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_get_restore_payload',
    title: 'Get PDF restore payload',
    description:
      'Return the compressed Lectern restore payload (LCT1.…) and LECTERN_PDF/v1 part blocks used on system pages at the end of an exported PDF. Teachers export PDF from the UI; this tool gives the agent the same machine-readable pack so a student can later call lectern_import_restore.',
    modes: ['teacher'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
  {
    name: 'lectern_import_restore',
    title: 'Import lesson from PDF restore data',
    description:
      'Load a lesson from a Lectern PDF (upload in UI reads LECTERN_PDF/v1 system pages), LCT1 payload, legacy QR sheet lines, or .lectern JSON. Pass the full LCT1.… payload, LECTERN_PDF/v1 text blocks, raw JSON, or newline-joined legacy QR lines (LCT1|i/n|id|chunk). A .lectern file opens teacher (authoring). PDF / LCT1 restore opens student mode and does not reopen the teacher tab — switching to teacher shows this device’s draft or an empty page, not the PDF lesson. To keep writing, load a .lectern file.',
    modes: ['teacher', 'student'],
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
  },
  {
    name: 'lectern_add_annotation',
    title: 'Add student annotation',
    description:
      'Leave a student mark on a section. Use kind "learned" for a one-click learned mark, or kind "note" (default) for confusion, questions, or takeaways.',
    modes: ['student'],
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
  },
  {
    name: 'lectern_list_annotations',
    title: 'List annotations',
    description: 'List all student annotations on the current lesson.',
    modes: ['student'],
    annotations: { readOnlyHint: true },
    inputSchema: emptyObject,
  },
];

export type EvalsToolSchema = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export function catalogForMode(mode: WebMcpToolMode): WebMcpCatalogTool[] {
  return WEB_MCP_TOOL_CATALOG.filter((tool) => tool.modes.includes(mode));
}

export function catalogTool(name: string): WebMcpCatalogTool {
  const tool = WEB_MCP_TOOL_CATALOG.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Unknown WebMCP catalog tool: ${name}`);
  }
  return tool;
}

/** Chrome evals-cli / local schema shape: full tool list for one application state. */
export function toEvalsSchema(mode: WebMcpToolMode): EvalsToolSchema[] {
  return catalogForMode(mode).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}
