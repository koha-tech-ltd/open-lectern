import { PAGE_META } from './page-meta.ts';
import { SEO_PAGES, canonicalPathFor, type SeoPageId } from './site.ts';

export type SitemapEntry = {
  page: SeoPageId;
  path: string;
  priority: number;
  changefreq: string;
  lastmod?: string;
};

/** Indexable public routes written to sitemap.xml. */
export const SITEMAP_PATHS: SitemapEntry[] = SEO_PAGES.map((page) => {
  const meta = PAGE_META[page];
  return {
    page,
    path: canonicalPathFor(page),
    priority: meta.priority,
    changefreq: meta.changefreq,
    lastmod: meta.lastmod,
  };
});
