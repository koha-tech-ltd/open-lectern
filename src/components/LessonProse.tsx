import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

const CALLOUT_RE =
  /^(definition|takeaway|notation|note|warning|example|key idea|misconception)\b/i;

function calloutClass(label: string): string {
  const key = label.toLowerCase();
  if (key.startsWith('definition') || key.startsWith('notation')) return 'callout callout-definition';
  if (key.startsWith('takeaway') || key.startsWith('key')) return 'callout callout-takeaway';
  if (key.startsWith('warning') || key.startsWith('misconception')) return 'callout callout-warn';
  if (key.startsWith('example')) return 'callout callout-example';
  return 'callout callout-note';
}

function extractCalloutLabel(children: unknown): string | null {
  const walk = (node: unknown): string | null => {
    if (node == null || typeof node === 'boolean') return null;
    if (typeof node === 'string') {
      const m = node.trim().match(CALLOUT_RE);
      return m ? m[1] : null;
    }
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const props = (node as { props?: { children?: unknown } }).props;
      return walk(props?.children);
    }
    return null;
  };
  return walk(children);
}

function buildComponents(inline: boolean): Components {
  return {
    p({ children }) {
      if (inline) return <span className="lesson-inline-p">{children}</span>;
      return <p>{children}</p>;
    },
    blockquote({ children }) {
      if (inline) return <span>{children}</span>;
      const label = extractCalloutLabel(children);
      if (label) {
        return <aside className={calloutClass(label)}>{children}</aside>;
      }
      return <blockquote className="lesson-quote">{children}</blockquote>;
    },
    a({ href, children }) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="lesson-link">
          {children}
        </a>
      );
    },
  };
}

function loosenMathFractions(source: string): string {
  // Inline \frac is text-style (mtight) and sits on the rule. Prefer display-style \dfrac.
  return source
    .replace(/\\dfrac/g, '\\LECTERN_DFRAC')
    .replace(/\\frac(?![a-zA-Z])/g, '\\dfrac')
    .replace(/\\LECTERN_DFRAC/g, '\\dfrac');
}

export function LessonProse({
  source,
  inline = false,
}: {
  source: string;
  inline?: boolean;
}) {
  const raw = source.trim() ? source : inline ? '—' : '_Nothing written yet._';
  const text = loosenMathFractions(raw);

  return (
    <div className={inline ? 'lesson-prose lesson-prose-inline' : 'lesson-prose'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: 'ignore', throwOnError: false }]]}
        components={buildComponents(inline)}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
