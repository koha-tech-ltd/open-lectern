import {
  htmlLangFor,
  isLocaleCode,
  localeTextDir,
  normalizeLocale,
  type LocaleCode,
} from '@/i18n/locales';

export const LOCALE_STORAGE_KEY = 'lectern.locale';

type Listener = (locale: LocaleCode) => void;

const listeners = new Set<Listener>();

function readStoredLocale(): LocaleCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
    if (stored) return normalizeLocale(stored);
  } catch {
    // ignore quota / private mode
  }
  return null;
}

function persistLocale(locale: LocaleCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore quota / private mode
  }
}

function browserLanguageTags(): string[] {
  if (typeof navigator === 'undefined') return [];
  return [...(navigator.languages ?? []), navigator.language].filter(Boolean);
}

function detectInitialLocale(): LocaleCode {
  const stored = readStoredLocale();
  if (stored) return stored;
  for (const tag of browserLanguageTags()) {
    const hint = normalizeLocale(tag);
    if (hint !== 'en' || tag.toLowerCase().startsWith('en')) return hint;
  }
  return 'en';
}

let current: LocaleCode = detectInitialLocale();

export function applyDocumentLocale(locale: LocaleCode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = htmlLangFor(locale);
  document.documentElement.dir = localeTextDir(locale);
}

export function getUiLocale(): LocaleCode {
  return current;
}

export function setUiLocale(next: LocaleCode): LocaleCode {
  const locale = isLocaleCode(next) ? next : normalizeLocale(next);
  current = locale;
  persistLocale(locale);
  applyDocumentLocale(locale);
  for (const listener of listeners) listener(locale);
  return locale;
}

export function subscribeUiLocale(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

applyDocumentLocale(current);
