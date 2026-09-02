export const site = {
  name: 'Lectern',
  url: 'https://lectern.click',
  studioPath: '/studio',
  company: 'KOHA-TECH Sp. z o.o.',
  companyLegalName: 'Koha-Tech spółka z ograniczoną odpowiedzialnością',
  companyUrl: 'https://koha-tech.com',
  address: 'Nowy Świat 33/13, 00-029 Warszawa, Poland',
  krs: '0001183713',
  nip: '5253054129',
  regon: '542256381',
  shareCapital: 'PLN 5,000',
  email: 'contact@koha-tech.com',
  privacyEmail: 'privacy@koha-tech.com',
  legalEmail: 'legal@koha-tech.com',
  githubUrl: 'https://github.com/koha-tech-ltd/open-lectern',
  githubOrgLabel: 'koha-tech-ltd/open-lectern',
  cloudMailto: 'mailto:legal@koha-tech.com?subject=Lectern%20Cloud',
  webmcpChallengeUrl: 'https://openai.com/webmcp-challenge/',
  lastUpdatedLegal: '2026-08-29',
  aiImageNotice:
    'Image notice: visuals on this site are partly generated or edited with AI. Marked accordingly in line with EU AI Act transparency rules (Art. 50).',
} as const;

export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}
