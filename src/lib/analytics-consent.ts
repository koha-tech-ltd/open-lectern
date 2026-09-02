/**
 * How this tab reached the studio (home CTA vs cold /studio vs demo/share shortcut).
 * Used to strip `?via=home` from the address bar after a landing click.
 */

import type { BrowserAutomationProbe } from '@/lib/browser-automation';

/** Session flag: this tab opened or stayed on `/` before the product. */
export const FROM_LANDING_SESSION_KEY = 'lectern.entry.fromLanding.v1';

/** Query flag on home → studio links so a new tab still counts as a landing entry. */
export const FROM_LANDING_QUERY = 'via';
export const FROM_LANDING_QUERY_VALUE = 'home';

export type AnalyticsEntry = 'landing' | 'direct' | 'shortcut';

export function isAgenticUsage(probe: Pick<
  BrowserAutomationProbe,
  'controlled' | 'nativeWebMcp' | 'webMcpTestingApi'
>): boolean {
  return probe.controlled || probe.nativeWebMcp || probe.webMcpTestingApi;
}

/**
 * Query strings that skip the marketing page and open a specific studio payload
 * (`?demo=`, restore packs, PDF continuation). `?mode=` alone is just studio chrome.
 */
export function isStudioShortcutSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return Boolean(params.get('l') || params.get('from') || params.get('demo'));
}

export function hasLandingEntryQuery(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(FROM_LANDING_QUERY) === FROM_LANDING_QUERY_VALUE;
}

export function studioPathFromLanding(studioPath = '/studio'): string {
  const url = new URL(studioPath, 'https://lectern.click');
  url.searchParams.set(FROM_LANDING_QUERY, FROM_LANDING_QUERY_VALUE);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function stripLandingEntrySearch(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(FROM_LANDING_QUERY);
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function analyticsEntry(input: {
  pathname: string;
  search: string;
  fromLanding: boolean;
}): AnalyticsEntry {
  if (input.fromLanding || hasLandingEntryQuery(input.search)) return 'landing';
  if (isStudioShortcutSearch(input.search)) return 'shortcut';
  const path = input.pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return 'landing';
  return 'direct';
}

export function readFromLandingSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(FROM_LANDING_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markEnteredFromLanding(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FROM_LANDING_SESSION_KEY, '1');
  } catch {
    // Private mode / blocked storage.
  }
}
