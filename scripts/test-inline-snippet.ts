/**
 * Deterministic tests for inline snippet replace (teacher double-click update).
 * Run: npm run test:inline-snippet
 */
import { caretOffsetAfterSnippet, collapseWs, countCollapsedOccurrencesBefore, findSnippetSpans, replaceInlineSnippet } from '../src/lib/inline-snippet.ts';

let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
  } else {
    console.log(`  ok    ${msg}`);
  }
}

console.log('Inline snippet — teacher phrase replace\n');

const bold = 'Plants use **carbon** in light.';
const boldHit = replaceInlineSnippet(bold, 'carbon', 'glucose', 0);
check(boldHit.ok && boldHit.body === 'Plants use **glucose** in light.', 'keeps markdown wrappers around the word');

const unique = replaceInlineSnippet('The leaf is green.', 'leaf', 'stem', 0);
check(unique.ok && unique.body === 'The stem is green.', 'replaces a unique word');

const spaced = replaceInlineSnippet('Hello\n\nworld today.', 'Hello world', 'Hi there', 0);
check(spaced.ok && unique.ok, 'collapsed whitespace still matches');
check(spaced.ok && spaced.body.startsWith('Hi there'), 'phrase across blank lines is replaced');

const twice = 'The cat sat. The cat ran.';
const second = replaceInlineSnippet(twice, 'cat', 'dog', 1);
check(second.ok && second.body === 'The cat sat. The dog ran.', 'occurrence index picks the Nth match');

const first = replaceInlineSnippet(twice, 'cat', 'dog', 0);
check(first.ok && first.body === 'The dog sat. The cat ran.', 'occurrence 0 is the first match');

const missing = replaceInlineSnippet('No match here.', 'photosynthesis', 'x', 0);
check(!missing.ok && missing.reason === 'not-found', 'missing phrase fails closed');

const empty = replaceInlineSnippet('abc', '   ', 'x', 0);
check(!empty.ok && empty.reason === 'empty-snippet', 'whitespace-only snippet is empty');

check(collapseWs('  a \n\n b  ').text === 'a b', 'collapseWs trims and folds');
check(countCollapsedOccurrencesBefore('The cat sat. The ', 'cat') === 1, 'count before the second cat');
check(countCollapsedOccurrencesBefore('', 'cat') === 0, 'count before first is zero');

const spans = findSnippetSpans('See **light** and light.', 'light');
check(spans.length === 2, 'finds the word inside emphasis and after');
check(spans[0]?.start === 'See **'.length, 'first span starts inside ** **');

const carbonCaret = caretOffsetAfterSnippet(bold, 'carbon', 0);
check(carbonCaret === 'Plants use **carbon'.length, 'caret sits after last letter of carbon, before closing **');

const secondCat = caretOffsetAfterSnippet(twice, 'cat', 1);
check(secondCat === 'The cat sat. The cat'.length, 'nth occurrence caret is after the second cat');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll inline-snippet assertions passed.');
