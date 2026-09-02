/**
 * Optional product-event hooks. Lectern does not load a third-party analytics
 * script; these stay as no-ops so export / demo call sites remain typed.
 */

export function conversionPdfExported(metadata?: Record<string, unknown>): void {
  void metadata;
}

export function conversionLecternExported(metadata?: Record<string, unknown>): void {
  void metadata;
}

export function conversionResultsExported(metadata?: Record<string, unknown>): void {
  void metadata;
}

export function conversionCloudInquiry(source: string): void {
  void source;
}

export function conversionStudioOpened(metadata?: Record<string, unknown>): void {
  void metadata;
}

export function identifySession(attributes: Record<string, string | number | boolean>): void {
  void attributes;
}

export function trackDemoLoaded(id: string): void {
  void id;
}
