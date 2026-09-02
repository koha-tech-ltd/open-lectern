import { Link, Navigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocumentHead } from '@/components/DocumentHead';
import { SiteChrome } from '@/components/SiteChrome';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import type { SeoPageId } from '@/seo/site';
import cookiesMd from '@/content/legal/cookies.md?raw';
import licenseMd from '@/content/legal/license.md?raw';
import privacyMd from '@/content/legal/privacy.md?raw';
import termsMd from '@/content/legal/terms.md?raw';

const legalDocs: Record<string, { content: string; title: MessageKey; seo: SeoPageId }> = {
  license: { content: licenseMd, title: 'legal.license', seo: 'license' },
  privacy: { content: privacyMd, title: 'legal.privacy', seo: 'privacy' },
  terms: { content: termsMd, title: 'legal.terms', seo: 'terms' },
  cookies: { content: cookiesMd, title: 'legal.cookies', seo: 'cookies' },
};

export function LegalPage() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\//, '');
  const entry = legalDocs[slug];

  if (!entry) {
    return <Navigate to="/" replace />;
  }

  return (
    <SiteChrome>
      <DocumentHead page={entry.seo} />
      <div className="mb-8">
        <Link className="text-sm text-forest underline-offset-2 hover:underline" to="/">
          {t('legal.back')}
        </Link>
      </div>
      <article className="legal-prose max-w-3xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="font-display text-3xl font-semibold text-forest sm:text-4xl">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-8 font-display text-xl font-semibold text-forest">{children}</h2>
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
