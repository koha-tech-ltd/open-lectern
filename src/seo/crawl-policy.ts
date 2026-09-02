/** robots.txt body (trailing newline). */
export function buildRobotsTxt(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return [
    '# Lectern — lectern.click',
    '# Public product pages are indexable. Lessons stay in the browser, not on this host.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}
