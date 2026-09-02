import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  analyticsEntry,
  hasLandingEntryQuery,
  isAgenticUsage,
  markEnteredFromLanding,
  readFromLandingSession,
  stripLandingEntrySearch,
  type AnalyticsEntry,
} from '@/lib/analytics-consent';
import { useBrowserAutomation } from '@/hooks/useBrowserAutomation';
import type { BrowserAutomationProbe } from '@/lib/browser-automation';

export function useAnalyticsContext(): {
  agentic: boolean;
  fromLanding: boolean;
  entry: AnalyticsEntry;
  probe: BrowserAutomationProbe;
} {
  const { pathname, search } = useLocation();
  const probe = useBrowserAutomation();
  const [fromLanding, setFromLanding] = useState(() => readFromLandingSession());

  useEffect(() => {
    if (!hasLandingEntryQuery(search)) return;
    if (!readFromLandingSession()) {
      markEnteredFromLanding();
      setFromLanding(true);
    }
    const nextSearch = stripLandingEntrySearch(search);
    if (nextSearch === (search.startsWith('?') ? search : search ? `?${search}` : '')) return;
    const url = `${pathname}${nextSearch}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
  }, [pathname, search]);

  const landed = fromLanding || hasLandingEntryQuery(search);
  return {
    agentic: isAgenticUsage(probe),
    fromLanding: landed,
    entry: analyticsEntry({ pathname, search, fromLanding: landed }),
    probe,
  };
}
