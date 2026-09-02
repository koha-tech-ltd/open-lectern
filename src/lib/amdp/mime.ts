import type { AmdpKind } from './types.ts';
import { err, ok, type AmdpResult } from './result.ts';

const IMAGE = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const VIDEO = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']);

export function normalizeMimeType(
  raw: string,
  options?: {
    allowedMimeTypes?: readonly string[];
    rejectMime?: (mimeType: string) => string | null;
  },
): AmdpResult<{ mimeType: string; kind: AmdpKind }> {
  const mimeType = raw.trim().toLowerCase().split(';')[0]?.trim() ?? '';
  if (!mimeType) return err('mimeType is required.');
  const rejected = options?.rejectMime?.(mimeType);
  if (rejected) return err(rejected);
  const normalized = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  if (options?.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
    const allow = new Set(options.allowedMimeTypes.map((item) => (item === 'image/jpg' ? 'image/jpeg' : item)));
    if (!allow.has(normalized)) {
      return err(`Unsupported mimeType "${raw.trim()}".`);
    }
  }
  const kind: AmdpKind = IMAGE.has(normalized) ? 'image' : VIDEO.has(normalized) ? 'video' : 'binary';
  return ok({ mimeType: normalized, kind });
}

export function defaultKindForMime(mimeType: string): AmdpKind {
  const normalized = mimeType.trim().toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.trim().toLowerCase();
  if (IMAGE.has(normalized)) return 'image';
  if (VIDEO.has(normalized)) return 'video';
  return 'binary';
}
