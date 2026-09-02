import { createId } from './lesson';
import { isCasUri, resolveCasSrc, stampMediaCas } from './amdp-lectern.ts';
import { compressImageBlob, MAX_IMAGE_BYTES } from './image-compress.ts';
import type { SectionMedia, SectionMediaKind } from '../types/lesson';

export { MAX_IMAGE_BYTES };
export const MAX_VIDEO_BYTES = 6_000_000;
const B64_CHUNK = 0x8000;

export type MediaResult =
  | { ok: true; media: SectionMedia }
  | { ok: false; error: string };

export type ResolveMediaResult =
  | { ok: true; src: string }
  | { ok: false; error: string };

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    return file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += B64_CHUNK) {
        const slice = bytes.subarray(i, i + B64_CHUNK);
        let chunk = '';
        for (let j = 0; j < slice.length; j += 1) chunk += String.fromCharCode(slice[j]);
        binary += chunk;
      }
      const type = file.type || 'application/octet-stream';
      return `data:${type};base64,${btoa(binary)}`;
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file: File): Promise<{ src: string; name: string }> {
  const src = await compressImageBlob(file, file.type === 'image/png');
  return { src, name: file.name };
}

function absoluteMediaUrl(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:') || isCasUri(src)) {
    return src;
  }
  if (src.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${src}`;
  }
  return src;
}

/** Whether attach should inline this src immediately (ephemeral URLs). */
export function shouldInlineOnAttach(src: string): boolean {
  const trimmed = src.trim();
  return (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    isCasUri(trimmed)
  );
}

/** Fetch path/URL/blob media and return a compressed data URL. */
export async function resolveMediaSrc(src: string, kind: SectionMediaKind): Promise<ResolveMediaResult> {
  const trimmed = src.trim();
  if (!trimmed) return { ok: false, error: 'Empty media URL.' };
  if (trimmed.startsWith('data:')) return { ok: true, src: trimmed };
  if (isCasUri(trimmed)) return resolveCasSrc(trimmed);

  try {
    if (trimmed.startsWith('blob:')) {
      const blob = await fetch(trimmed).then((res) => res.blob());
      if (kind === 'video' || blob.type.startsWith('video/')) {
        if (blob.size > MAX_VIDEO_BYTES) {
          return { ok: false, error: 'Video must be under ~6 MB for lesson restore/share.' };
        }
        return { ok: true, src: await readFileAsDataUrl(blob) };
      }
      return { ok: true, src: await compressImageBlob(blob) };
    }

    const url = absoluteMediaUrl(trimmed);
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `Could not fetch media (${res.status}).` };
    const blob = await res.blob();

    if (kind === 'video' || blob.type.startsWith('video/') || /\.(mp4|webm|ogg)(\?|$)/i.test(trimmed)) {
      if (blob.size > MAX_VIDEO_BYTES) {
        return { ok: false, error: 'Video must be under ~6 MB for lesson restore/share.' };
      }
      return { ok: true, src: await readFileAsDataUrl(blob) };
    }

    return { ok: true, src: await compressImageBlob(blob, blob.type === 'image/png') };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not load media.',
    };
  }
}

export async function fileToSectionMedia(file: File): Promise<MediaResult> {
  try {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/') || /\.svg$/i.test(file.name);
    if (!isVideo && !isImage) {
      return { ok: false, error: 'Attach a photo (image) or video file.' };
    }
    if (isVideo) {
      if (file.size > MAX_VIDEO_BYTES) {
        return {
          ok: false,
          error: 'Video must be under ~6 MB for lesson restore/share. Use a shorter clip or a URL.',
        };
      }
      const src = await readFileAsDataUrl(file);
      return {
        ok: true,
        media: await stampMediaCas({
          id: createId('media'),
          kind: 'video',
          src,
          alt: file.name,
          caption: file.name,
          name: file.name,
        }),
      };
    }
    const { src, name } = await compressImageFile(file);
    return {
      ok: true,
      media: await stampMediaCas({
        id: createId('media'),
        kind: 'image',
        src,
        alt: name,
        caption: name,
        name,
      }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not attach media.' };
  }
}

export function urlToSectionMedia(
  url: string,
  kind: SectionMediaKind = 'image',
  alt = 'Lesson media',
): MediaResult {
  const src = url.trim();
  if (!src) return { ok: false, error: 'Paste an image or video URL (or /media/… path).' };
  if (
    !(
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('/') ||
      src.startsWith('data:') ||
      src.startsWith('blob:') ||
      isCasUri(src)
    )
  ) {
    return { ok: false, error: 'URL must be http(s), blob, a site path like /media/…, a data URL, or cas:sha256:….' };
  }
  const inferred: SectionMediaKind =
    kind === 'video' || /\.(mp4|webm|ogg)(\?|$)/i.test(src) ? 'video' : 'image';
  return {
    ok: true,
    media: {
      id: createId('media'),
      kind: inferred,
      src,
      alt,
      caption: alt,
      name: src.split('/').pop() || alt,
    },
  };
}

/** Attach by URL; inlines blob/http(s) immediately, leaves site paths for export. */
export async function urlToPersistedSectionMedia(
  url: string,
  kind: SectionMediaKind = 'image',
  alt = 'Lesson media',
): Promise<MediaResult> {
  const built = urlToSectionMedia(url, kind, alt);
  if (!built.ok) return built;
  if (!shouldInlineOnAttach(built.media.src)) {
    return { ok: true, media: await stampMediaCas(built.media) };
  }
  const resolved = await resolveMediaSrc(built.media.src, built.media.kind);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return {
    ok: true,
    media: await stampMediaCas({
      ...built.media,
      src: resolved.src,
      originSrc: built.media.src,
    }),
  };
}

/** @deprecated use urlToSectionMedia */
export function mediaFromUrl(url: string, kind: SectionMediaKind, alt = 'Attached media'): SectionMedia {
  const result = urlToSectionMedia(url, kind, alt);
  if (!result.ok) {
    return {
      id: createId('media'),
      kind,
      src: url.trim(),
      alt,
      caption: alt,
    };
  }
  return result.media;
}
