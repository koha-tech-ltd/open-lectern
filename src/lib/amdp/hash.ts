const HEX = '0123456789abcdef';

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i]!;
    out += HEX[b >> 4];
    out += HEX[b & 0xf];
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array | null {
  const raw = hex.trim().toLowerCase();
  if (raw.length === 0 || raw.length % 2 !== 0) return null;
  if (!/^[0-9a-f]+$/.test(raw)) return null;
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function normalizeSha256(raw: string): string | null {
  const hex = raw.trim().toLowerCase().replace(/^sha256:/, '');
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  return hex;
}

function asArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  return copy;
}

/** SHA-256 hex. Requires Web Crypto (browsers and Node 19+). */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('AMDP requires Web Crypto (crypto.subtle) for SHA-256.');
  }
  const digest = await subtle.digest('SHA-256', asArrayBuffer(data));
  return bytesToHex(new Uint8Array(digest));
}
