import { useEffect } from 'react';
import { site } from '@/content/site';
import { buildJsonLd } from '@/seo/jsonld';
import { resolveSeo } from '@/seo/page-meta';
import { SITE_ORIGIN, type SeoPageId } from '@/seo/site';

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, extra?: { type?: string; title?: string }) {
  const selector = extra?.type
    ? `link[rel="${rel}"][type="${extra.type}"]`
    : `link[rel="${rel}"]:not([hreflang]):not([type="text/plain"])`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (extra?.type) el.setAttribute('type', extra.type);
    if (extra?.title) el.setAttribute('title', extra.title);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(data: Record<string, unknown>) {
  const id = 'lectern-jsonld';
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function DocumentHead({ page }: { page: SeoPageId }) {
  useEffect(() => {
    const origin =
      typeof window !== 'undefined' && window.location.origin.includes('localhost')
        ? window.location.origin
        : SITE_ORIGIN;
    const seo = resolveSeo(page, origin);

    document.title = seo.title;

    upsertMeta('meta[name="description"]', 'name', 'description', seo.description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', seo.robots);
    upsertMeta('meta[name="author"]', 'name', 'author', site.company);
    upsertMeta('meta[name="theme-color"]', 'name', 'theme-color', '#24382C');
    upsertLink('canonical', seo.canonicalUrl);
    upsertLink('apple-touch-icon', `${origin.replace(/\/$/, '')}/logo.png`);
    upsertLink('license', `${origin.replace(/\/$/, '')}/license`);
    upsertLink('sitemap', `${origin.replace(/\/$/, '')}/sitemap.xml`, {
      type: 'application/xml',
      title: 'Sitemap',
    });

    upsertMeta('meta[property="og:type"]', 'property', 'og:type', seo.ogType);
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', site.name);
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', 'en_US');
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', seo.canonicalUrl);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', seo.ogDescription);
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', seo.ogImageUrl);
    upsertMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', seo.ogImageAlt);
    upsertMeta('meta[property="og:image:type"]', 'property', 'og:image:type', seo.ogImageType);
    upsertMeta('meta[property="og:image:width"]', 'property', 'og:image:width', String(seo.ogImageWidth));
    upsertMeta('meta[property="og:image:height"]', 'property', 'og:image:height', String(seo.ogImageHeight));

    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.ogDescription);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', seo.ogImageUrl);
    upsertMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', seo.ogImageAlt);

    upsertJsonLd(buildJsonLd(seo));
  }, [page]);

  return null;
}
