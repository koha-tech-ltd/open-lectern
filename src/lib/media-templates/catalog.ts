import type { MediaTemplateDefinition } from '@/types/media-template';

const p = (
  key: string,
  type: MediaTemplateDefinition['params'][number]['type'],
  description: string,
  extra?: Partial<MediaTemplateDefinition['params'][number]>,
) => ({ key, type, description, ...extra });

/** Thirty reusable schematic / animated figure recipes for Lectern materials. */
export const MEDIA_TEMPLATE_CATALOG: MediaTemplateDefinition[] = [
  {
    id: 'title-card',
    title: 'Title card',
    description: 'Manuscript header plate: large title, subtitle, optional eyebrow label.',
    medium: 'card',
    tags: ['intro', 'header', 'layout'],
    whenToUse: 'Open a section or lesson with a clean title slide matching Lectern cream/forest styling.',
    animated: false,
    params: [
      p('title', 'string', 'Main heading', { required: true, example: 'Photosynthesis overview' }),
      p('subtitle', 'string', 'Supporting line under the title', { example: 'Inputs, light, and outputs' }),
      p('eyebrow', 'string', 'Small label above title', { example: 'Grade 8 biology' }),
    ],
  },
  {
    id: 'input-output-flow',
    title: 'Input / process / output',
    description: 'Left inputs, center process box, right outputs with arrows — classic reaction or system diagram.',
    medium: 'schematic',
    tags: ['science', 'process', 'chemistry', 'biology'],
    whenToUse: 'Show reactants -> process -> products (e.g. CO2 + H2O -> photosynthesis -> sugar + O2).',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('subtitle', 'string', 'One-line caption under title'),
      p('inputs', 'string[]', 'Left column labels', { required: true, example: ['CO2', 'H2O'] }),
      p('process', 'string', 'Center process label', { required: true, example: 'chloroplast' }),
      p('outputs', 'string[]', 'Right column labels', { required: true, example: ['sugar', 'O2'] }),
    ],
  },
  {
    id: 'process-pipeline',
    title: 'Process pipeline',
    description: 'Horizontal chain of numbered steps connected by arrows.',
    medium: 'schematic',
    tags: ['sequence', 'steps', 'workflow'],
    whenToUse: 'Linear multi-step procedures (lab protocol, writing process, algorithm stages).',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('steps', 'string[]', 'Step labels left-to-right (2-6 items)', { required: true }),
    ],
  },
  {
    id: 'labeled-cycle',
    title: 'Labeled cycle',
    description: 'Circular arrangement of nodes around a center hub — static cycle diagram.',
    medium: 'diagram',
    tags: ['cycle', 'biology', 'systems'],
    whenToUse: 'Water cycle, nutrient cycle, feedback loops without motion.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('center', 'string', 'Hub label', { example: 'leaf' }),
      p('nodes', 'string[]', 'Labels placed around the circle (3-6)', { required: true }),
    ],
  },
  {
    id: 'rotating-cycle',
    title: 'Rotating cycle (animated)',
    description: 'Orbiting nodes animate around a center — like the photosynthesis demo cycle.',
    medium: 'animated',
    tags: ['cycle', 'animation', 'biology'],
    whenToUse: 'Emphasize continuous cycling (energy flow, recycling, recurring process).',
    animated: true,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('center', 'string', 'Center hub label', { required: true }),
      p('nodes', 'string[]', 'Orbiting labels (3-4 work best)', { required: true }),
    ],
  },
  {
    id: 'compare-two-panel',
    title: 'Two-panel compare',
    description: 'Side-by-side panels with titles and bullet lines — cloudy vs sunny, before vs after teaching.',
    medium: 'schematic',
    tags: ['compare', 'contrast', 'split'],
    whenToUse: 'Contrast two conditions, strategies, or scenarios.',
    animated: false,
    params: [
      p('title', 'string', 'Overall figure title', { required: true }),
      p('leftTitle', 'string', 'Left panel heading', { required: true }),
      p('rightTitle', 'string', 'Right panel heading', { required: true }),
      p('leftLines', 'string[]', 'Left panel bullets', { required: true }),
      p('rightLines', 'string[]', 'Right panel bullets', { required: true }),
    ],
  },
  {
    id: 'before-after',
    title: 'Before / after',
    description: 'Two states with a central arrow and short state descriptions.',
    medium: 'schematic',
    tags: ['compare', 'change', 'transformation'],
    whenToUse: 'Show transformation (draft -> published, reactants -> products, misconception -> correction).',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('before', 'string', 'Before state label', { required: true }),
      p('after', 'string', 'After state label', { required: true }),
      p('beforeDetail', 'string', 'Extra line under before'),
      p('afterDetail', 'string', 'Extra line under after'),
    ],
  },
  {
    id: 'venn-overlap',
    title: 'Venn overlap',
    description: 'Two overlapping circles with left-only, overlap, and right-only labels.',
    medium: 'diagram',
    tags: ['compare', 'sets', 'logic'],
    whenToUse: 'Shared vs distinct traits (animal vs plant cells, two historical events).',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('leftLabel', 'string', 'Left circle name', { required: true }),
      p('rightLabel', 'string', 'Right circle name', { required: true }),
      p('leftOnly', 'string', 'Text in left-only region'),
      p('overlap', 'string', 'Text in overlap'),
      p('rightOnly', 'string', 'Text in right-only region'),
    ],
  },
  {
    id: 'line-graph',
    title: 'Line graph',
    description: 'XY axes with optional dashed asymptote and a smooth curve — saturation curves, trends.',
    medium: 'diagram',
    tags: ['math', 'graph', 'data', 'science'],
    whenToUse: 'Rate vs intensity, growth curves, any monotonic trend with axis labels.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('xLabel', 'string', 'X axis label', { required: true }),
      p('yLabel', 'string', 'Y axis label', { required: true }),
      p('maxLabel', 'string', 'Dashed horizontal limit label', { example: 'r_max' }),
      p('noteLeft', 'string', 'Annotation on rising part'),
      p('noteRight', 'string', 'Annotation on flat part'),
    ],
  },
  {
    id: 'motion-curve',
    title: 'Motion along curve (animated)',
    description: 'Line graph with a dot animating along the path — climbing then saturating.',
    medium: 'animated',
    tags: ['math', 'graph', 'animation', 'science'],
    whenToUse: 'Show dynamic change along a response curve (photosynthesis rate, learning progress).',
    animated: true,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('xLabel', 'string', 'X axis label', { required: true }),
      p('yLabel', 'string', 'Y axis label', { required: true }),
      p('noteLeft', 'string', 'Label on rising region', { example: 'climbing' }),
      p('noteRight', 'string', 'Label on flat region', { example: 'saturated' }),
    ],
  },
  {
    id: 'bar-chart',
    title: 'Bar chart',
    description: 'Simple vertical bars with labels — compare magnitudes across categories.',
    medium: 'diagram',
    tags: ['data', 'chart', 'compare'],
    whenToUse: 'Compare counts, scores, or relative sizes across 3-6 categories.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('labels', 'string[]', 'Category names', { required: true }),
      p('values', 'number[]', 'Bar heights 0-100 (same length as labels)', { required: true }),
      p('yLabel', 'string', 'Optional Y axis caption'),
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline',
    description: 'Horizontal timeline with dated or ordered events.',
    medium: 'schematic',
    tags: ['history', 'sequence', 'events'],
    whenToUse: 'Historical sequences, lesson milestones, experimental phases.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('events', 'string[]', 'Event labels in order (3-6)', { required: true }),
    ],
  },
  {
    id: 'hierarchy-tree',
    title: 'Hierarchy tree',
    description: 'Top-down tree: root node branching to children.',
    medium: 'diagram',
    tags: ['structure', 'taxonomy', 'organization'],
    whenToUse: 'Classification trees, org charts, concept breakdowns.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('root', 'string', 'Top node label', { required: true }),
      p('children', 'string[]', 'Second-level nodes (2-4)', { required: true }),
    ],
  },
  {
    id: 'concept-map',
    title: 'Concept map',
    description: 'Central idea with satellite concepts connected by lines.',
    medium: 'diagram',
    tags: ['mindmap', 'relations', 'overview'],
    whenToUse: 'Relate one core idea to supporting concepts at a glance.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('center', 'string', 'Central concept', { required: true }),
      p('satellites', 'string[]', 'Surrounding concepts (3-6)', { required: true }),
    ],
  },
  {
    id: 'annotated-center',
    title: 'Annotated center diagram',
    description: 'Large central shape with callout labels around it — anatomy, machine parts.',
    medium: 'schematic',
    tags: ['labels', 'anatomy', 'parts'],
    whenToUse: 'Label parts of one object (leaf, cell, engine, UI screen).',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('centerShape', 'string', 'Center object label', { required: true }),
      p('labels', 'string[]', 'Callout labels (3-6)', { required: true }),
    ],
  },
  {
    id: 'definition-card',
    title: 'Definition card',
    description: 'Callout-styled card: term + definition paragraph matching manuscript Definition blocks.',
    medium: 'card',
    tags: ['vocabulary', 'definition', 'callout'],
    whenToUse: 'Highlight a key term visually alongside prose Definition callouts.',
    animated: false,
    params: [
      p('term', 'string', 'Vocabulary term', { required: true }),
      p('definition', 'string', 'Short definition (1-2 sentences)', { required: true }),
      p('subject', 'string', 'Optional subject tag', { example: 'Biology' }),
    ],
  },
  {
    id: 'equation-strip',
    title: 'Equation strip',
    description: 'Prominent equation or formula on a dark strip — pairs with KaTeX in body text.',
    medium: 'card',
    tags: ['math', 'formula', 'chemistry'],
    whenToUse: 'Feature one governing equation (rate law, chemical equation, physics formula).',
    animated: false,
    params: [
      p('title', 'string', 'Figure title above strip', { required: true }),
      p('equation', 'string', 'Equation text (ASCII-safe)', { required: true }),
      p('caption', 'string', 'Caption under equation'),
    ],
  },
  {
    id: 'checklist-steps',
    title: 'Checklist steps',
    description: 'Numbered vertical checklist with forest green step badges.',
    medium: 'schematic',
    tags: ['procedure', 'steps', 'how-to'],
    whenToUse: 'Lab safety steps, problem-solving routine, WebMCP teacher loop.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('steps', 'string[]', 'Step lines (3-8)', { required: true }),
    ],
  },
  {
    id: 'cause-effect-chain',
    title: 'Cause / effect chain',
    description: 'Causes on the left flowing into a single effect box on the right.',
    medium: 'schematic',
    tags: ['causality', 'reasoning', 'science'],
    whenToUse: 'Multiple causes leading to one outcome (greenhouse effect, error sources).',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('causes', 'string[]', 'Cause labels', { required: true }),
      p('effect', 'string', 'Effect label', { required: true }),
    ],
  },
  {
    id: 'pros-cons-columns',
    title: 'Pros / cons columns',
    description: 'Two-column advantages vs disadvantages layout.',
    medium: 'schematic',
    tags: ['debate', 'compare', 'analysis'],
    whenToUse: 'Evaluate methods, technologies, or historical decisions.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('pros', 'string[]', 'Advantage bullets', { required: true }),
      p('cons', 'string[]', 'Disadvantage bullets', { required: true }),
    ],
  },
  {
    id: 'flow-with-feedback',
    title: 'Flow with feedback loop',
    description: 'Linear forward flow plus dashed feedback arc underneath.',
    medium: 'diagram',
    tags: ['systems', 'feedback', 'control'],
    whenToUse: 'Thermostats, homeostasis, revision loops in writing or WebMCP co-pilot.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('steps', 'string[]', 'Forward steps (3-5)', { required: true }),
      p('feedbackLabel', 'string', 'Label on feedback arc', { example: 'review and revise' }),
    ],
  },
  {
    id: 'number-line',
    title: 'Number line',
    description: 'Horizontal number line with tick marks and highlighted points.',
    medium: 'diagram',
    tags: ['math', 'number', 'fractions'],
    whenToUse: 'Locate values, intervals, or inequalities on a line.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('min', 'number', 'Minimum value', { required: true, example: 0 }),
      p('max', 'number', 'Maximum value', { required: true, example: 10 }),
      p('marks', 'number[]', 'Values to highlight with dots'),
      p('markLabels', 'string[]', 'Labels for marks (same order)'),
    ],
  },
  {
    id: 'fraction-bars',
    title: 'Fraction bars',
    description: 'Side-by-side bar models comparing fractions or parts of a whole.',
    medium: 'diagram',
    tags: ['math', 'fractions', 'visual'],
    whenToUse: 'Compare 1/2 vs 3/4, show part-whole visually for younger learners.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('bars', 'string[]', 'Labels like "1/2" or "3/4" (2-4 bars)', { required: true }),
    ],
  },
  {
    id: 'table-grid',
    title: 'Table grid',
    description: 'Simple grid table rendered as an SVG figure — good for vocabulary or data snapshots.',
    medium: 'card',
    tags: ['table', 'data', 'vocabulary'],
    whenToUse: 'Small reference tables when markdown tables need a figure companion.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('headers', 'string[]', 'Column headers', { required: true }),
      p('rows', 'string[]', 'Flat row cells row-major (length multiple of headers)', { required: true }),
    ],
  },
  {
    id: 'quiz-choice-board',
    title: 'Quiz choice board',
    description: 'Visual board showing a question stem and lettered choices A-D.',
    medium: 'card',
    tags: ['assessment', 'quiz', 'review'],
    whenToUse: 'Preview a check-for-understanding item as a figure in materials.',
    animated: false,
    params: [
      p('prompt', 'string', 'Question stem', { required: true }),
      p('choices', 'string[]', 'Answer choices (2-4)', { required: true }),
    ],
  },
  {
    id: 'pulse-callout',
    title: 'Pulse callout (animated)',
    description: 'Highlighted box with a gentle pulsing ring — draw attention to one key idea.',
    medium: 'animated',
    tags: ['emphasis', 'animation', 'callout'],
    whenToUse: 'Animate a single takeaway, warning, or exam tip.',
    animated: true,
    params: [
      p('title', 'string', 'Short headline', { required: true }),
      p('body', 'string', 'Supporting sentence', { required: true }),
      p('tone', 'string', 'Visual tone: takeaway | warning | note', { example: 'takeaway' }),
    ],
  },
  {
    id: 'step-sequence',
    title: 'Step sequence highlight (animated)',
    description: 'Steps fade/highlight in sequence — good for procedures or storytelling beats.',
    medium: 'animated',
    tags: ['animation', 'sequence', 'procedure'],
    whenToUse: 'Walk through 3-5 beats one at a time (experimental method, narrative arc).',
    animated: true,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('steps', 'string[]', 'Steps to highlight in order (3-5)', { required: true }),
    ],
  },
  {
    id: 'webmcp-bridge',
    title: 'WebMCP bridge',
    description: 'Agent on the left, Lectern page on the right, tools arrow — teach WebMCP architecture.',
    medium: 'schematic',
    tags: ['webmcp', 'agent', 'tools'],
    whenToUse: 'Explain how an AI agent calls page tools instead of only chatting about the page.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { example: 'WebMCP bridge' }),
      p('agentLabel', 'string', 'Left box label', { example: 'AI agent' }),
      p('pageLabel', 'string', 'Right box label', { example: 'Lectern page' }),
      p('footnote', 'string', 'Bottom explanation line'),
    ],
  },
  {
    id: 'tool-stack-map',
    title: 'Tool stack map',
    description: 'Stack of tool name blocks plus a side panel loop summary — maps Lectern WebMCP tools.',
    medium: 'schematic',
    tags: ['webmcp', 'tools', 'reference'],
    whenToUse: 'Show which lectern_* tools exist and how teacher/student loops differ.',
    animated: false,
    params: [
      p('title', 'string', 'Figure title', { required: true }),
      p('tools', 'string[]', 'Tool names to list (4-8)', { required: true }),
      p('loopTitle', 'string', 'Side panel heading', { example: 'Teacher loop' }),
      p('loopSteps', 'string[]', 'Side panel steps (3-5)'),
    ],
  },
  {
    id: 'custom-svg',
    title: 'Custom SVG (from scratch)',
    description:
      'Supply full SVG markup when no preset fits. Must be valid SVG root element, ASCII-safe, 1280x720 recommended.',
    medium: 'schematic',
    tags: ['custom', 'advanced', 'agent'],
    whenToUse:
      'Generate a bespoke schematic or animation from scratch while keeping Lectern palette (#F4EFE6, #24382C, #C4A35A).',
    animated: false,
    params: [
      p('svg', 'string', 'Complete <svg>...</svg> document string', { required: true }),
      p('animated', 'boolean', 'Set true if SVG contains SMIL/CSS animation'),
    ],
  },
];

export function getMediaTemplate(id: string): MediaTemplateDefinition | undefined {
  return MEDIA_TEMPLATE_CATALOG.find((t) => t.id === id);
}

export function listMediaTemplateSummaries(filter?: {
  tag?: string;
  query?: string;
  animatedOnly?: boolean;
}): MediaTemplateDefinition[] {
  let list = [...MEDIA_TEMPLATE_CATALOG];
  if (filter?.animatedOnly) list = list.filter((t) => t.animated);
  if (filter?.tag) {
    const tag = filter.tag.toLowerCase();
    list = list.filter((t) => t.tags.some((x) => x.toLowerCase().includes(tag)));
  }
  if (filter?.query) {
    const q = filter.query.toLowerCase();
    list = list.filter(
      (t) =>
        t.id.includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((x) => x.toLowerCase().includes(q)),
    );
  }
  return list;
}
