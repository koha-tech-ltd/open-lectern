import { site } from '../content/site.ts';
import { en } from '../i18n/en.ts';
import { SUPPORTED_LOCALES, htmlLangFor } from '../i18n/locales.ts';
import { PAGE_META, type SeoPayload } from './page-meta.ts';
import { SITE_ORIGIN, absoluteUrl, type SeoPageId } from './site.ts';

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const APP_ID = `${SITE_ORIGIN}/#software`;
const SOURCE_ID = `${SITE_ORIGIN}/#source`;

function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: site.company,
    legalName: site.companyLegalName,
    url: site.companyUrl,
    email: site.email,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/logo.png'),
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Nowy Świat 33/13',
      addressLocality: 'Warszawa',
      postalCode: '00-029',
      addressCountry: 'PL',
    },
    identifier: [
      { '@type': 'PropertyValue', name: 'KRS', value: site.krs },
      { '@type': 'PropertyValue', name: 'NIP', value: site.nip },
      { '@type': 'PropertyValue', name: 'REGON', value: site.regon },
    ],
    sameAs: [
      site.githubUrl,
      site.companyUrl,
      'https://www.linkedin.com/company/koha-tech/',
      'https://www.youtube.com/@koha-tech',
    ],
    brand: {
      '@type': 'Brand',
      name: site.name,
      url: SITE_ORIGIN,
    },
  };
}

function websiteNode(seo: SeoPayload) {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${seo.origin}/`,
    name: site.name,
    alternateName: 'open-lectern',
    description: seo.page === 'home' ? seo.description : en['landing.lede'],
    inLanguage: SUPPORTED_LOCALES.map(htmlLangFor),
    publisher: { '@id': ORGANIZATION_ID },
  };
}

function softwareNode(seo: SeoPayload) {
  return {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': APP_ID,
    name: site.name,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: seo.origin,
    image: seo.ogImageUrl,
    description: seo.page === 'home' ? seo.description : en['landing.lede'],
    isAccessibleForFree: true,
    browserRequirements: 'Requires a modern browser. WebMCP tools need a secure context (HTTPS).',
    featureList: [
      'In-page WebMCP lesson authoring',
      'Teacher and student modes on one document',
      'PDF handout and .lectern project export',
      'Student marks and tutoring from a locked copy',
      'No account required',
    ],
    availableLanguage: SUPPORTED_LOCALES.map(htmlLangFor),
    license: absoluteUrl('/license', seo.origin),
    installUrl: absoluteUrl('/studio', seo.origin),
    screenshot: seo.ogImageUrl,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    publisher: { '@id': ORGANIZATION_ID },
    creator: { '@id': ORGANIZATION_ID },
  };
}

function sourceCodeNode() {
  return {
    '@type': 'SoftwareSourceCode',
    '@id': SOURCE_ID,
    name: 'open-lectern',
    codeRepository: site.githubUrl,
    programmingLanguage: ['TypeScript', 'React'],
    runtimePlatform: 'Web',
    license: 'https://opensource.org/licenses/MIT',
    creator: { '@id': ORGANIZATION_ID },
    codeSampleType: 'full solution',
  };
}

function howToNode(origin: string) {
  return {
    '@type': 'HowTo',
    '@id': `${origin}/#howto`,
    name: en['landing.howTitle'],
    description: en['landing.lede'],
    url: `${origin}/`,
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: en['landing.how1Title'],
        text: en['landing.how1Body'],
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: en['landing.how2Title'],
        text: en['landing.how2Body'],
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: en['landing.how3Title'],
        text: en['landing.how3Body'],
      },
    ],
  };
}

function breadcrumbItems(page: SeoPageId): { name: string; path?: string }[] {
  const crumbs: { name: string; path?: string }[] = [{ name: 'Home', path: '/' }];
  if (page === 'home') return crumbs;
  const labels: Record<Exclude<SeoPageId, 'home'>, string> = {
    studio: 'Studio',
    license: 'License',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    cookies: 'Cookie Policy',
    markdown: 'Markdown guide',
    math: 'Math & formulas',
  };
  crumbs.push({ name: labels[page] });
  return crumbs.map((item, index, all) =>
    index === all.length - 1 ? { name: item.name } : item,
  );
}

function breadcrumbNode(seo: SeoPayload) {
  const items = breadcrumbItems(seo.page);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${seo.canonicalUrl}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path, seo.origin) } : {}),
    })),
  };
}

function webPageNode(seo: SeoPayload) {
  const types: string[] = seo.page === 'markdown' || seo.page === 'math' ? ['WebPage', 'TechArticle'] : ['WebPage'];
  return {
    '@type': types.length === 1 ? types[0] : types,
    '@id': `${seo.canonicalUrl}#webpage`,
    url: seo.canonicalUrl,
    name: seo.title,
    headline: seo.title,
    description: seo.description,
    inLanguage: seo.htmlLang,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': APP_ID },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: seo.ogImageUrl,
      width: seo.ogImageWidth,
      height: seo.ogImageHeight,
    },
    publisher: { '@id': ORGANIZATION_ID },
    author: { '@id': ORGANIZATION_ID },
    ...(PAGE_META[seo.page].lastmod ? { dateModified: PAGE_META[seo.page].lastmod } : {}),
    ...(seo.page === 'studio' ? { mainEntity: { '@id': APP_ID } } : {}),
  };
}

export function buildJsonLd(seo: SeoPayload): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [
    organizationNode(),
    websiteNode(seo),
    softwareNode(seo),
    sourceCodeNode(),
    webPageNode(seo),
    breadcrumbNode(seo),
  ];
  if (seo.page === 'home') {
    graph.push(howToNode(seo.origin));
  }
  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderHeadTags(seo: SeoPayload): string {
  const jsonLd = JSON.stringify(buildJsonLd(seo)).replace(/</g, '\\u003c');
  return `
    <title>${escapeAttr(seo.title)}</title>
    <meta name="description" content="${escapeAttr(seo.description)}" />
    <meta name="robots" content="${escapeAttr(seo.robots)}" />
    <meta name="author" content="${escapeAttr(site.company)}" />
    <meta name="theme-color" content="#24382C" />
    <link rel="apple-touch-icon" href="/logo.png" />
    <link rel="canonical" href="${escapeAttr(seo.canonicalUrl)}" />
    <link rel="license" href="${escapeAttr(absoluteUrl('/license', seo.origin))}" />
    <link rel="sitemap" type="application/xml" title="Sitemap" href="${escapeAttr(absoluteUrl('/sitemap.xml', seo.origin))}" />
    <meta property="og:site_name" content="${escapeAttr(site.name)}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${escapeAttr(seo.title)}" />
    <meta property="og:description" content="${escapeAttr(seo.ogDescription)}" />
    <meta property="og:type" content="${escapeAttr(seo.ogType)}" />
    <meta property="og:url" content="${escapeAttr(seo.canonicalUrl)}" />
    <meta property="og:image" content="${escapeAttr(seo.ogImageUrl)}" />
    <meta property="og:image:alt" content="${escapeAttr(seo.ogImageAlt)}" />
    <meta property="og:image:type" content="${escapeAttr(seo.ogImageType)}" />
    <meta property="og:image:width" content="${seo.ogImageWidth}" />
    <meta property="og:image:height" content="${seo.ogImageHeight}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(seo.title)}" />
    <meta name="twitter:description" content="${escapeAttr(seo.ogDescription)}" />
    <meta name="twitter:image" content="${escapeAttr(seo.ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeAttr(seo.ogImageAlt)}" />
    <script type="application/ld+json" id="lectern-jsonld">${jsonLd}</script>
  `.trim();
}
