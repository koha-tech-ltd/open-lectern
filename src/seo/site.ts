import { site } from '../content/site.ts';

/** Production origin for canonical URLs, sitemap, robots, and JSON-LD. */
export const SITE_ORIGIN = site.url;

export const DEFAULT_OG_IMAGE_PATH = '/og-preview.png';
export const OG_IMAGE_WIDTH = 1536;
export const OG_IMAGE_HEIGHT = 1024;
export const OG_IMAGE_TYPE = 'image/png';
export const THEME_COLOR = '#24382C';

export const SEO_PAGES = [
  'home',
  'studio',
  'license',
  'privacy',
  'terms',
  'cookies',
  'markdown',
  'math',
] as const;

export type SeoPageId = (typeof SEO_PAGES)[number];

export const PAGE_PATHS: Record<SeoPageId, string> = {
  home: '/',
  studio: '/studio',
  license: '/license',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  markdown: '/markdown',
  math: '/math',
};

export function absoluteUrl(path: string, origin: string = SITE_ORIGIN): string {
  const base = origin.replace(/\/$/, '');
  if (!path || path === '/') return `${base}/`;
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

export function canonicalPathFor(page: SeoPageId): string {
  return PAGE_PATHS[page];
}

export function seoPageFromPath(pathname: string): SeoPageId | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const page of SEO_PAGES) {
    if (PAGE_PATHS[page] === clean) return page;
  }
  return null;
}
