import type { LessonDocument, LessonSection, SectionMedia } from '@/types/lesson';

export type VisualTemplateRecommendation = {
  templateId: string;
  params: Record<string, unknown>;
  rationale: string;
};

function compact(text: string, limit = 120): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

export function isGeneratedIllustration(media: SectionMedia): boolean {
  return /(?:^|[-_])ai(?:[._-]|$)/i.test(media.src) || /(?:^|[-_])ai(?:[._-]|$)/i.test(media.name ?? '');
}

export function isSchematicVisual(media: SectionMedia): boolean {
  return media.src.startsWith('data:image/svg') || /\.svg(?:\?|$)/i.test(media.src) || /\.svg$/i.test(media.name ?? '');
}

export function recommendExplainer(section: LessonSection, subject: string): VisualTemplateRecommendation {
  const text = `${section.title} ${section.body}`.toLowerCase();
  if (/істор|history|століт|року|century|timeline|хронолог/.test(`${subject} ${text}`.toLowerCase())) {
    return {
      templateId: 'timeline',
      params: { title: section.title, events: ['Передумови', 'Подія', 'Наслідки'] },
      rationale: 'A timeline helps learners see sequence and historical cause-and-effect.',
    };
  }
  if (/порівн|compare|difference|vs\b|проти/.test(text)) {
    return {
      templateId: 'compare-two-panel',
      params: { title: section.title, leftTitle: 'Перший випадок', rightTitle: 'Другий випадок', leftLines: ['Ознака 1', 'Ознака 2'], rightLines: ['Ознака 1', 'Ознака 2'] },
      rationale: 'A two-panel comparison makes distinctions explicit.',
    };
  }
  if (/причин|наслід|cause|effect|because|тому що/.test(text)) {
    return {
      templateId: 'cause-effect-chain',
      params: { title: section.title, causes: ['Причина 1', 'Причина 2'], effect: 'Наслідок' },
      rationale: 'A cause-effect chain reveals why the process or event happened.',
    };
  }
  return {
    templateId: 'process-pipeline',
    params: { title: section.title, steps: ['Початок', 'Основна дія', 'Результат'] },
    rationale: 'A short process diagram turns the central explanation into an at-a-glance model.',
  };
}

export function buildIllustrationBrief(section: LessonSection, lesson: LessonDocument): string {
  const focus = compact(section.body, 320);
  return [
    'Use case: historical-scene',
    'Asset type: one engaging textbook illustration for a Lectern lesson',
    `Primary request: illustrate “${section.title}” for ${lesson.meta.audience || 'school learners'}.`,
    `Scene/backdrop: ${focus}`,
    'Style/medium: polished educational editorial illustration, historically and culturally respectful where relevant, realistic material detail.',
    'Composition/framing: clear focal subject, wide or medium scene, leave uncluttered space for a caption; suitable beside prose.',
    'Constraints: age-appropriate; show the topic rather than decorative symbols; no embedded text, no logos, no watermark; avoid graphic violence and stereotypes.',
    'After generating: AMDP is the default. Cite sha256 with lectern_offer_media. Try every intake rank in order until lectern_media_status present is true, then lectern_compress_media (do not recompress with your image generator), lectern_bind_media, and STOP. Do not skip a later rank because an earlier one failed. Ranks: 1) cas-hit 2) plane-put (temp file, temporary <input type="file"> on body, Lectern hides it; page plane-puts on change; optional arrayBuffer → window.__lecternAmdp.put; if DOM.setFileInputFiles denied, go to 3) 3) merkle-slice 4) json-chunk lectern_begin_media_upload → append → commit. Never pass base64 as evaluate_script.args. Do not use the section Attach-media picker. Do not put pixels in chat JSON. Public URLs may still use lectern_attach_generated_illustration. SVG explainers stay on lectern_generate_section_media. Bind/commit store a data URL on the lesson so the exported PDF both draws the figure and keeps the bytes in the LCT1 restore pack.',
  ].join('\n');
}

export function auditVisualLearning(lesson: LessonDocument) {
  const sections = lesson.sections.map((section) => {
    const media = section.media ?? [];
    const generatedIllustrations = media.filter(isGeneratedIllustration).length;
    const schematics = media.filter(isSchematicVisual).length;
    return {
      sectionId: section.id,
      title: section.title,
      generatedIllustrations,
      schematics,
      complete: generatedIllustrations > 0 && schematics > 0,
      recommendation: generatedIllustrations === 0 || schematics === 0 ? recommendExplainer(section, lesson.meta.subject) : undefined,
    };
  });
  return {
    generatedIllustrations: sections.reduce((total, section) => total + section.generatedIllustrations, 0),
    schematics: sections.reduce((total, section) => total + section.schematics, 0),
    sections,
    ready: sections.some((section) => section.complete),
    nextStep: 'For a strong lesson, create at least one visual pair: a generated scene for engagement plus a template SVG for explanation.',
  };
}
