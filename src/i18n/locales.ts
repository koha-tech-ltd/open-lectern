/** Lectern UI locales: LIA set minus Russian. Arabic is RTL. */
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'pt-BR',
  'zh-Hans',
  'hi',
  'ar',
  'ja',
  'ko',
  'fr',
  'de',
  'uk',
  'tr',
  'vi',
  'id',
  'th',
  'it',
  'pl',
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<LocaleCode, string> = {
  en: 'English',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  'zh-Hans': '简体中文',
  hi: 'हिन्दी',
  ar: 'العربية',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  uk: 'Українська',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  it: 'Italiano',
  pl: 'Polski',
};

/** ISO 3166-1 alpha-2 country codes for circular flag assets. */
export const LOCALE_FLAG_COUNTRIES: Record<LocaleCode, string> = {
  en: 'us',
  es: 'es',
  'pt-BR': 'br',
  'zh-Hans': 'cn',
  hi: 'in',
  ar: 'sa',
  ja: 'jp',
  ko: 'kr',
  fr: 'fr',
  de: 'de',
  uk: 'ua',
  tr: 'tr',
  vi: 'vn',
  id: 'id',
  th: 'th',
  it: 'it',
  pl: 'pl',
};

export function localeFlagSrc(locale: LocaleCode): { src: string; srcSet: string } {
  const country = LOCALE_FLAG_COUNTRIES[locale];
  return {
    src: `/flags/w40/${country}.png`,
    srcSet: `/flags/w80/${country}.png 2x`,
  };
}

export const RTL_LOCALES: ReadonlySet<LocaleCode> = new Set(['ar']);

export function htmlLangFor(locale: LocaleCode): string {
  if (locale === 'pt-BR') return 'pt-BR';
  if (locale === 'zh-Hans') return 'zh-Hans';
  return locale;
}

export function localeTextDir(locale: string | null | undefined): 'ltr' | 'rtl' {
  const code = locale && isLocaleCode(locale) ? locale : normalizeLocale(locale);
  return RTL_LOCALES.has(code) ? 'rtl' : 'ltr';
}

export function isLocaleCode(value: string): value is LocaleCode {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function localeShortCode(locale: LocaleCode): string {
  if (locale === 'pt-BR') return 'PT';
  if (locale === 'zh-Hans') return 'ZH';
  return locale.toUpperCase();
}

export function normalizeLocale(raw: string | null | undefined): LocaleCode {
  if (!raw) return 'en';
  if (isLocaleCode(raw)) return raw;
  const lower = raw.toLowerCase().replace('_', '-');
  if (lower === 'pt-br' || lower.startsWith('pt')) return 'pt-BR';
  if (lower === 'zh-hans' || lower === 'zh-cn' || lower.startsWith('zh')) return 'zh-Hans';
  const base = lower.split('-')[0] ?? '';
  const match = SUPPORTED_LOCALES.find(
    (code) => code.toLowerCase() === base || code.toLowerCase().startsWith(base),
  );
  return match ?? 'en';
}
