import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SiteFooter } from '@/components/SiteFooter';
import { useI18n } from '@/i18n/I18nProvider';

export function SiteChrome({
  children,
  mode,
  onMode,
  onHowItWorks,
  toolNames,
}: {
  children: ReactNode;
  mode?: 'teacher' | 'student';
  onMode?: (mode: 'teacher' | 'student') => void;
  onHowItWorks?: () => void;
  toolNames?: readonly string[];
}) {
  const { t } = useI18n();
  const showStudioControls = Boolean(mode && onMode);

  return (
    <div className="grain flex min-h-screen flex-col text-ink">
      <header className="relative z-40 border-b border-walnut/10 bg-ivory/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link to="/" className="site-chrome-brand flex items-center gap-3 no-underline">
              <img
                src="/logo.png"
                alt="Lectern"
                className="h-12 w-12 rounded-md object-cover shadow-lectern"
              />
              <div>
                <div className="landing-brand-name">Lectern</div>
                <div className="site-chrome-tagline text-sm text-walnut/80">
                  {showStudioControls ? t('chrome.studioBadge') : t('chrome.tagline')}
                  {showStudioControls ? ` · ${t('chrome.tagline')}` : null}
                </div>
              </div>
            </Link>

            {showStudioControls ? (
              <div
                className="mode-switch"
                data-lectern-target="mode-switch"
                role="group"
                aria-label={`${t('chrome.teacher')} / ${t('chrome.student')}`}
              >
                <button
                  type="button"
                  className={`mode-switch-btn${mode === 'teacher' ? ' is-active' : ''}`}
                  aria-pressed={mode === 'teacher'}
                  onClick={() => onMode?.('teacher')}
                >
                  {t('chrome.teacher')}
                </button>
                <button
                  type="button"
                  className={`mode-switch-btn mode-switch-btn-student${mode === 'student' ? ' is-active' : ''}`}
                  aria-pressed={mode === 'student'}
                  onClick={() => onMode?.('student')}
                >
                  {t('chrome.student')}
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onHowItWorks ? (
              <button
                type="button"
                className="text-sm text-forest underline-offset-2 hover:underline"
                onClick={onHowItWorks}
              >
                {t('chrome.howThisWorks')}
              </button>
            ) : null}
            <div data-lectern-target="language">
              <LanguageSelector />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <SiteFooter toolNames={toolNames} mode={mode} />
    </div>
  );
}
