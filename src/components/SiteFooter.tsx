import { Link } from 'react-router-dom';
import { site } from '@/content/site';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import { conversionCloudInquiry } from '@/lib/product-events';
import { catalogForMode, WEB_MCP_TOOL_CATALOG } from '@/lib/webmcp-catalog';
import type { LessonMode } from '@/types/lesson';

const legalLinks: ReadonlyArray<{ to: string; key: MessageKey }> = [
  { to: '/license', key: 'footer.licenseLink' },
  { to: '/privacy', key: 'footer.privacy' },
  { to: '/terms', key: 'footer.terms' },
  { to: '/cookies', key: 'footer.cookies' },
];

export function SiteFooter({
  toolNames,
  mode,
}: {
  toolNames?: readonly string[];
  mode?: LessonMode;
}) {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const names =
    toolNames !== undefined
      ? toolNames
      : (mode ? catalogForMode(mode) : WEB_MCP_TOOL_CATALOG).map((tool) => tool.name);

  return (
    <footer className="mt-auto border-t border-walnut/10 bg-forest text-cream">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-brass/25 bg-cream/5 p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass">
            {t('footer.challengeEyebrow')}
          </p>
          <h2 className="mt-2 font-display text-xl text-cream sm:text-2xl">
            {t('footer.challengeTitle')}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-cream/75">
            {t('footer.challengeBody')}
          </p>
          <a
            href={site.webmcpChallengeUrl}
            className="mt-4 inline-flex text-sm font-medium text-brass underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            openai.com/webmcp-challenge
          </a>
          {names.length > 0 ? (
            <details
              className="mt-5 rounded-lg border border-cream/10 bg-cream/[0.04] p-4 text-sm"
              data-lectern-target="webmcp-tools"
            >
              <summary className="cursor-pointer font-medium text-cream">
                {t('chrome.toolsRegistered')}
              </summary>
              <ul className="mt-3 grid gap-1 font-mono text-xs text-cream/70 sm:grid-cols-2" dir="ltr">
                {names.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass/80">
              {t('footer.inBrowser')}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-cream/70">{t('footer.inBrowserBody')}</p>
          </div>
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass/80">
              {t('footer.license')}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-cream/70">{t('footer.licenseBody')}</p>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <Link to="/license" className="text-cream underline-offset-2 hover:underline">
                {t('footer.readLicense')}
              </Link>
              <a
                href={site.cloudMailto}
                className="text-cream/80 underline-offset-2 hover:text-cream hover:underline"
                onClick={() => conversionCloudInquiry('footer')}
              >
                {t('footer.buyLicense')}
              </a>
              <a
                href={site.githubUrl}
                className="text-cream/80 underline-offset-2 hover:text-cream hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {site.githubOrgLabel}
              </a>
            </div>
          </div>
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass/80">
              {t('footer.legal')}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {legalLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-cream/80 underline-offset-2 hover:text-cream hover:underline"
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-brass/80">
              KOHA-TECH
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-cream/70">
              {site.company}
              <br />
              {site.address}
            </p>
            <div className="mt-3 flex flex-col gap-1 text-sm">
              <a
                href={site.companyUrl}
                className="text-cream/80 underline-offset-2 hover:text-cream hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                koha-tech.com
              </a>
              <a
                href={`mailto:${site.email}`}
                className="text-cream/80 underline-offset-2 hover:text-cream hover:underline"
              >
                {site.email}
              </a>
            </div>
          </div>
        </div>

        <p className="mt-10 border-t border-cream/10 pt-6 text-xs leading-5 text-cream/45">
          © {year} {site.company} {t('footer.aiImageNotice')}
        </p>
      </div>
    </footer>
  );
}
