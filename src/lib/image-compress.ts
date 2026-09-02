/** Shared raster shrink for teacher Attach-media and AMDP plane-put / json-chunk. */

export const MAX_IMAGE_BYTES = 1_800_000;
export const MAX_IMAGE_EDGE = 1400;
/** Bytes we will accept *before* compressing. Stored object stays at MAX_IMAGE_BYTES. */
export const MAX_IMAGE_INTAKE_BYTES = 12_000_000;

const B64_CHUNK = 0x8000;

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    return file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += B64_CHUNK) {
        const slice = bytes.subarray(i, i + B64_CHUNK);
        let chunk = '';
        for (let j = 0; j < slice.length; j += 1) chunk += String.fromCharCode(slice[j]!);
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = src;
  });
}

function parseDataUrl(src: string): { bytes: Uint8Array; mimeType: string } {
  const match = src.trim().match(/^data:([^;,]+);base64,([\s\S]*)$/i);
  if (!match) throw new Error('Could not encode compressed image.');
  const mimeType = match[1]!.trim().toLowerCase();
  const binary = atob(match[2] ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType };
}

/** Downscale / JPEG-encode a raster for lesson restore and PDF. No-ops in Node (no canvas). */
export async function compressImageBlob(blob: Blob, preferPng = false): Promise<string> {
  if (typeof document === 'undefined') {
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('File is too large for this environment (under ~1.5 MB without canvas).');
    }
    return readFileAsDataUrl(blob);
  }
  if (blob.type === 'image/svg+xml' || blob.type === 'image/gif') {
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('This animated/vector image is larger than the lesson limit.');
    }
    return readFileAsDataUrl(blob);
  }
  const raw = await readFileAsDataUrl(blob);
  const img = await loadImage(raw);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(img, 0, 0, w, h);
  let src = canvas.toDataURL(preferPng ? 'image/png' : 'image/jpeg', 0.84);
  if (src.length > MAX_IMAGE_BYTES * 1.37) {
    src = canvas.toDataURL('image/jpeg', 0.72);
  }
  if (src.length > MAX_IMAGE_BYTES * 1.37) {
    throw new Error('Image is still too large after Lectern compressed it.');
  }
  return src;
}

/** Compress raw raster bytes for AMDP store. Hash may change; runtime rewrites the original sha256. */
export async function compressRasterBytes(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const mime = mimeType.trim().toLowerCase() || 'image/jpeg';
  if (bytes.byteLength > MAX_IMAGE_INTAKE_BYTES) {
    throw new Error(
      `Raster is ${bytes.byteLength} bytes; Lectern intakes at most ${MAX_IMAGE_INTAKE_BYTES} bytes and then compresses.`,
    );
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime });
  const src = await compressImageBlob(blob, mime === 'image/png');
  return parseDataUrl(src);
}
