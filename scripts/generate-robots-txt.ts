/**
 * Writes public/robots.txt from src/seo/crawl-policy.ts.
 *
 * Run: node --experimental-strip-types scripts/generate-robots-txt.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { site } from '../src/content/site.ts';
import { buildRobotsTxt } from '../src/seo/crawl-policy.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const siteUrl = (process.env.VITE_SITE_URL ?? site.url).trim().replace(/\/$/, '');

const out = path.join(root, 'public', 'robots.txt');
fs.writeFileSync(out, buildRobotsTxt(siteUrl), 'utf8');
console.log('Wrote', path.relative(root, out), `(base ${siteUrl})`);
