import { en, type MessageKey, type Messages } from '@/i18n/en';
import type { LocaleCode } from '@/i18n/locales';
import ar from '@/i18n/locales/ar';
import de from '@/i18n/locales/de';
import es from '@/i18n/locales/es';
import fr from '@/i18n/locales/fr';
import hi from '@/i18n/locales/hi';
import id from '@/i18n/locales/id';
import it from '@/i18n/locales/it';
import ja from '@/i18n/locales/ja';
import ko from '@/i18n/locales/ko';
import pl from '@/i18n/locales/pl';
import ptBR from '@/i18n/locales/pt-BR';
import th from '@/i18n/locales/th';
import tr from '@/i18n/locales/tr';
import uk from '@/i18n/locales/uk';
import vi from '@/i18n/locales/vi';
import zhHans from '@/i18n/locales/zh-Hans';

const catalogs: Record<LocaleCode, Partial<Messages>> = {
  en,
  es,
  'pt-BR': ptBR,
  'zh-Hans': zhHans,
  hi,
  ar,
  ja,
  ko,
  fr,
  de,
  uk,
  tr,
  vi,
  id,
  th,
  it,
  pl,
};

export function getMessages(locale: LocaleCode): Partial<Messages> {
  return catalogs[locale] ?? en;
}

export function translate(
  locale: LocaleCode,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const messages = getMessages(locale);
  let text: string = messages[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
