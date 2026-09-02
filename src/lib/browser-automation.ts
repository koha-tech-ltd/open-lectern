/**
 * Page-visible signals that an agent or test runner is driving the browser.
 *
 * Chrome yellow infobar (“Chrome is being controlled by automated test software”)
 * is shown for --enable-automation. The same state is navigator.webdriver (W3C).
 * MDN: also true for --headless and --remote-debugging-port=0.
 *
 * Cursor’s IDE browser is Electron (UA contains Cursor/ and Electron/). It is
 * agent-controlled but does NOT set navigator.webdriver and does not show that
 * Chrome infobar. Detect it from the user agent, not webdriver.
 *
 * CDP attached to a normal Chrome without --enable-automation is not visible
 * to page JavaScript.
 *
 * None of these prove a WebMCP agent has used Lectern tools — that is confirmed
 * only when a registered tool actually runs.
 */

export type AutomationEvidence =
  | 'navigator.webdriver'
  | 'navigator.webdriver.prototype'
  | 'cursor-agent-browser'
  | 'headless-chrome'
  | 'chromedriver'
  | 'playwright'
  | 'selenium'
  | 'dom-automation';

export type AutomationKind = 'none' | 'chrome-webdriver' | 'cursor-agent' | 'headless' | 'bindings';

export interface BrowserAutomationProbe {
  /** True when the page can see automation or an agent-hosted browser. */
  controlled: boolean;
  kind: AutomationKind;
  /** navigator.webdriver, or null if the property is missing / unreadable. */
  webdriver: boolean | null;
  evidence: AutomationEvidence[];
  /** Chrome WebMCP testing helper (chrome://flags/#enable-webmcp-testing). */
  webMcpTestingApi: boolean;
  nativeWebMcp: boolean;
  polyfill: boolean;
}

const EVIDENCE_LABELS: Record<AutomationEvidence, string> = {
  'navigator.webdriver': 'navigator.webdriver',
  'navigator.webdriver.prototype': 'Navigator.prototype.webdriver',
  'cursor-agent-browser': 'Cursor agent browser',
  'headless-chrome': 'HeadlessChrome',
  chromedriver: 'ChromeDriver bindings',
  playwright: 'Playwright bindings',
  selenium: 'Selenium DOM marker',
  'dom-automation': 'domAutomationController',
};

export function describeAutomationEvidence(evidence: AutomationEvidence[]): string {
  if (evidence.length === 0) return 'no automation signal';
  return evidence.map((item) => EVIDENCE_LABELS[item]).join(' · ');
}

export function automationKind(evidence: AutomationEvidence[]): AutomationKind {
  if (evidence.includes('navigator.webdriver') || evidence.includes('navigator.webdriver.prototype')) {
    return 'chrome-webdriver';
  }
  if (evidence.includes('cursor-agent-browser')) return 'cursor-agent';
  if (evidence.includes('headless-chrome')) return 'headless';
  if (evidence.length > 0) return 'bindings';
  return 'none';
}

function readWebdriver(): { value: boolean | null; viaPrototype: boolean } {
  if (typeof navigator === 'undefined') return { value: null, viaPrototype: false };

  try {
    if (navigator.webdriver === true) return { value: true, viaPrototype: false };
  } catch {
    // Some stealth scripts throw on the instance getter.
  }

  try {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
    if (desc?.get) {
      const viaProto = desc.get.call(navigator);
      if (viaProto === true) return { value: true, viaPrototype: true };
      if (viaProto === false && navigator.webdriver !== true) {
        return { value: false, viaPrototype: true };
      }
    }
  } catch {
    // Prototype getter may be revoked.
  }

  try {
    if (navigator.webdriver === false) return { value: false, viaPrototype: false };
  } catch {
    return { value: null, viaPrototype: false };
  }

  return { value: null, viaPrototype: false };
}

function collectWindowNames(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return Object.getOwnPropertyNames(window);
  } catch {
    return [];
  }
}

function hasChromeDriverBindings(names: string[]): boolean {
  return names.some((name) => name.startsWith('cdc_') || name.startsWith('$cdc_'));
}

function hasPlaywrightBindings(names: string[]): boolean {
  const w = window as Window & {
    __playwright?: unknown;
    playwright?: unknown;
    __pwInitScripts?: unknown;
  };
  return Boolean(
    w.__playwright ||
      w.playwright ||
      w.__pwInitScripts ||
      names.includes('__playwright') ||
      names.includes('__playwright__binding__'),
  );
}

function hasSeleniumMarker(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return (
    root.getAttribute('webdriver') === 'true' ||
    root.hasAttribute('driver') ||
    root.hasAttribute('selenium')
  );
}

function hasDomAutomation(): boolean {
  const w = window as Window & {
    domAutomation?: unknown;
    domAutomationController?: unknown;
  };
  return Boolean(w.domAutomation || w.domAutomationController);
}

function detectAgentHost(): AutomationEvidence[] {
  if (typeof navigator === 'undefined') return [];
  const ua = navigator.userAgent;
  const found: AutomationEvidence[] = [];
  if (/Cursor\//i.test(ua) && /Electron\//i.test(ua)) {
    found.push('cursor-agent-browser');
  }
  if (/HeadlessChrome/i.test(ua)) {
    found.push('headless-chrome');
  }
  return found;
}

export function probeBrowserAutomation(): BrowserAutomationProbe {
  const evidence: AutomationEvidence[] = [];
  const { value: webdriver, viaPrototype } = readWebdriver();

  if (webdriver === true) {
    evidence.push(viaPrototype ? 'navigator.webdriver.prototype' : 'navigator.webdriver');
  }

  evidence.push(...detectAgentHost());

  if (typeof window !== 'undefined') {
    const names = collectWindowNames();
    if (hasChromeDriverBindings(names)) evidence.push('chromedriver');
    if (hasPlaywrightBindings(names)) evidence.push('playwright');
    if (hasDomAutomation()) evidence.push('dom-automation');
  }

  if (hasSeleniumMarker()) evidence.push('selenium');

  const polyfill = typeof window !== 'undefined' && window.__lecternWebMcpDemo?.isPolyfill === true;
  const nativeWebMcp =
    !polyfill &&
    Boolean(
      (typeof document !== 'undefined' && document.modelContext) ||
        (typeof navigator !== 'undefined' && navigator.modelContext),
    );

  const kind = automationKind(evidence);

  return {
    controlled: kind !== 'none',
    kind,
    webdriver,
    evidence,
    webMcpTestingApi: typeof navigator !== 'undefined' && navigator.modelContextTesting != null,
    nativeWebMcp,
    polyfill,
  };
}
