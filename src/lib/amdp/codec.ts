import { err, ok, type AmdpResult } from './result.ts';

const DATA_URL_RE = /^data:([^;,]+);base64,([\s\S]*)$/i;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    let part = '';
    for (let j = 0; j < slice.length; j += 1) part += String.fromCharCode(slice[j]!);
    binary += part;
  }
  return btoa(binary);
}

export function base64ToBytes(raw: string): AmdpResult<{ bytes: Uint8Array }> {
  let text = raw.replace(/\s+/g, '');
  if (!text) return err('base64 payload is empty.');
  text = text.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
    return err('payload must be standard or URL-safe base64.');
  }
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return ok({ bytes });
  } catch {
    return err('base64 payload could not be decoded.');
  }
}

export function estimateBase64Bytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export function toDataUrl(mimeType: string, bytes: Uint8Array): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export function parseDataUrl(src: string): AmdpResult<{ mimeType: string; bytes: Uint8Array }> {
  const match = src.trim().match(DATA_URL_RE);
  if (!match) return err('Not a base64 data URL.');
  const mimeType = match[1]!.trim().toLowerCase();
  const decoded = base64ToBytes(match[2] ?? '');
  if (!decoded.ok) return decoded;
  return ok({ mimeType, bytes: decoded.bytes });
}

export function stripDataUrlPrefix(chunk: string): string {
  const text = chunk.replace(/\s+/g, '');
  const match = text.match(/^data:[^;,]+;base64,/i);
  return match ? text.slice(match[0].length) : text;
}
