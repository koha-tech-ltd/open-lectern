import { stripDataUrlPrefix, estimateBase64Bytes } from './codec.ts';
import { normalizeMimeType } from './mime.ts';
import { err, ok, type AmdpResult } from './result.ts';
import type { AmdpKind } from './types.ts';

export const JSON_CHUNK_MAX_CHARS = 6000;
export const JSON_CHUNK_RECOMMENDED_CHARS = 4000;
export const JSON_CHUNK_MAX_CONCURRENT = 8;
export const JSON_CHUNK_TTL_MS = 10 * 60 * 1000;

export type JsonChunkSession = {
  id: string;
  mimeType: string;
  kind: AmdpKind;
  filename: string;
  chunks: string[];
  receivedChars: number;
  createdAt: number;
  updatedAt: number;
};

export function sanitizeJsonChunk(raw: string, maxChars: number): AmdpResult<{ body: string }> {
  const stripped = stripDataUrlPrefix(typeof raw === 'string' ? raw : '');
  const text = stripped.replace(/-/g, '+').replace(/_/g, '/');
  if (!text) return err('chunk had no base64 payload.');
  if (!/^[A-Za-z0-9+/]+=*$/.test(text)) {
    return err('chunk must be standard or URL-safe base64 (optionally prefixed with a data: URL header).');
  }
  if (text.length > maxChars) {
    return err(`chunk is ${text.length} characters; max is ${maxChars}. Split the file and append again.`);
  }
  return ok({ body: text });
}

export function createJsonChunkRegistry(options: {
  now: () => number;
  createId: (prefix: string) => string;
  ttlMs: number;
  maxChars: number;
  recommendedChars: number;
  maxConcurrent: number;
  allowedMimeTypes?: readonly string[];
  rejectMime?: (mimeType: string) => string | null;
  bytesLimitForMime: (mimeType: string, kind: AmdpKind) => number;
}) {
  const sessions = new Map<string, JsonChunkSession>();

  function prune(at: number): void {
    for (const [id, session] of sessions) {
      if (at - session.updatedAt > options.ttlMs) sessions.delete(id);
    }
  }

  function getLive(uploadId: string, at: number): AmdpResult<{ session: JsonChunkSession }> {
    prune(at);
    const id = uploadId.trim();
    if (!id) return err('uploadId is required.');
    const session = sessions.get(id);
    if (!session) return err('Upload not found or expired. Call beginJsonChunk again.');
    session.updatedAt = at;
    return ok({ session });
  }

  return {
    begin(input: { mimeType: string; filename?: string; kind?: AmdpKind }): AmdpResult<{
      uploadId: string;
      mimeType: string;
      kind: AmdpKind;
      filename: string;
      recommendedChunkChars: number;
      maxChunkChars: number;
      hint: string;
    }> {
      const at = options.now();
      prune(at);
      const parsed = normalizeMimeType(input.mimeType, {
        allowedMimeTypes: options.allowedMimeTypes,
        rejectMime: options.rejectMime,
      });
      if (!parsed.ok) return parsed;
      if (input.kind && input.kind !== parsed.kind) {
        return err(`kind "${input.kind}" does not match mimeType ${parsed.mimeType}.`);
      }
      while (sessions.size >= options.maxConcurrent) {
        const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
        if (!oldest) break;
        sessions.delete(oldest.id);
      }
      const filename =
        (input.filename ?? '').trim() ||
        (parsed.kind === 'video' ? 'upload.mp4' : parsed.kind === 'image' ? 'upload.jpg' : 'upload.bin');
      const session: JsonChunkSession = {
        id: options.createId('upl'),
        mimeType: parsed.mimeType,
        kind: parsed.kind,
        filename,
        chunks: [],
        receivedChars: 0,
        createdAt: at,
        updatedAt: at,
      };
      sessions.set(session.id, session);
      return ok({
        uploadId: session.id,
        mimeType: session.mimeType,
        kind: session.kind,
        filename: session.filename,
        recommendedChunkChars: options.recommendedChars,
        maxChunkChars: options.maxChars,
        hint: `Append base64 slices of at most ${options.recommendedChars} characters, then assemble/bind. AMDP JSON-chunk fallback — prefer offer/bind when the hash is already in CAS.`,
      });
    },

    append(input: { uploadId: string; chunk: string; index?: number }): AmdpResult<{
      uploadId: string;
      chunkIndex: number;
      chunkCount: number;
      receivedChars: number;
    }> {
      const at = options.now();
      const found = getLive(input.uploadId, at);
      if (!found.ok) return found;
      const cleaned = sanitizeJsonChunk(input.chunk, options.maxChars);
      if (!cleaned.ok) return cleaned;
      const expectedIndex = found.session.chunks.length;
      if (typeof input.index === 'number' && input.index !== expectedIndex) {
        return err(`chunk index ${input.index} is out of order; next index is ${expectedIndex}.`);
      }
      found.session.chunks.push(cleaned.body);
      found.session.receivedChars += cleaned.body.length;
      found.session.updatedAt = at;
      const maxBytes = options.bytesLimitForMime(found.session.mimeType, found.session.kind);
      if (estimateBase64Bytes(found.session.chunks.join('')) > maxBytes) {
        sessions.delete(found.session.id);
        return err(`Object exceeded ${maxBytes} bytes during upload.`);
      }
      return ok({
        uploadId: found.session.id,
        chunkIndex: expectedIndex,
        chunkCount: found.session.chunks.length,
        receivedChars: found.session.receivedChars,
      });
    },

    snapshot(uploadId: string) {
      return getLive(uploadId, options.now());
    },

    take(uploadId: string): AmdpResult<{ session: JsonChunkSession; body: string; byteLength: number }> {
      const found = getLive(uploadId, options.now());
      if (!found.ok) return found;
      if (found.session.chunks.length === 0 || found.session.receivedChars === 0) {
        return err('Upload is empty. Append at least one chunk before assemble.');
      }
      const body = found.session.chunks.join('');
      const byteLength = estimateBase64Bytes(body);
      const maxBytes = options.bytesLimitForMime(found.session.mimeType, found.session.kind);
      if (byteLength > maxBytes) {
        return err(`Object is ${byteLength} bytes; max is ${maxBytes}.`);
      }
      return ok({ session: found.session, body, byteLength });
    },

    abort(uploadId: string): AmdpResult<{ uploadId: string }> {
      const id = uploadId.trim();
      if (!id) return err('uploadId is required.');
      if (!sessions.has(id)) return err('Upload not found or already finished.');
      sessions.delete(id);
      return ok({ uploadId: id });
    },

    size() {
      prune(options.now());
      return sessions.size;
    },
  };
}
