export const BUILTIN_SECTION_KINDS = ['material', 'example', 'summary'] as const;

export type BuiltinSectionKind = (typeof BUILTIN_SECTION_KINDS)[number];

export function isBuiltinSectionKind(kind: string): kind is BuiltinSectionKind {
  return (BUILTIN_SECTION_KINDS as readonly string[]).includes(kind);
}

export function sectionKindClassName(kind: string): string {
  if (kind === 'example' || kind === 'summary') return `manuscript-kind-${kind}`;
  if (kind === 'material') return 'manuscript-kind-material';
  return 'manuscript-kind-custom';
}

/** Trim a teacher-entered type name, or map obvious aliases onto a built-in role. */
export function normalizeSectionKind(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower === 'material' || lower === 'reading') return 'material';
  if (lower === 'example' || lower === 'worked example') return 'example';
  if (lower === 'summary' || lower === 'takeaways' || lower === 'takeaway') return 'summary';
  return name;
}

export function uniqueCustomSectionKinds(kinds: readonly string[]): string[] {
  const seen = new Set<string>();
  const extra: string[] = [];
  for (const kind of kinds) {
    if (isBuiltinSectionKind(kind)) continue;
    const key = kind.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push(kind);
  }
  return extra;
}
