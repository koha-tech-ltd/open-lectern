/**
 * Writes public/sitemap.xml from src/seo/sitemap-paths.ts.
 *
 * Run: node --experimental-strip-types scripts/generate-sitemap.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { site } from '../src/content/site.ts';
import { SITEMAP_PATHS } from '../src/seo/sitemap-paths.ts';
import { absoluteUrl } from '../src/seo/site.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const siteUrl = (process.env.VITE_SITE_URL ?? site.url).trim().replace(/\/$/, '');
const buildDate = new Date().toISOString().slice(0, 10);

const urls = SITEMAP_PATHS.map(({ path: p, priority, changefreq, lastmod }) => {
  const last = lastmod ?? buildDate;
  const loc = absoluteUrl(p, siteUrl);
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${last}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const out = path.join(root, 'public', 'sitemap.xml');
fs.writeFileSync(out, xml, 'utf8');
console.log('Wrote', path.relative(root, out), `(${SITEMAP_PATHS.length} URLs, base ${siteUrl})`);
