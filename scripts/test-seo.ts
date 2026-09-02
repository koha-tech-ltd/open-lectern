/**
 * Deterministic SEO / sitemap / Schema.org checks.
 * Run: npm run test:seo
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { en } from '../src/i18n/en.ts';
import { buildRobotsTxt } from '../src/seo/crawl-policy.ts';
import { buildJsonLd, escapeAttr, renderHeadTags } from '../src/seo/jsonld.ts';
import { PAGE_META, resolveSeo } from '../src/seo/page-meta.ts';
import { SITEMAP_PATHS } from '../src/seo/sitemap-paths.ts';
import { SEO_PAGES, SITE_ORIGIN, absoluteUrl, seoPageFromPath } from '../src/seo/site.ts';

let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
  } else {
    console.log(`  ok    ${msg}`);
  }
}

console.log('Lectern SEO — sitemap, robots, Schema.org\n');

check(SITE_ORIGIN === 'https://lectern.click', 'canonical origin is lectern.click');
check(absoluteUrl('/') === 'https://lectern.click/', 'home absolute URL has trailing slash');
check(absoluteUrl('/studio') === 'https://lectern.click/studio', 'studio absolute URL');
check(seoPageFromPath('/privacy') === 'privacy', 'path maps to privacy page');
check(seoPageFromPath('/studio/') === 'studio', 'trailing slash still maps');
check(seoPageFromPath('/missing') === null, 'unknown path is null');

const titles = new Set(SEO_PAGES.map((page) => PAGE_META[page].title));
check(titles.size === SEO_PAGES.length, 'each page has a unique title');

for (const page of SEO_PAGES) {
  const meta = PAGE_META[page];
  check(meta.title.length > 10 && meta.title.length <= 70, `${page} title length ${meta.title.length}`);
  check(
    meta.description.length >= 70 && meta.description.length <= 170,
    `${page} description length ${meta.description.length}`,
  );
  check(
    meta.description.includes('Lectern') || meta.description.includes('lectern'),
    `${page} description names the product`,
  );
}

check(SITEMAP_PATHS.length === SEO_PAGES.length, 'sitemap lists every public page');
check(SITEMAP_PATHS[0]?.path === '/', 'sitemap starts at home');
check(
  SITEMAP_PATHS.every((entry) => SEO_PAGES.includes(entry.page)),
  'sitemap pages are the public set',
);

const robots = buildRobotsTxt(SITE_ORIGIN);
check(robots.includes('User-agent: *'), 'robots allows crawlers');
check(robots.includes('Allow: /'), 'robots allows the site');
check(robots.includes('Sitemap: https://lectern.click/sitemap.xml'), 'robots points at sitemap.xml');

const home = resolveSeo('home');
const studio = resolveSeo('studio');
check(home.canonicalUrl === 'https://lectern.click/', 'home canonical');
check(studio.canonicalUrl === 'https://lectern.click/studio', 'studio canonical');
check(home.ogImageUrl === 'https://lectern.click/og-preview.png', 'og image is the preview PNG');

const graph = buildJsonLd(home);
check(graph['@context'] === 'https://schema.org', 'JSON-LD context is schema.org');
const nodes = graph['@graph'];
check(Array.isArray(nodes), 'JSON-LD uses @graph');

const types = new Set(
  (nodes as Array<Record<string, unknown>>).flatMap((node) => {
    const t = node['@type'];
    return Array.isArray(t) ? t : [t];
  }),
);
check(types.has('Organization'), 'graph includes Organization');
check(types.has('WebSite'), 'graph includes WebSite');
check(types.has('SoftwareApplication'), 'graph includes SoftwareApplication');
check(types.has('WebApplication'), 'graph includes WebApplication');
check(types.has('SoftwareSourceCode'), 'graph includes SoftwareSourceCode');
check(types.has('WebPage'), 'graph includes WebPage');
check(types.has('BreadcrumbList'), 'graph includes BreadcrumbList');
check(types.has('HowTo'), 'home graph includes HowTo');

const howTo = (nodes as Array<Record<string, unknown>>).find((node) => node['@type'] === 'HowTo');
const steps = (howTo?.step as Array<{ name: string; text: string }>) ?? [];
check(steps[0]?.name === en['landing.how1Title'], 'HowTo step 1 matches landing copy');
check(steps[1]?.text === en['landing.how2Body'], 'HowTo step 2 body matches landing copy');
check(steps[2]?.name === en['landing.how3Title'], 'HowTo step 3 matches landing copy');

const studioGraph = buildJsonLd(studio)['@graph'] as Array<Record<string, unknown>>;
check(
  !studioGraph.some((node) => node['@type'] === 'HowTo'),
  'studio graph does not advertise the landing HowTo',
);
check(
  studioGraph.some((node) => {
    const t = node['@type'];
    return t === 'WebPage' || (Array.isArray(t) && t.includes('WebPage'));
  }),
  'studio graph includes WebPage',
);

const guide = buildJsonLd(resolveSeo('markdown'))['@graph'] as Array<Record<string, unknown>>;
const guidePage = guide.find((node) => {
  const t = node['@type'];
  return Array.isArray(t) && t.includes('TechArticle');
});
check(Boolean(guidePage), 'markdown page is marked TechArticle');

const org = (nodes as Array<Record<string, unknown>>).find((node) => node['@type'] === 'Organization');
check(org?.legalName === 'Koha-Tech spółka z ograniczoną odpowiedzialnością', 'Organization keeps Polish legal name');
const sameAs = org?.sameAs as string[];
check(sameAs.includes('https://github.com/koha-tech-ltd/open-lectern'), 'Organization sameAs includes GitHub');

const tags = renderHeadTags(home);
check(tags.includes('<title>Lectern — materials, tests, knowledge</title>'), 'head tags include title');
check(tags.includes('rel="canonical" href="https://lectern.click/"'), 'head tags include canonical');
check(tags.includes('application/ld+json'), 'head tags include JSON-LD');
check(tags.includes('og:image:width'), 'head tags include og image size');
check(!tags.includes('<script type="application/ld+json" id="lectern-jsonld"><'), 'JSON-LD escapes raw <');
check(escapeAttr('A & B "C"') === 'A &amp; B &quot;C&quot;', 'attribute escaping');

const nginx = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'nginx', 'default.conf'),
  'utf8',
);
check(nginx.includes('absolute_redirect off'), 'nginx emits relative redirects behind the ingress');
check(
  /try_files\s+\$uri\s+\$uri\/index\.html\s+\/index\.html/.test(nginx),
  'nginx serves HTML shells without a directory-slash 301',
);
check(
  !/try_files\s+\$uri\s+\$uri\/\s+\/index\.html/.test(nginx),
  'nginx does not 301 /studio to :8080 via $uri/',
);

if (failed > 0) {
  console.error(`\n${failed} SEO check(s) failed`);
  process.exit(1);
}
console.log('\nAll SEO checks passed');
