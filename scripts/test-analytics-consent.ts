/**
 * Session attribution helpers for Lectern analytics.
 * Run: node --experimental-strip-types scripts/test-analytics-consent.ts
 */
import {
  analyticsEntry,
  hasLandingEntryQuery,
  isAgenticUsage,
  isStudioShortcutSearch,
  stripLandingEntrySearch,
  studioPathFromLanding,
} from '../src/lib/analytics-consent.ts';

let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
  } else {
    console.log(`  ok    ${msg}`);
  }
}

console.log('Lectern analytics — session attribution\n');

check(studioPathFromLanding('/studio') === '/studio?via=home', 'studio path from home carries via=home');
check(hasLandingEntryQuery('?via=home'), 'via=home is a landing entry');
check(!hasLandingEntryQuery('?via=pdf'), 'other via values are not landing entry');
check(stripLandingEntrySearch('?via=home') === '', 'strips lone via=home');
check(stripLandingEntrySearch('?via=home&mode=student') === '?mode=student', 'keeps other params when stripping via');

check(isStudioShortcutSearch('?demo=webmcp'), 'demo query is a studio shortcut');
check(!isStudioShortcutSearch('?mode=student'), 'mode alone is studio chrome, not a shortcut');
check(isStudioShortcutSearch('?from=pdf'), 'pdf continuation is a studio shortcut');
check(isStudioShortcutSearch('?l=abc'), 'share payload is a studio shortcut');
check(!isStudioShortcutSearch(''), 'empty search is not a shortcut');
check(!isStudioShortcutSearch('?via=home'), 'via=home is not a studio shortcut');

check(
  isAgenticUsage({ controlled: true, nativeWebMcp: false, webMcpTestingApi: false }),
  'automated browser is agentic',
);
check(
  isAgenticUsage({ controlled: false, nativeWebMcp: true, webMcpTestingApi: false }),
  'native WebMCP is agentic',
);
check(
  isAgenticUsage({ controlled: false, nativeWebMcp: false, webMcpTestingApi: true }),
  'WebMCP testing API is agentic',
);
check(
  !isAgenticUsage({ controlled: false, nativeWebMcp: false, webMcpTestingApi: false }),
  'ordinary browser is not agentic',
);

check(
  analyticsEntry({ pathname: '/', search: '', fromLanding: false }) === 'landing',
  'home page is a landing entry',
);
check(
  analyticsEntry({ pathname: '/studio', search: '', fromLanding: false }) === 'direct',
  'cold studio is a direct entry',
);
check(
  analyticsEntry({ pathname: '/studio', search: '', fromLanding: true }) === 'landing',
  'studio after home is still landing',
);
check(
  analyticsEntry({ pathname: '/studio', search: '?via=home', fromLanding: false }) === 'landing',
  'studio with via=home is landing',
);
check(
  analyticsEntry({ pathname: '/studio', search: '?demo=webmcp', fromLanding: false }) === 'shortcut',
  'demo query is a shortcut entry',
);
check(
  analyticsEntry({ pathname: '/studio', search: '?mode=teacher', fromLanding: false }) === 'direct',
  'studio with mode chrome is still a direct entry',
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll analytics attribution checks passed.');
