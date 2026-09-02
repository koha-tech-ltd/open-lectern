import { countCollapsedOccurrencesBefore } from '@/lib/inline-snippet';

export type RelRect = { top: number; left: number; width: number; height: number };

export type InlineTextTarget = {
  snippet: string;
  occurrence: number;
  relRects: RelRect[];
};

const IGNORE_HIT = 'a, button, input, textarea, select, .katex, img, video, .section-media-frame';
const WORD_MAX = 280;

function caretRangeAt(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === 'function') {
    return doc.caretRangeFromPoint(x, y);
  }
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

function expandRangeToWord(caret: Range): Range | null {
  const node = caret.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? '';
  if (!text) return null;
  const offset = Math.min(Math.max(0, caret.startOffset), text.length);
  let start = offset;
  let end = offset;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    for (const part of segmenter.segment(text)) {
      const from = part.index;
      const to = part.index + part.segment.length;
      if (offset >= from && offset <= to) {
        if (!part.isWordLike) return null;
        start = from;
        end = to;
        break;
      }
    }
  } else {
    const isWord = (ch: string) => /[\p{L}\p{N}'’-]/u.test(ch);
    while (start > 0 && isWord(text[start - 1]!)) start -= 1;
    while (end < text.length && isWord(text[end]!)) end += 1;
  }
  if (start === end) return null;
  const word = document.createRange();
  word.setStart(node, start);
  word.setEnd(node, end);
  return word;
}

function rangeFromEvent(root: HTMLElement, clientX: number, clientY: number): Range | null {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const selected = sel.getRangeAt(0);
    if (root.contains(selected.commonAncestorContainer)) return selected.cloneRange();
  }
  const caret = caretRangeAt(clientX, clientY);
  if (!caret || !root.contains(caret.startContainer)) return null;
  return expandRangeToWord(caret);
}

/** Read the word or selected phrase under a Teacher double-click in rendered material. */
export function captureInlineTextTarget(
  root: HTMLElement,
  event: { target: EventTarget | null; clientX: number; clientY: number },
): InlineTextTarget | null {
  if (event.target instanceof Element && event.target.closest(IGNORE_HIT)) return null;
  const range = rangeFromEvent(root, event.clientX, event.clientY);
  if (!range) return null;
  const snippet = range.toString().replace(/\s+/g, ' ').trim();
  if (!snippet || snippet.length > WORD_MAX) return null;
  const occurrence = (() => {
    try {
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(root);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      return countCollapsedOccurrencesBefore(beforeRange.toString(), snippet);
    } catch {
      return 0;
    }
  })();
  const origin = root.getBoundingClientRect();
  const relRects = Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      top: r.top - origin.top,
      left: r.left - origin.left,
      width: r.width,
      height: r.height,
    }));
  if (relRects.length === 0) {
    relRects.push({
      top: event.clientY - origin.top - 8,
      left: event.clientX - origin.left - 4,
      width: 8,
      height: 16,
    });
  }
  return { snippet, occurrence, relRects };
}

/** Place a collapsed caret in a source textarea and scroll it into view. */
export function placeSourceCaret(el: HTMLTextAreaElement, offset: number): void {
  const pos = Math.max(0, Math.min(offset, el.value.length));
  el.focus();
  el.setSelectionRange(pos, pos);
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const style = window.getComputedStyle(el);
  const parsedLine = parseFloat(style.lineHeight);
  const lineHeight = Number.isFinite(parsedLine) && parsedLine > 0 ? parsedLine : 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const lineIndex = el.value.slice(0, pos).split('\n').length - 1;
  el.scrollTop = Math.max(0, lineIndex * lineHeight - el.clientHeight * 0.35 + paddingTop);
}
