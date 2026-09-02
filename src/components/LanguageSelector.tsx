import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { localeFlagSrc, localeShortCode, type LocaleCode } from '@/i18n/locales';

type LanguageSelectorProps = {
  variant?: 'compact' | 'expanded';
  className?: string;
};

function FlagIcon({
  locale,
  size = 22,
  priority = false,
}: {
  locale: LocaleCode;
  size?: number;
  priority?: boolean;
}) {
  const { src, srcSet } = localeFlagSrc(locale);
  return (
    <img
      className="lang-flag"
      src={src}
      srcSet={srcSet}
      alt=""
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}

export function LanguageSelector({ variant = 'compact', className }: LanguageSelectorProps) {
  const { locale, setLocale, locales, labels, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function selectLocale(next: LocaleCode) {
    setOpen(false);
    if (next === locale) return;
    setLocale(next);
  }

  const rootClass = [
    'lang-selector',
    `lang-selector--${variant}`,
    open ? 'is-open' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="lang-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t('language.label')}: ${labels[locale]}`}
        onClick={() => setOpen((value) => !value)}
      >
        <FlagIcon locale={locale} size={variant === 'expanded' ? 26 : 22} priority />
        {variant === 'expanded' ? (
          <span className="lang-selector-label">
            <span className="lang-selector-eyebrow">{t('language.label')}</span>
            <strong>{labels[locale]}</strong>
          </span>
        ) : (
          <span className="lang-selector-code">{localeShortCode(locale)}</span>
        )}
        <span className="lang-selector-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <ul className="lang-selector-menu" id={listId} role="listbox" aria-label={t('language.label')}>
          {locales.map((code) => (
            <li key={code} role="option" aria-selected={code === locale}>
              <button
                type="button"
                className={code === locale ? 'is-active' : undefined}
                onClick={() => selectLocale(code)}
              >
                <FlagIcon locale={code} size={24} />
                <span>{labels[code]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
