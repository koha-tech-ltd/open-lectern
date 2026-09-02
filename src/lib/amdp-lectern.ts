import {
  createAmdpRuntime,
  err,
  isCasUri,
  parseCasUri,
  ok,
  type AmdpLimits,
  type AmdpResult,
  type AmdpRuntime,
} from './amdp/index.ts';
import { compressRasterBytes, MAX_IMAGE_BYTES, MAX_IMAGE_INTAKE_BYTES } from './image-compress.ts';
import type { LessonDocument, SectionMedia } from '../types/lesson';

export { isCasUri, parseCasUri };

export const LECTERN_MAX_IMAGE_BYTES = MAX_IMAGE_BYTES;
export const LECTERN_MAX_VIDEO_BYTES = 6_000_000;
export const LECTERN_MAX_IMAGE_INTAKE_BYTES = MAX_IMAGE_INTAKE_BYTES;

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
] as const;

export const lecternAmdpOptions: AmdpLimits = {
  maxObjectBytes: LECTERN_MAX_VIDEO_BYTES,
  jsonChunkMaxChars: 6000,
  jsonChunkRecommendedChars: 4000,
  allowedMimeTypes: ALLOWED_MIMES,
  rejectMime: (mimeType) =>
    mimeType === 'image/svg+xml' || mimeType === 'image/svg'
      ? 'SVG belongs in lectern_generate_section_media. AMDP intake is for raster images and video.'
      : null,
  bytesLimitForMime: (_mime, kind) => (kind === 'video' ? LECTERN_MAX_VIDEO_BYTES : LECTERN_MAX_IMAGE_INTAKE_BYTES),
  agentChannel: 'json',
};

export const lecternAmdp: AmdpRuntime = createAmdpRuntime(lecternAmdpOptions);

export type LecternAmdpWindow = {
  protocol: 'AMDP/1';
  put: AmdpRuntime['put'];
  putBase64: AmdpRuntime['putBase64'];
  offer: AmdpRuntime['offer'];
  bind: AmdpRuntime['bind'];
  status: AmdpRuntime['status'];
  ingestFromHost: AmdpRuntime['ingestFromHost'];
};

declare global {
  interface Window {
    __lecternAmdp?: LecternAmdpWindow;
  }
}

function mimeFromFile(file: File): string {
  const typed = file.type.trim().toLowerCase();
  if (typed && typed !== 'application/octet-stream') return typed;
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.avif')) return 'image/avif';
  if (name.endsWith('.mp4')) return 'video/mp4';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.ogg') || name.endsWith('.ogv')) return 'video/ogg';
  return 'image/jpeg';
}

export const LECTERN_AMDP_STAGING_CLASS = 'lectern-amdp-file-staging';

/** Plane-put a browser File into this tab’s CAS (tests + in-page arrayBuffer() after a generated input). */
export async function ingestAmdpFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return lecternAmdp.put(bytes, mimeFromFile(file));
}

export type CompressAmdpRasterResult = {
  sha256: string;
  originalSha256: string;
  byteLength: number;
  mimeType: string;
  changed: boolean;
};

/** Shrink a CAS raster on this page. Bind the returned sha256 — do not ask the agent to recompress. */
export async function compressAmdpRaster(sha256: string): Promise<AmdpResult<CompressAmdpRasterResult>> {
  const object = lecternAmdp.get(sha256);
  if (!object) {
    return err('Object is not in CAS. Plane-put or finish json-chunk, then call lectern_compress_media.');
  }
  if (object.mimeType.startsWith('video/')) {
    return err('Video is not compressed here. Keep clips under 6 MB.');
  }
  try {
    const prepared = await compressRasterBytes(object.bytes, object.mimeType);
    const stored = await lecternAmdp.put(prepared.bytes, prepared.mimeType);
    if (!stored.ok) return stored;
    return ok({
      sha256: stored.sha256,
      originalSha256: object.sha256,
      byteLength: stored.byteLength,
      mimeType: stored.mimeType,
      changed: stored.sha256 !== object.sha256,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Could not compress raster.');
  }
}

export function rasterNeedsCompress(sha256: string): boolean {
  const object = lecternAmdp.get(sha256);
  if (!object) return false;
  if (object.mimeType.startsWith('video/')) return false;
  return object.bytes.byteLength > LECTERN_MAX_IMAGE_BYTES;
}

function isTeacherFilePicker(input: HTMLInputElement): boolean {
  return Boolean(input.closest('#root'));
}

/** Hide an agent-created file input without removing it. Teacher pickers in #root stay visible. */
export function concealAmdpStagingInput(input: HTMLInputElement): void {
  if (isTeacherFilePicker(input)) return;
  input.classList.add(LECTERN_AMDP_STAGING_CLASS);
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  if (input.dataset.lecternAmdpWired === '1') return;
  input.dataset.lecternAmdpWired = '1';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    void ingestAmdpFile(file);
  });
}

function scanAmdpStagingInputs(root: ParentNode): void {
  root.querySelectorAll('input[type="file"]').forEach((el) => {
    if (el instanceof HTMLInputElement) concealAmdpStagingInput(el);
  });
}

function watchAmdpStagingInputs(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  if (document.body) scanAmdpStagingInputs(document.body);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node instanceof HTMLInputElement && node.type === 'file') {
          concealAmdpStagingInput(node);
        } else {
          scanAmdpStagingInputs(node);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export function installLecternAmdpWindow(): void {
  if (typeof window === 'undefined') return;
  const api: LecternAmdpWindow = {
    protocol: 'AMDP/1',
    put: (bytes, mimeType) => lecternAmdp.put(bytes, mimeType),
    putBase64: (base64, mimeType) => lecternAmdp.putBase64(base64, mimeType),
    offer: (input) => lecternAmdp.offer(input),
    bind: (input) => lecternAmdp.bind(input),
    status: (sha256) => lecternAmdp.status(sha256),
    ingestFromHost: (sha256, mimeType) => lecternAmdp.ingestFromHost(sha256, mimeType),
  };
  window.__lecternAmdp = api;
  watchAmdpStagingInputs();
}

export async function stampMediaCas(media: SectionMedia): Promise<SectionMedia> {
  if (media.cas && parseCasUri(media.cas)) return media;
  if (!media.src.startsWith('data:')) return media;
  const hydrated = await lecternAmdp.hydrateFromDataUrl(media.src);
  if (!hydrated.ok) return media;
  return { ...media, cas: hydrated.casUri };
}

function collectMedia(lesson: LessonDocument): SectionMedia[] {
  const items: SectionMedia[] = [];
  for (const section of lesson.sections) {
    if (section.media) items.push(...section.media);
  }
  for (const quiz of lesson.quiz) {
    for (const entry of quiz.choiceMedia ?? []) {
      if (entry) items.push(entry);
    }
  }
  return items;
}

/** Index data URLs already on the lesson so a later offer can cas-hit. */
export async function hydrateLessonCas(lesson: LessonDocument): Promise<number> {
  let n = 0;
  for (const media of collectMedia(lesson)) {
    if (!media.src.startsWith('data:')) continue;
    const hydrated = await lecternAmdp.hydrateFromDataUrl(media.src);
    if (hydrated.ok) n += 1;
  }
  return n;
}

export function resolveCasSrc(src: string): { ok: true; src: string } | { ok: false; error: string } {
  if (!isCasUri(src)) return { ok: false, error: 'Not a cas: URI.' };
  const hex = parseCasUri(src);
  if (!hex) return { ok: false, error: 'Invalid cas:sha256 URI.' };
  const dataUrl = lecternAmdp.toDataUrl(hex);
  if (!dataUrl) return { ok: false, error: 'That hash is not in this tab’s AMDP store. Offer + intake, then bind.' };
  return { ok: true, src: dataUrl };
}
