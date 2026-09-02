import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translate } from '@/i18n/catalogs';
import type { MessageKey } from '@/i18n/en';
import {
  applyDocumentLocale,
  getUiLocale,
  setUiLocale,
  subscribeUiLocale,
} from '@/i18n/locale-store';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type LocaleCode } from '@/i18n/locales';

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  locales: typeof SUPPORTED_LOCALES;
  labels: typeof LOCALE_LABELS;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => getUiLocale());

  useEffect(() => subscribeUiLocale(setLocaleState), []);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    setUiLocale(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, locales: SUPPORTED_LOCALES, labels: LOCALE_LABELS }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
