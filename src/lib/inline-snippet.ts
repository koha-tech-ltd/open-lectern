/** Map a rendered text selection back onto Markdown source and replace it. */

export type SnippetSpan = { start: number; end: number };

export type ReplaceSnippetResult =
  | { ok: true; body: string }
  | { ok: false; reason: 'not-found' | 'empty-snippet' };

/** Collapse whitespace the way HTML rendering does, mapping each kept char to a source index. */
export function collapseWs(source: string): { text: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (/\s/u.test(ch)) {
      if (!lastWasSpace) {
        chars.push(' ');
        map.push(i);
        lastWasSpace = true;
      }
    } else {
      chars.push(ch);
      map.push(i);
      lastWasSpace = false;
    }
  }
  if (chars.length > 0 && chars[chars.length - 1] === ' ') {
    chars.pop();
    map.pop();
  }
  return { text: chars.join(''), map };
}

function countNonOverlapping(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

/** How many times `snippet` appears in `before` (collapsed), for picking the Nth source match. */
export function countCollapsedOccurrencesBefore(before: string, snippet: string): number {
  const needle = collapseWs(snippet).text;
  if (!needle) return 0;
  return countNonOverlapping(collapseWs(before).text, needle);
}

export function findSnippetSpans(source: string, snippet: string): SnippetSpan[] {
  const needle = collapseWs(snippet).text;
  if (!needle) return [];
  const { text, map } = collapseWs(source);
  const spans: SnippetSpan[] = [];
  let from = 0;
  while (from <= text.length - needle.length) {
    const idx = text.indexOf(needle, from);
    if (idx === -1) break;
    const start = map[idx];
    const last = map[idx + needle.length - 1];
    if (start === undefined || last === undefined) break;
    spans.push({ start, end: last + 1 });
    from = idx + needle.length;
  }
  return spans;
}

export function replaceInlineSnippet(
  source: string,
  snippet: string,
  replacement: string,
  occurrence = 0,
): ReplaceSnippetResult {
  const needle = collapseWs(snippet).text;
  if (!needle) return { ok: false, reason: 'empty-snippet' };
  const spans = findSnippetSpans(source, snippet);
  if (spans.length === 0) return { ok: false, reason: 'not-found' };
  const span = spans[occurrence] ?? spans[0]!;
  return {
    ok: true,
    body: source.slice(0, span.start) + replacement + source.slice(span.end),
  };
}

/** Source index just after the last letter of the matched snippet (collapsed caret). */
export function caretOffsetAfterSnippet(
  source: string,
  snippet: string,
  occurrence = 0,
): number | null {
  const spans = findSnippetSpans(source, snippet);
  if (spans.length === 0) return null;
  return (spans[occurrence] ?? spans[0]!).end;
}
