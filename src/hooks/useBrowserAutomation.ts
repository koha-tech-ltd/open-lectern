import { useEffect, useState } from 'react';
import {
  probeBrowserAutomation,
  type BrowserAutomationProbe,
} from '@/lib/browser-automation';

const POLL_MS = 2000;

export function useBrowserAutomation(): BrowserAutomationProbe {
  const [probe, setProbe] = useState<BrowserAutomationProbe>(() =>
    typeof window === 'undefined'
      ? {
          controlled: false,
          kind: 'none',
          webdriver: null,
          evidence: [],
          webMcpTestingApi: false,
          nativeWebMcp: false,
          polyfill: false,
        }
      : probeBrowserAutomation(),
  );

  useEffect(() => {
    const refresh = () => {
      const next = probeBrowserAutomation();
      setProbe((prev) => {
        if (
          prev.controlled === next.controlled &&
          prev.kind === next.kind &&
          prev.webdriver === next.webdriver &&
          prev.webMcpTestingApi === next.webMcpTestingApi &&
          prev.nativeWebMcp === next.nativeWebMcp &&
          prev.polyfill === next.polyfill &&
          prev.evidence.join() === next.evidence.join()
        ) {
          return prev;
        }
        return next;
      });
    };

    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return probe;
}
