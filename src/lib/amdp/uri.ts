import { CAS_URI_SCHEME } from './types.ts';
import { normalizeSha256 } from './hash.ts';

export function casUri(sha256: string): string {
  const hex = normalizeSha256(sha256);
  if (!hex) throw new Error('Invalid SHA-256 hex.');
  return `${CAS_URI_SCHEME}${hex}`;
}

export function parseCasUri(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith(CAS_URI_SCHEME)) return null;
  return normalizeSha256(trimmed.slice(CAS_URI_SCHEME.length));
}

export function isCasUri(value: string): boolean {
  return parseCasUri(value) !== null;
}
