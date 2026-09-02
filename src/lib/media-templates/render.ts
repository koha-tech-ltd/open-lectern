import { getMediaTemplate } from '@/lib/media-templates/catalog';
import {
  H,
  PALETTE,
  W,
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  clampLines,
  esc,
  header,
  svgDoc,
} from '@/lib/media-templates/helpers';
import type { MediaTemplateParams, RenderedMediaTemplate } from '@/types/media-template';

function renderTitleCard(params: MediaTemplateParams): string {
  const title = asString(params.title, 'Lesson figure');
  const subtitle = asString(params.subtitle);
  const eyebrow = asString(params.eyebrow);
  const eyebrowSvg = eyebrow
    ? `<text x="64" y="220" font-family="IBM Plex Mono, monospace" font-size="14" fill="${PALETTE.ochre}" letter-spacing="0.12em">${esc(eyebrow.toUpperCase())}</text>`
    : '';
  return svgDoc(
    `${eyebrowSvg}<text x="64" y="290" font-family="Georgia, serif" font-size="52" fill="${PALETTE.forest}" font-weight="600">${esc(title)}</text>${
      subtitle
        ? `<text x="64" y="360" font-family="Segoe UI, sans-serif" font-size="24" fill="${PALETTE.walnut}">${esc(subtitle)}</text>`
        : ''
    }<rect x="64" y="420" width="420" height="6" fill="${PALETTE.brass}"/>`,
    PALETTE.ivory,
  );
}

function renderInputOutputFlow(params: MediaTemplateParams): string {
  const inputs = clampLines(asStringArray(params.inputs, 4), 1, 4);
  const outputs = clampLines(asStringArray(params.outputs, 4), 1, 4);
  const process = asString(params.process, 'process');
  const inputYs = inputs.map((_, i) => 260 + i * 70);
  const outputYs = outputs.map((_, i) => 260 + i * 70);
  const inputSvg = inputs
    .map(
      (label, i) =>
        `<rect x="100" y="${inputYs[i] - 28}" width="180" height="56" rx="10" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><text x="190" y="${inputYs[i] + 6}" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="${PALETTE.forest}">${esc(label)}</text>`,
    )
    .join('');
  const outputSvg = outputs
    .map(
      (label, i) =>
        `<rect x="1000" y="${outputYs[i] - 28}" width="180" height="56" rx="10" fill="${PALETTE.ivory}" stroke="${PALETTE.pine}" stroke-width="2"/><text x="1090" y="${outputYs[i] + 6}" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="${PALETTE.forest}">${esc(label)}</text>`,
    )
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Flow'), asString(params.subtitle))}${inputSvg}<rect x="520" y="300" width="240" height="120" rx="16" fill="${PALETTE.forest}"/><text x="640" y="370" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="${PALETTE.ivory}">${esc(process)}</text><path d="M290 360 H500" stroke="${PALETTE.brass}" stroke-width="5"/><polygon points="500,350 530,360 500,370" fill="${PALETTE.brass}"/><path d="M770 360 H990" stroke="${PALETTE.brass}" stroke-width="5"/><polygon points="990,350 1020,360 990,370" fill="${PALETTE.brass}"/>${outputSvg}`,
  );
}

function renderProcessPipeline(params: MediaTemplateParams): string {
  const steps = clampLines(asStringArray(params.steps, 6), 2, 6);
  const gap = Math.min(180, Math.floor(980 / steps.length));
  const startX = 120;
  const parts = steps
    .map((step, i) => {
      const x = startX + i * gap;
      const arrow =
        i < steps.length - 1
          ? `<path d="M${x + 130} 400 H${x + gap - 20}" stroke="${PALETTE.brass}" stroke-width="4"/><polygon points="${x + gap - 20},390 ${x + gap},400 ${x + gap - 20},410" fill="${PALETTE.brass}"/>`
          : '';
      return `<rect x="${x}" y="340" width="120" height="120" rx="12" fill="${i % 2 ? PALETTE.pine : PALETTE.forest}"/><text x="${x + 60}" y="385" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="22" fill="${PALETTE.brass}">${i + 1}</text><text x="${x + 60}" y="425" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="14" fill="${PALETTE.ivory}">${esc(step.slice(0, 18))}</text>${arrow}`;
    })
    .join('');
  return svgDoc(`${header(asString(params.title, 'Pipeline'))}${parts}`);
}

function renderLabeledCycle(params: MediaTemplateParams, animated: boolean): string {
  const nodes = clampLines(asStringArray(params.nodes, animated ? 4 : 6), 3, animated ? 4 : 6);
  const cx = 640;
  const cy = 400;
  const r = 180;
  const nodeR = 22;
  const center = asString(params.center, 'hub');
  const ring = animated
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE.brass}" stroke-width="3" stroke-dasharray="12 10"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE.brass}" stroke-width="3"/>`;
  const nodeSvg = nodes
    .map((label, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + Math.cos(angle) * r;
      const ny = cy + Math.sin(angle) * r;
      if (animated) {
        const from = (i / nodes.length) * 360;
        const to = from + 360;
        return `<g><animateTransform attributeName="transform" type="rotate" from="${from} ${cx} ${cy}" to="${to} ${cx} ${cy}" dur="8s" repeatCount="indefinite"/><circle cx="${cx}" cy="${cy - r}" r="${nodeR}" fill="${i % 2 ? PALETTE.pine : PALETTE.ochre}"/><text x="${cx}" y="${cy - r + 5}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" fill="${PALETTE.ivory}">${esc(label.slice(0, 10))}</text></g>`;
      }
      return `<circle cx="${nx}" cy="${ny}" r="${nodeR + 4}" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><text x="${nx}" y="${ny + 5}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="12" fill="${PALETTE.forest}">${esc(label.slice(0, 12))}</text>`;
    })
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Cycle'))}${ring}<ellipse cx="${cx}" cy="${cy}" rx="70" ry="36" fill="${PALETTE.pine}"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="${PALETTE.ivory}">${esc(center)}</text>${nodeSvg}`,
  );
}

function renderCompareTwoPanel(params: MediaTemplateParams): string {
  const leftLines = asStringArray(params.leftLines, 6);
  const rightLines = asStringArray(params.rightLines, 6);
  const leftSvg = leftLines
    .map((line, i) => `<text x="110" y="${240 + i * 36}" font-family="Segoe UI, sans-serif" font-size="17" fill="${PALETTE.walnut}">- ${esc(line)}</text>`)
    .join('');
  const rightSvg = rightLines
    .map((line, i) => `<text x="710" y="${240 + i * 36}" font-family="Segoe UI, sans-serif" font-size="17" fill="${PALETTE.walnut}">- ${esc(line)}</text>`)
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Compare'))}<rect x="80" y="150" width="520" height="480" rx="12" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><text x="110" y="200" font-family="Georgia, serif" font-size="24" fill="${PALETTE.forest}">${esc(asString(params.leftTitle, 'Left'))}</text>${leftSvg}<rect x="680" y="150" width="520" height="480" rx="12" fill="${PALETTE.ivory}" stroke="${PALETTE.brass}" stroke-width="3"/><text x="710" y="200" font-family="Georgia, serif" font-size="24" fill="${PALETTE.ochre}">${esc(asString(params.rightTitle, 'Right'))}</text>${rightSvg}`,
  );
}

function renderBeforeAfter(params: MediaTemplateParams): string {
  return svgDoc(
    `${header(asString(params.title, 'Before / after'))}<rect x="120" y="280" width="360" height="200" rx="14" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><text x="300" y="360" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${PALETTE.forest}">${esc(asString(params.before, 'Before'))}</text><text x="300" y="400" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.walnut}">${esc(asString(params.beforeDetail))}</text><path d="M500 380 H780" stroke="${PALETTE.brass}" stroke-width="6"/><polygon points="780,370 810,380 780,390" fill="${PALETTE.brass}"/><rect x="800" y="280" width="360" height="200" rx="14" fill="${PALETTE.forest}"/><text x="980" y="360" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${PALETTE.ivory}">${esc(asString(params.after, 'After'))}</text><text x="980" y="400" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.brass}">${esc(asString(params.afterDetail))}</text>`,
  );
}

function renderVennOverlap(params: MediaTemplateParams): string {
  return svgDoc(
    `${header(asString(params.title, 'Venn diagram'))}<circle cx="520" cy="400" r="160" fill="${PALETTE.pine}" opacity="0.35"/><circle cx="760" cy="400" r="160" fill="${PALETTE.brass}" opacity="0.35"/><text x="420" y="260" font-family="Georgia, serif" font-size="22" fill="${PALETTE.forest}">${esc(asString(params.leftLabel, 'A'))}</text><text x="820" y="260" font-family="Georgia, serif" font-size="22" fill="${PALETTE.forest}">${esc(asString(params.rightLabel, 'B'))}</text><text x="420" y="410" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.ink}">${esc(asString(params.leftOnly))}</text><text x="620" y="410" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.ink}">${esc(asString(params.overlap))}</text><text x="860" y="410" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.ink}">${esc(asString(params.rightOnly))}</text>`,
  );
}

function renderLineGraph(params: MediaTemplateParams, motion: boolean): string {
  const pathD = 'M160 560 C 300 500, 420 340, 560 280 S 900 210, 1120 205';
  const motionDot = motion
    ? `<circle r="10" fill="${PALETTE.brass}"><animateMotion dur="5s" repeatCount="indefinite" path="${pathD}"/></circle>`
    : '';
  return svgDoc(
    `${header(asString(params.title, 'Graph'), `${asString(params.yLabel)} vs ${asString(params.xLabel)}`)}<line x1="160" y1="560" x2="1120" y2="560" stroke="${PALETTE.walnut}" stroke-width="3"/><line x1="160" y1="560" x2="160" y2="160" stroke="${PALETTE.walnut}" stroke-width="3"/><text x="620" y="610" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.walnut}">${esc(asString(params.xLabel, 'x'))}</text><text x="90" y="360" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.walnut}" transform="rotate(-90 90 360)">${esc(asString(params.yLabel, 'y'))}</text>${
      asString(params.maxLabel)
        ? `<line x1="160" y1="200" x2="1120" y2="200" stroke="${PALETTE.brass}" stroke-width="2" stroke-dasharray="8 8"/><text x="1130" y="206" font-family="Georgia, serif" font-size="18" fill="${PALETTE.ochre}">${esc(asString(params.maxLabel))}</text>`
        : ''
    }<path d="${pathD}" fill="none" stroke="${PALETTE.forest}" stroke-width="5"/>${motionDot}<text x="220" y="500" font-family="Segoe UI, sans-serif" font-size="15" fill="${PALETTE.walnut}">${esc(asString(params.noteLeft))}</text><text x="900" y="250" font-family="Segoe UI, sans-serif" font-size="15" fill="${PALETTE.walnut}">${esc(asString(params.noteRight))}</text>`,
    PALETTE.ivory,
  );
}

function renderBarChart(params: MediaTemplateParams): string {
  const labels = asStringArray(params.labels, 6);
  const valuesRaw = Array.isArray(params.values) ? params.values : [];
  const values = labels.map((_, i) => Math.max(0, Math.min(100, asNumber(valuesRaw[i], 40 + i * 10))));
  const barW = Math.min(120, Math.floor(900 / Math.max(labels.length, 1)));
  const startX = 180;
  const bars = labels
    .map((label, i) => {
      const h = (values[i] / 100) * 320;
      const x = startX + i * (barW + 40);
      const y = 560 - h;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${i % 2 ? PALETTE.pine : PALETTE.forest}"/><text x="${x + barW / 2}" y="590" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="14" fill="${PALETTE.walnut}">${esc(label.slice(0, 14))}</text>`;
    })
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Bar chart'), asString(params.yLabel))}<line x1="160" y1="560" x2="1120" y2="560" stroke="${PALETTE.walnut}" stroke-width="3"/><line x1="160" y1="560" x2="160" y2="200" stroke="${PALETTE.walnut}" stroke-width="3"/>${bars}`,
  );
}

function renderTimeline(params: MediaTemplateParams): string {
  const events = clampLines(asStringArray(params.events, 6), 2, 6);
  const gap = Math.floor(900 / Math.max(events.length - 1, 1));
  const dots = events
    .map((ev, i) => {
      const x = 180 + i * gap;
      return `<circle cx="${x}" cy="400" r="12" fill="${PALETTE.brass}"/><text x="${x}" y="450" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="15" fill="${PALETTE.walnut}">${esc(ev.slice(0, 22))}</text>`;
    })
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Timeline'))}<line x1="160" y1="400" x2="1120" y2="400" stroke="${PALETTE.forest}" stroke-width="4"/>${dots}`,
  );
}

function renderHierarchyTree(params: MediaTemplateParams): string {
  const children = clampLines(asStringArray(params.children, 4), 2, 4);
  const childXs = children.length === 2 ? [420, 860] : children.length === 3 ? [320, 640, 960] : [260, 520, 780, 1040];
  const childSvg = children
    .map(
      (child, i) =>
        `<line x1="640" y1="250" x2="${childXs[i]}" y2="360" stroke="${PALETTE.brass}" stroke-width="2"/><rect x="${childXs[i] - 90}" y="360" width="180" height="70" rx="10" fill="${PALETTE.pine}"/><text x="${childXs[i]}" y="405" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.ivory}">${esc(child.slice(0, 20))}</text>`,
    )
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Hierarchy'))}<rect x="520" y="160" width="240" height="90" rx="12" fill="${PALETTE.forest}"/><text x="640" y="215" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="${PALETTE.ivory}">${esc(asString(params.root, 'Root'))}</text>${childSvg}`,
  );
}

function renderConceptMap(params: MediaTemplateParams): string {
  const satellites = clampLines(asStringArray(params.satellites, 6), 3, 6);
  const cx = 640;
  const cy = 400;
  const r = 200;
  const satSvg = satellites
    .map((label, i) => {
      const angle = (i / satellites.length) * Math.PI * 2 - Math.PI / 2;
      const sx = cx + Math.cos(angle) * r;
      const sy = cy + Math.sin(angle) * r;
      return `<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="${PALETTE.brass}" stroke-width="2"/><rect x="${sx - 80}" y="${sy - 28}" width="160" height="56" rx="10" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><text x="${sx}" y="${sy + 6}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="14" fill="${PALETTE.forest}">${esc(label.slice(0, 18))}</text>`;
    })
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Concept map'))}<circle cx="${cx}" cy="${cy}" r="70" fill="${PALETTE.forest}"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="${PALETTE.ivory}">${esc(asString(params.center, 'Core'))}</text>${satSvg}`,
  );
}

function renderAnnotatedCenter(params: MediaTemplateParams): string {
  const labels = clampLines(asStringArray(params.labels, 6), 3, 6);
  const positions = [
    [640, 180],
    [920, 280],
    [920, 520],
    [640, 620],
    [360, 520],
    [360, 280],
  ];
  const labelSvg = labels
    .map((label, i) => {
      const [lx, ly] = positions[i] ?? [640, 180 + i * 80];
      return `<line x1="640" y1="400" x2="${lx}" y2="${ly}" stroke="${PALETTE.ochre}" stroke-width="2"/><text x="${lx}" y="${ly}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="15" fill="${PALETTE.walnut}">${esc(label.slice(0, 20))}</text>`;
    })
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Annotated diagram'))}<ellipse cx="640" cy="400" rx="180" ry="120" fill="${PALETTE.pine}"/><text x="640" y="408" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="${PALETTE.ivory}">${esc(asString(params.centerShape, 'Object'))}</text>${labelSvg}`,
  );
}

function renderDefinitionCard(params: MediaTemplateParams): string {
  const subject = asString(params.subject);
  return svgDoc(
    `${subject ? `<text x="64" y="180" font-family="IBM Plex Mono, monospace" font-size="14" fill="${PALETTE.ochre}">${esc(subject.toUpperCase())}</text>` : ''}<rect x="64" y="210" width="1152" height="320" rx="14" fill="${PALETTE.forest}" opacity="0.08"/><text x="96" y="280" font-family="Georgia, serif" font-size="36" fill="${PALETTE.forest}">${esc(asString(params.term, 'Term'))}</text><text x="96" y="340" font-family="Segoe UI, sans-serif" font-size="22" fill="${PALETTE.walnut}">${esc(asString(params.definition, 'Definition goes here.'))}</text>`,
    PALETTE.ivory,
  );
}

function renderEquationStrip(params: MediaTemplateParams): string {
  return svgDoc(
    `${header(asString(params.title, 'Equation'))}<rect x="64" y="520" width="1152" height="120" rx="8" fill="${PALETTE.forest}" opacity="0.08"/><text x="96" y="590" font-family="Georgia, serif" font-size="28" fill="${PALETTE.forest}">${esc(asString(params.equation, 'E = mc^2'))}</text><text x="96" y="640" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.walnut}">${esc(asString(params.caption))}</text>`,
  );
}

function renderChecklistSteps(params: MediaTemplateParams): string {
  const steps = asStringArray(params.steps, 8);
  const stepSvg = steps
    .map(
      (step, i) =>
        `<circle cx="96" cy="${220 + i * 52}" r="18" fill="${PALETTE.pine}"/><text x="96" y="${226 + i * 52}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="16" fill="${PALETTE.ivory}">${i + 1}</text><text x="130" y="${226 + i * 52}" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.forest}">${esc(step)}</text>`,
    )
    .join('');
  return svgDoc(`${header(asString(params.title, 'Steps'))}${stepSvg}`);
}

function renderCauseEffectChain(params: MediaTemplateParams): string {
  const causes = asStringArray(params.causes, 5);
  const causeSvg = causes
    .map(
      (cause, i) =>
        `<rect x="100" y="${240 + i * 70}" width="260" height="52" rx="10" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><text x="230" y="${274 + i * 70}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.forest}">${esc(cause.slice(0, 24))}</text>`,
    )
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Cause and effect'))}${causeSvg}<path d="M380 400 H760" stroke="${PALETTE.brass}" stroke-width="5"/><polygon points="760,390 790,400 760,410" fill="${PALETTE.brass}"/><rect x="820" y="320" width="340" height="160" rx="16" fill="${PALETTE.forest}"/><text x="990" y="410" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${PALETTE.ivory}">${esc(asString(params.effect, 'Effect'))}</text>`,
  );
}

function renderProsCons(params: MediaTemplateParams): string {
  const pros = asStringArray(params.pros, 6);
  const cons = asStringArray(params.cons, 6);
  const proSvg = pros.map((p, i) => `<text x="110" y="${240 + i * 34}" font-family="Segoe UI, sans-serif" font-size="17" fill="${PALETTE.pine}">+ ${esc(p)}</text>`).join('');
  const conSvg = cons.map((c, i) => `<text x="710" y="${240 + i * 34}" font-family="Segoe UI, sans-serif" font-size="17" fill="${PALETTE.walnut}">- ${esc(c)}</text>`).join('');
  return svgDoc(
    `${header(asString(params.title, 'Pros and cons'))}<text x="110" y="200" font-family="Georgia, serif" font-size="22" fill="${PALETTE.pine}">Pros</text>${proSvg}<text x="710" y="200" font-family="Georgia, serif" font-size="22" fill="${PALETTE.walnut}">Cons</text>${conSvg}`,
  );
}

function renderFlowWithFeedback(params: MediaTemplateParams): string {
  const steps = clampLines(asStringArray(params.steps, 5), 3, 5);
  const gap = Math.floor(900 / steps.length);
  const fwd = steps
    .map((step, i) => {
      const x = 120 + i * gap;
      const arrow =
        i < steps.length - 1
          ? `<path d="M${x + 120} 360 H${x + gap - 10}" stroke="${PALETTE.brass}" stroke-width="3"/>`
          : '';
      return `<rect x="${x}" y="300" width="110" height="80" rx="10" fill="${PALETTE.forest}"/><text x="${x + 55}" y="348" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="13" fill="${PALETTE.ivory}">${esc(step.slice(0, 16))}</text>${arrow}`;
    })
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Feedback loop'))}${fwd}<path d="M120 480 Q640 620 1120 480" fill="none" stroke="${PALETTE.pine}" stroke-width="3" stroke-dasharray="8 8"/><text x="640" y="640" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.pine}">${esc(asString(params.feedbackLabel, 'feedback'))}</text>`,
  );
}

function renderNumberLine(params: MediaTemplateParams): string {
  const min = asNumber(params.min, 0);
  const max = asNumber(params.max, 10);
  const marks = Array.isArray(params.marks) ? params.marks.filter((m): m is number => typeof m === 'number') : [];
  const markLabels = asStringArray(params.markLabels, marks.length);
  const span = max - min || 1;
  const markSvg = marks
    .map((m, i) => {
      const x = 160 + ((m - min) / span) * 960;
      return `<circle cx="${x}" cy="400" r="9" fill="${PALETTE.brass}"/><text x="${x}" y="440" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="14" fill="${PALETTE.walnut}">${esc(markLabels[i] ?? String(m))}</text>`;
    })
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Number line'))}<line x1="160" y1="400" x2="1120" y2="400" stroke="${PALETTE.forest}" stroke-width="4"/><text x="160" y="370" font-family="Georgia, serif" font-size="18" fill="${PALETTE.forest}">${min}</text><text x="1120" y="370" text-anchor="end" font-family="Georgia, serif" font-size="18" fill="${PALETTE.forest}">${max}</text>${markSvg}`,
  );
}

function renderFractionBars(params: MediaTemplateParams): string {
  const bars = clampLines(asStringArray(params.bars, 4), 2, 4);
  const barSvg = bars
    .map((label, i) => {
      const x = 180 + i * 260;
      const [num, den] = label.split('/').map((s) => parseInt(s.trim(), 10));
      const fillRatio = Number.isFinite(num) && Number.isFinite(den) && den > 0 ? num / den : 0.5;
      const fillH = Math.round(220 * Math.min(1, fillRatio));
      return `<rect x="${x}" y="300" width="180" height="220" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><rect x="${x}" y="${520 - fillH}" width="180" height="${fillH}" fill="${PALETTE.pine}"/><text x="${x + 90}" y="560" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="${PALETTE.forest}">${esc(label)}</text>`;
    })
    .join('');
  return svgDoc(`${header(asString(params.title, 'Fraction bars'))}${barSvg}`);
}

function renderTableGrid(params: MediaTemplateParams): string {
  const headers = asStringArray(params.headers, 4);
  const rowsFlat = asStringArray(params.rows, headers.length * 6);
  const cols = Math.max(headers.length, 1);
  const rowCount = Math.floor(rowsFlat.length / cols);
  const cellW = Math.floor(1000 / cols);
  let y = 220;
  const headerSvg = headers
    .map(
      (h, i) =>
        `<rect x="${80 + i * cellW}" y="${y}" width="${cellW}" height="48" fill="${PALETTE.forest}"/><text x="${80 + i * cellW + cellW / 2}" y="${y + 32}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" fill="${PALETTE.ivory}">${esc(h.slice(0, 16))}</text>`,
    )
    .join('');
  let bodySvg = '';
  for (let r = 0; r < rowCount; r++) {
    y += 48;
    for (let c = 0; c < cols; c++) {
      const val = rowsFlat[r * cols + c] ?? '';
      bodySvg += `<rect x="${80 + c * cellW}" y="${y}" width="${cellW}" height="48" fill="${r % 2 ? PALETTE.ivory : PALETTE.cream}" stroke="${PALETTE.walnut}" stroke-width="1"/><text x="${80 + c * cellW + cellW / 2}" y="${y + 32}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="15" fill="${PALETTE.forest}">${esc(val.slice(0, 18))}</text>`;
    }
  }
  return svgDoc(`${header(asString(params.title, 'Table'))}${headerSvg}${bodySvg}`);
}

function renderQuizChoiceBoard(params: MediaTemplateParams): string {
  const choices = clampLines(asStringArray(params.choices, 4), 2, 4);
  const letters = ['A', 'B', 'C', 'D'];
  const choiceSvg = choices
    .map(
      (choice, i) =>
        `<rect x="100" y="${300 + i * 78}" width="1080" height="62" rx="10" fill="${PALETTE.ivory}" stroke="${PALETTE.walnut}" stroke-width="2"/><text x="130" y="${340 + i * 78}" font-family="IBM Plex Mono, monospace" font-size="20" fill="${PALETTE.ochre}">${letters[i]}</text><text x="170" y="${340 + i * 78}" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.forest}">${esc(choice)}</text>`,
    )
    .join('');
  return svgDoc(
    `<text x="64" y="120" font-family="Georgia, serif" font-size="30" fill="${PALETTE.forest}">${esc(asString(params.prompt, 'Question?'))}</text>${choiceSvg}`,
    PALETTE.ivory,
  );
}

function renderPulseCallout(params: MediaTemplateParams): string {
  const tone = asString(params.tone, 'takeaway').toLowerCase();
  const fill =
    tone === 'warning' ? PALETTE.walnut : tone === 'note' ? PALETTE.pine : PALETTE.forest;
  return svgDoc(
    `<rect x="180" y="250" width="920" height="220" rx="16" fill="${fill}" opacity="0.12"/><rect x="180" y="250" width="920" height="220" rx="16" fill="none" stroke="${fill}" stroke-width="3"><animate attributeName="stroke-opacity" values="1;0.35;1" dur="2.5s" repeatCount="indefinite"/></rect><text x="640" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="${PALETTE.forest}">${esc(asString(params.title, 'Key idea'))}</text><text x="640" y="390" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="20" fill="${PALETTE.walnut}">${esc(asString(params.body, ''))}</text>`,
  );
}

function renderStepSequence(params: MediaTemplateParams): string {
  const steps = clampLines(asStringArray(params.steps, 5), 3, 5);
  const stepSvg = steps
    .map((step, i) => {
      const y = 260 + i * 80;
      const delay = i * 1.2;
      return `<g opacity="0.25"><animate attributeName="opacity" values="0.25;1;0.25" dur="${steps.length * 1.2}s" begin="${delay}s" repeatCount="indefinite"/><rect x="120" y="${y}" width="1040" height="56" rx="10" fill="${PALETTE.forest}"/><text x="150" y="${y + 36}" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.ivory}">${i + 1}. ${esc(step)}</text></g>`;
    })
    .join('');
  return svgDoc(`${header(asString(params.title, 'Sequence'))}${stepSvg}`);
}

function renderWebmcpBridge(params: MediaTemplateParams): string {
  return svgDoc(
    `${header(asString(params.title, 'WebMCP bridge'), 'AI agent talks to tools on this page')}<rect x="80" y="200" width="320" height="320" rx="16" fill="${PALETTE.ivory}" stroke="${PALETTE.forest}" stroke-width="3"/><text x="240" y="340" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${PALETTE.forest}">${esc(asString(params.agentLabel, 'AI agent'))}</text><path d="M420 360 H540" stroke="${PALETTE.brass}" stroke-width="6"/><polygon points="540,350 570,360 540,370" fill="${PALETTE.brass}"/><rect x="590" y="200" width="560" height="320" rx="16" fill="${PALETTE.forest}"/><text x="870" y="340" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${PALETTE.ivory}">${esc(asString(params.pageLabel, 'Lectern page'))}</text><text x="64" y="600" font-family="Segoe UI, sans-serif" font-size="18" fill="${PALETTE.walnut}">${esc(asString(params.footnote, 'An agent that can change the page with your review.'))}</text>`,
  );
}

function renderToolStackMap(params: MediaTemplateParams): string {
  const tools = asStringArray(params.tools, 8);
  const loopSteps = asStringArray(params.loopSteps, 5);
  const toolSvg = tools
    .map(
      (tool, i) =>
        `<rect x="80" y="${160 + i * 58}" width="520" height="48" rx="8" fill="${i % 2 ? PALETTE.pine : PALETTE.forest}"/><text x="110" y="${192 + i * 58}" font-family="IBM Plex Mono, monospace" font-size="16" fill="${PALETTE.ivory}">${esc(tool.slice(0, 34))}</text>`,
    )
    .join('');
  const loopSvg = loopSteps
    .map(
      (step, i) =>
        `<text x="700" y="${270 + i * 36}" font-family="Segoe UI, sans-serif" font-size="17" fill="${PALETTE.walnut}">${i + 1}. ${esc(step)}</text>`,
    )
    .join('');
  return svgDoc(
    `${header(asString(params.title, 'Tool map'))}${toolSvg}<rect x="660" y="160" width="520" height="${Math.max(200, loopSteps.length * 36 + 80)}" rx="14" fill="${PALETTE.ivory}" stroke="${PALETTE.brass}" stroke-width="3"/><text x="700" y="220" font-family="Georgia, serif" font-size="24" fill="${PALETTE.forest}">${esc(asString(params.loopTitle, 'Loop'))}</text>${loopSvg}`,
    PALETTE.ivory,
  );
}

function renderCustomSvg(params: MediaTemplateParams): string {
  const raw = asString(params.svg).trim();
  if (!raw.startsWith('<svg') || !raw.includes('</svg>')) {
    throw new Error('custom-svg params.svg must be a full <svg>...</svg> document.');
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(raw)) {
    throw new Error('custom-svg contains illegal control characters. Use ASCII-safe SVG.');
  }
  return raw.includes('viewBox') ? raw : raw.replace('<svg ', `<svg viewBox="0 0 ${W} ${H}" `);
}

function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

export function renderMediaTemplate(
  templateId: string,
  params: MediaTemplateParams = {},
): RenderedMediaTemplate {
  const def = getMediaTemplate(templateId);
  if (!def) {
    throw new Error(`Unknown media template "${templateId}". Call lectern_list_media_templates first.`);
  }

  let svg: string;
  switch (templateId) {
    case 'title-card':
      svg = renderTitleCard(params);
      break;
    case 'input-output-flow':
      svg = renderInputOutputFlow(params);
      break;
    case 'process-pipeline':
      svg = renderProcessPipeline(params);
      break;
    case 'labeled-cycle':
      svg = renderLabeledCycle(params, false);
      break;
    case 'rotating-cycle':
      svg = renderLabeledCycle(params, true);
      break;
    case 'compare-two-panel':
      svg = renderCompareTwoPanel(params);
      break;
    case 'before-after':
      svg = renderBeforeAfter(params);
      break;
    case 'venn-overlap':
      svg = renderVennOverlap(params);
      break;
    case 'line-graph':
      svg = renderLineGraph(params, false);
      break;
    case 'motion-curve':
      svg = renderLineGraph(params, true);
      break;
    case 'bar-chart':
      svg = renderBarChart(params);
      break;
    case 'timeline':
      svg = renderTimeline(params);
      break;
    case 'hierarchy-tree':
      svg = renderHierarchyTree(params);
      break;
    case 'concept-map':
      svg = renderConceptMap(params);
      break;
    case 'annotated-center':
      svg = renderAnnotatedCenter(params);
      break;
    case 'definition-card':
      svg = renderDefinitionCard(params);
      break;
    case 'equation-strip':
      svg = renderEquationStrip(params);
      break;
    case 'checklist-steps':
      svg = renderChecklistSteps(params);
      break;
    case 'cause-effect-chain':
      svg = renderCauseEffectChain(params);
      break;
    case 'pros-cons-columns':
      svg = renderProsCons(params);
      break;
    case 'flow-with-feedback':
      svg = renderFlowWithFeedback(params);
      break;
    case 'number-line':
      svg = renderNumberLine(params);
      break;
    case 'fraction-bars':
      svg = renderFractionBars(params);
      break;
    case 'table-grid':
      svg = renderTableGrid(params);
      break;
    case 'quiz-choice-board':
      svg = renderQuizChoiceBoard(params);
      break;
    case 'pulse-callout':
      svg = renderPulseCallout(params);
      break;
    case 'step-sequence':
      svg = renderStepSequence(params);
      break;
    case 'webmcp-bridge':
      svg = renderWebmcpBridge(params);
      break;
    case 'tool-stack-map':
      svg = renderToolStackMap(params);
      break;
    case 'custom-svg':
      svg = renderCustomSvg(params);
      break;
    default:
      throw new Error(`Template "${templateId}" is catalogued but not implemented.`);
  }

  const animated = def.animated || (templateId === 'custom-svg' && asBoolean(params.animated));

  return {
    svg,
    width: W,
    height: H,
    dataUrl: svgToDataUrl(svg),
    templateId,
    animated,
  };
}

export { svgToDataUrl };
