/**
 * After Vite build: write per-route HTML shells with correct meta/JSON-LD
 * so crawlers and share unfurlers get the right head tags without waiting for JS.
 *
 * Production nginx must serve `$uri/index.html` without a directory-slash 301
 * (`try_files $uri $uri/` would redirect /studio to http://host:8080/studio/).
 *
 * Run: node --experimental-strip-types scripts/generate-html-shells.ts
 * Expects dist/index.html from vite build.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { site } from '../src/content/site.ts';
import { renderHeadTags } from '../src/seo/jsonld.ts';
import { resolveSeo } from '../src/seo/page-meta.ts';
import { SEO_PAGES, canonicalPathFor, type SeoPageId } from '../src/seo/site.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const siteUrl = (process.env.VITE_SITE_URL ?? site.url).trim().replace(/\/$/, '');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function injectHead(html: string, headTags: string): string {
  let out = html.replace(/<html\s+lang="[^"]*"/, '<html lang="en"');
  if (!out.includes(' dir=')) {
    out = out.replace(/<html\s+lang="([^"]*)"/, '<html lang="$1" dir="ltr"');
  } else {
    out = out.replace(/dir="[^"]*"/, 'dir="ltr"');
  }

  out = out
    .replace(/<title>[^<]*<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="author"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="theme-color"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="license"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="sitemap"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="apple-touch-icon"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, '');

  return out.replace(/<\/head>/i, `    ${headTags}\n  </head>`);
}

function writeShell(page: SeoPageId, template: string): string {
  const seo = resolveSeo(page, siteUrl);
  const html = injectHead(template, renderHeadTags(seo));
  const relPath = canonicalPathFor(page);
  const outFile =
    relPath === '/'
      ? path.join(distDir, 'index.html')
      : path.join(distDir, relPath.replace(/^\//, ''), 'index.html');
  ensureDir(path.dirname(outFile));
  fs.writeFileSync(outFile, html, 'utf8');
  return path.relative(root, outFile);
}

const templatePath = path.join(distDir, 'index.html');
if (!fs.existsSync(templatePath)) {
  console.error('Missing dist/index.html — run vite build first');
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');
const written = SEO_PAGES.map((page) => writeShell(page, template));
console.log(`Wrote ${written.length} HTML shells under dist/`);
