/**
 * Lectern JSON-chunk upload surface — AMDP json-chunk fallback.
 * Prefer lectern_offer_media / lectern_bind_media when the hash is already in CAS.
 */
import { createAmdpRuntime, type AmdpRuntime } from './amdp/index.ts';
import { lecternAmdp, lecternAmdpOptions } from './amdp-lectern.ts';
import type { SectionMediaKind } from '../types/lesson';

export const MEDIA_UPLOAD_MAX_CHUNK_CHARS = 6000;
export const MEDIA_UPLOAD_RECOMMENDED_CHUNK_CHARS = 4000;
export const MEDIA_UPLOAD_MAX_CONCURRENT = 8;
export const MEDIA_UPLOAD_TTL_MS = 10 * 60 * 1000;

export type MediaUploadPurpose = 'illustration' | 'section' | 'quiz-choice';

type UploadOk<T> = { ok: true } & T;
type UploadErr = { ok: false; error: string };
export type UploadResult<T> = UploadOk<T> | UploadErr;

export type MediaUploadSession = {
  id: string;
  mimeType: string;
  kind: SectionMediaKind;
  filename: string;
  chunks: string[];
  receivedChars: number;
  createdAt: number;
  updatedAt: number;
};

export function createMediaUploadRegistry(options?: {
  now?: () => number;
  createId?: (prefix: string) => string;
  ttlMs?: number;
}): {
  begin: (input: { mimeType: string; filename?: string; kind?: SectionMediaKind }) => UploadResult<{
    uploadId: string;
    mimeType: string;
    kind: SectionMediaKind;
    filename: string;
    recommendedChunkChars: number;
    maxChunkChars: number;
    hint: string;
  }>;
  append: (input: { uploadId: string; chunk: string; index?: number }) => UploadResult<{
    uploadId: string;
    chunkIndex: number;
    chunkCount: number;
    receivedChars: number;
  }>;
  snapshot: (uploadId: string) => UploadResult<{ session: MediaUploadSession }>;
  assemble: (uploadId: string) => Promise<
    UploadResult<{
      uploadId: string;
      sha256: string;
      casUri: string;
      src: string;
      mimeType: string;
      kind: SectionMediaKind;
      filename: string;
      byteLength: number;
    }>
  >;
  abort: (uploadId: string) => UploadResult<{ uploadId: string }>;
  size: () => number;
  runtime: AmdpRuntime;
} {
  const runtime =
    options == null
      ? lecternAmdp
      : createAmdpRuntime({
          ...lecternAmdpOptions,
          now: options.now,
          createId: options.createId,
          jsonTtlMs: options.ttlMs ?? MEDIA_UPLOAD_TTL_MS,
        });

  return {
    runtime,
    begin: (input) => {
      const result = runtime.beginJsonChunk({
        mimeType: input.mimeType,
        filename: input.filename,
        kind: input.kind,
      });
      if (!result.ok) return result;
      if (result.kind === 'binary') {
        return { ok: false, error: 'Unsupported mimeType for Lectern media.' };
      }
      return { ...result, kind: result.kind };
    },
    append: (input) => runtime.appendJsonChunk(input),
    snapshot: (uploadId) => {
      const snap = runtime.snapshotJsonChunk(uploadId);
      if (!snap.ok) return snap;
      if (snap.session.kind === 'binary') {
        return { ok: false, error: 'Unsupported mimeType for Lectern media.' };
      }
      return { ok: true, session: { ...snap.session, kind: snap.session.kind } };
    },
    async assemble(uploadId) {
      const assembled = await runtime.assembleJsonChunk(uploadId);
      if (!assembled.ok) return assembled;
      if (assembled.kind === 'binary') {
        return { ok: false, error: 'Unsupported mimeType for Lectern media.' };
      }
      return { ...assembled, kind: assembled.kind };
    },
    abort: (uploadId) => runtime.abortJsonChunk(uploadId),
    size: () => runtime.jsonChunkCount(),
  };
}

export const mediaUploadRegistry = createMediaUploadRegistry();

export {
  estimateBase64Bytes,
  normalizeMimeType,
  sanitizeJsonChunk as sanitizeMediaChunk,
} from './amdp/index.ts';
