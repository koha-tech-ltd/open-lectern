/**
 * Deterministic tests for PDF manuscript parsing (tables, callouts, lists).
 * Run: npm run test:pdf-manuscript
 */
import {
  calloutKindFromText,
  isTableSeparator,
  normalizePdfTable,
  parsePdfManuscript,
  preparePdfInline,
  softenPdfMath,
} from '../src/lib/pdf-manuscript.ts';

let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
  } else {
    console.log(`  ok    ${msg}`);
  }
}

console.log('PDF manuscript — tables, callouts, inline\n');

check(isTableSeparator('| --- | --- | --- |'), 'spaced GFM separator is a table rule');
check(isTableSeparator('|---|---|---|'), 'compact GFM separator is a table rule');
check(isTableSeparator('| :--- | ---: | :---: |'), 'alignment separator is a table rule');
check(!isTableSeparator('| Situation | Relative I | What the model says |'), 'header row is not a separator');
check(!isTableSeparator('| Heavy cloud cover | I ≪ K | Raising light helps a lot |'), 'data row is not a separator');

const greenhouse = [
  '| Situation | Relative $I$ | What the model says |',
  '| --- | --- | --- |',
  '| Heavy cloud cover | $I \\ll K$ | Raising light helps a lot |',
  '| Midday clear sky | $I \\approx$ few $\\times K$ | Gains shrink |',
  '| Overdriven grow lights | $I \\gg K$ | Near $r_{\\max}$; fix CO₂ or cooling instead |',
].join('\n');

const tableBlocks = parsePdfManuscript(greenhouse);
check(tableBlocks.length === 1 && tableBlocks[0]?.type === 'table', 'photosynthesis table is one table block');
if (tableBlocks[0]?.type === 'table') {
  check(tableBlocks[0].headers.length === 3, 'three header cells');
  check(tableBlocks[0].headers[0] === 'Situation', 'first header is Situation');
  check(tableBlocks[0].headers[1].includes('$I$'), 'math in header stays until inline prep');
  check(tableBlocks[0].rows.length === 3, 'three data rows');
  check(tableBlocks[0].rows[0]?.[1] === '$I \\ll K$', 'first data cell keeps TeX');
  check(!tableBlocks[0].headers.join(' ').includes('│'), 'parser does not turn pipes into box-drawing');
}

const ragged = parsePdfManuscript('| A | B | C |\n| --- | --- | --- |\n| only-one |\n| 1 | 2 | 3 | extra |');
check(ragged[0]?.type === 'table', 'ragged table still parses');
if (ragged[0]?.type === 'table') {
  const { headers, rows } = normalizePdfTable(ragged[0].headers, ragged[0].rows);
  check(headers.length === 3 && rows[0]?.length === 3, 'short row is padded to header width');
  check(rows[1]?.length === 3 && rows[1]?.[2] === '3', 'extra cells beyond header are dropped');
}

const callouts = parsePdfManuscript(
  'Lead paragraph.\n\n> **Definition.** Photosynthesis builds sugars.\n>\n> Second sentence in the same card.\n\n> **Key idea.** Light is the early bottleneck.\n\n> **Notation.** Write intensity as $I$.\n\n> A plain quotation.\n',
);
check(callouts.some((b) => b.type === 'callout' && b.kind === 'definition'), 'Definition callout');
check(callouts.some((b) => b.type === 'callout' && b.kind === 'takeaway'), 'Key idea maps to takeaway');
check(callouts.some((b) => b.type === 'callout' && b.kind === 'notation'), 'Notation callout');
check(callouts.some((b) => b.type === 'quote'), 'unlabeled blockquote stays a quote');
const definition = callouts.find((b) => b.type === 'callout' && b.kind === 'definition');
check(
  definition?.type === 'callout' && definition.text.includes('Second sentence'),
  'quoted blank line with > keeps a multi-paragraph callout',
);
check(calloutKindFromText('**Misconception.** Brighter always helps.') === 'warn', 'Misconception is warn');

const lists = parsePdfManuscript('- **Stomata** — openings.\n- **Veins** — water.\n\n1. First\n2. Second');
check(lists.filter((b) => b.type === 'list').length === 2, 'unordered then ordered lists');

const math = parsePdfManuscript('Intro\n\n$$\n6\\,\\mathrm{CO_2} + 6\\,\\mathrm{H_2O}\n$$\n\nOutro');
check(math.some((b) => b.type === 'math'), 'display math is its own block');
check(math.filter((b) => b.type === 'paragraph').length === 2, 'prose around the equation stays paragraphs');

check(!preparePdfInline('| Situation | Relative |').includes('│'), 'inline prep keeps ASCII pipes');
check(preparePdfInline('light $I$ and $K$').includes('I') && !preparePdfInline('light $I$ and $K$').includes('$'), 'inline math delimiters drop');
check(softenPdfMath('$I \\ll K$').includes('≪'), 'll becomes much-less-than');
check(softenPdfMath('$I \\times K$').includes('×'), 'times becomes multiply');
check(preparePdfInline('$I \\gg K$').includes('≫'), 'gg becomes much-greater-than after inline prep');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll pdf-manuscript assertions passed.');
