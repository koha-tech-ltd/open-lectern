import { Link, Navigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { DocumentHead } from '@/components/DocumentHead';
import { SiteChrome } from '@/components/SiteChrome';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import type { SeoPageId } from '@/seo/site';
import markdownMd from '@/content/guides/markdown.md?raw';
import mathMd from '@/content/guides/math.md?raw';

const guideDocs: Record<string, { content: string; title: MessageKey; seo: SeoPageId }> = {
  markdown: { content: markdownMd, title: 'guide.markdown', seo: 'markdown' },
  math: { content: mathMd, title: 'guide.math', seo: 'math' },
};

export function GuidePage() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\//, '');
  const entry = guideDocs[slug];

  if (!entry) {
    return <Navigate to="/studio" replace />;
  }

  return (
    <SiteChrome>
      <DocumentHead page={entry.seo} />
      <div className="mb-8">
        <Link className="text-sm text-forest underline-offset-2 hover:underline" to="/studio">
          {t('guide.back')}
        </Link>
      </div>
      <article className="legal-prose guide-prose max-w-3xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { strict: 'ignore', throwOnError: false }]]}
          components={{
            h1: ({ children }) => (
              <h1 className="font-display text-3xl font-semibold text-forest sm:text-4xl">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-8 font-display text-xl font-semibold text-forest">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-6 font-display text-lg font-semibold text-forest">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mt-3 text-sm leading-relaxed text-walnut sm:text-base">{children}</p>
            ),
            a: ({ href, children }) => {
              const external = href?.startsWith('http');
              if (href?.startsWith('/')) {
                return (
                  <Link className="text-forest underline underline-offset-2" to={href}>
                    {children}
                  </Link>
                );
              }
              return (
                <a
                  href={href}
                  className="text-forest underline underline-offset-2"
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                >
                  {children}
                </a>
              );
            },
            ul: ({ children }) => (
              <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-walnut sm:text-base">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mt-3 list-decimal space-y-1 ps-5 text-sm text-walnut sm:text-base">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
            code: ({ className, children }) => {
              const inline = !className;
              if (inline) {
                return (
                  <code className="rounded bg-walnut/10 px-1 py-0.5 font-mono text-xs text-forest">{children}</code>
                );
              }
              return (
                <code className="block overflow-x-auto rounded-md border border-walnut/15 bg-cream px-3 py-2 font-mono text-xs text-ink">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="mt-3 overflow-x-auto rounded-md border border-walnut/15 bg-cream p-3">{children}</pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="mt-3 border-s-4 border-brass/40 ps-4 text-sm italic text-walnut sm:text-base">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse border border-walnut/20 text-sm text-walnut">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-ivory">{children}</thead>,
            th: ({ children }) => (
              <th className="border border-walnut/20 px-3 py-2 text-start font-medium text-forest">{children}</th>
            ),
            td: ({ children }) => <td className="border border-walnut/20 px-3 py-2 align-top">{children}</td>,
            tbody: ({ children }) => <tbody>{children}</tbody>,
          }}
        >
          {entry.content}
        </ReactMarkdown>
      </article>
    </SiteChrome>
  );
}
