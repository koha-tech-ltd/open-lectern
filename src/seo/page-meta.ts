import { site } from '../content/site.ts';
import {
  DEFAULT_OG_IMAGE_PATH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  SITE_ORIGIN,
  absoluteUrl,
  canonicalPathFor,
  type SeoPageId,
} from './site.ts';

export type PageMeta = {
  page: SeoPageId;
  title: string;
  description: string;
  ogDescription: string;
  robots: 'index,follow';
  changefreq: 'weekly' | 'monthly' | 'yearly';
  priority: number;
  lastmod?: string;
  ogType: 'website' | 'article';
};

const HOME_DESCRIPTION =
  'Lectern is an open-source lesson studio. Teachers pair with in-page WebMCP AI to write materials and tests; students read, mark, and ask from a locked copy. No account.';

const HOME_OG =
  'A good lesson is materials and tests — and at the end, it brings you knowledge. Pair with WebMCP AI on lectern.click.';

export const PAGE_META: Record<SeoPageId, PageMeta> = {
  home: {
    page: 'home',
    title: 'Lectern — materials, tests, knowledge',
    description: HOME_DESCRIPTION,
    ogDescription: HOME_OG,
    robots: 'index,follow',
    changefreq: 'weekly',
    priority: 1.0,
    ogType: 'website',
  },
  studio: {
    page: 'studio',
    title: 'Studio — Lectern',
    description:
      'Draft a Lectern lesson in the browser. WebMCP agents fill gaps, write sections, and add quiz items on the page you see. Export a student PDF and a .lectern file.',
    ogDescription:
      'Teacher and student on one document. The agent writes into the open lesson — you stay in control.',
    robots: 'index,follow',
    changefreq: 'weekly',
    priority: 0.9,
    ogType: 'website',
  },
  license: {
    page: 'license',
    title: 'License — Lectern',
    description:
      'Lectern is open source under the MIT License. Lectern Cloud is a separate paid product for school brand, hosted PDFs, and watermark-free export.',
    ogDescription: 'MIT licensed lesson studio. Cloud is a separate product, not a paid lock on the source.',
    robots: 'index,follow',
    changefreq: 'yearly',
    priority: 0.4,
    lastmod: site.lastUpdatedLegal,
    ogType: 'website',
  },
  privacy: {
    page: 'privacy',
    title: 'Privacy Policy — Lectern',
    description:
      'How KOHA-TECH handles information on lectern.click. Lessons stay in the browser. No Lectern account and no Lectern lesson database.',
    ogDescription: 'Browser-only lesson work. No Lectern account. Privacy policy for lectern.click.',
    robots: 'index,follow',
    changefreq: 'yearly',
    priority: 0.3,
    lastmod: site.lastUpdatedLegal,
    ogType: 'website',
  },
  terms: {
    page: 'terms',
    title: 'Terms of Service — Lectern',
    description:
      'Terms for using lectern.click, operated by KOHA-TECH Sp. z o.o. in Warsaw, Poland. Covers the MIT studio and Lectern Cloud.',
    ogDescription: 'Terms of service for Lectern at lectern.click, from KOHA-TECH Sp. z o.o.',
    robots: 'index,follow',
    changefreq: 'yearly',
    priority: 0.3,
    lastmod: site.lastUpdatedLegal,
    ogType: 'website',
  },
  cookies: {
    page: 'cookies',
    title: 'Cookie Policy — Lectern',
    description:
      'Lectern does not set advertising cookies. It uses local storage so a lesson can survive a refresh. Cookie policy for lectern.click.',
    ogDescription: 'No ad cookies. Local storage for the draft on this device. Cookie policy for Lectern.',
    robots: 'index,follow',
    changefreq: 'yearly',
    priority: 0.3,
    lastmod: site.lastUpdatedLegal,
    ogType: 'website',
  },
  markdown: {
    page: 'markdown',
    title: 'Markdown guide — Lectern',
    description:
      'GitHub Flavored Markdown in Lectern lessons: headings, lists, tables, callouts, and links in objectives, sections, and quiz prompts.',
    ogDescription: 'Write lesson text with GFM — the same syntax Lectern renders in the manuscript.',
    robots: 'index,follow',
    changefreq: 'monthly',
    priority: 0.55,
    ogType: 'article',
  },
  math: {
    page: 'math',
    title: 'Math & formulas — Lectern',
    description:
      'Typeset Lectern lesson math with KaTeX: inline $...$ and display $$...$$ in objectives, section source, and quiz prompts.',
    ogDescription: 'KaTeX formulas in Lectern lessons — inline and display math that students can read.',
    robots: 'index,follow',
    changefreq: 'monthly',
    priority: 0.55,
    ogType: 'article',
  },
};

export type SeoPayload = {
  page: SeoPageId;
  title: string;
  description: string;
  ogDescription: string;
  robots: string;
  ogType: 'website' | 'article';
  canonicalPath: string;
  canonicalUrl: string;
  ogImageUrl: string;
  ogImageWidth: number;
  ogImageHeight: number;
  ogImageType: string;
  ogImageAlt: string;
  htmlLang: string;
  origin: string;
};

export function resolveSeo(page: SeoPageId, origin: string = SITE_ORIGIN): SeoPayload {
  const meta = PAGE_META[page];
  const canonicalPath = canonicalPathFor(page);
  return {
    page,
    title: meta.title,
    description: meta.description,
    ogDescription: meta.ogDescription,
    robots: meta.robots,
    ogType: meta.ogType,
    canonicalPath,
    canonicalUrl: absoluteUrl(canonicalPath, origin),
    ogImageUrl: absoluteUrl(DEFAULT_OG_IMAGE_PATH, origin),
    ogImageWidth: OG_IMAGE_WIDTH,
    ogImageHeight: OG_IMAGE_HEIGHT,
    ogImageType: OG_IMAGE_TYPE,
    ogImageAlt: 'Lectern — walnut lectern mark with forest-green wordmark',
    htmlLang: 'en',
    origin: origin.replace(/\/$/, ''),
  };
}
