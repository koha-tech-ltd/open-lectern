import { sha256Hex } from './hash.ts';

export const DEFAULT_MERKLE_CHUNK_SIZE = 65_536;

export type MerkleTree = {
  chunkSize: number;
  leaves: string[];
  chunks: Uint8Array[];
};

export async function merkleLeaves(bytes: Uint8Array, chunkSize = DEFAULT_MERKLE_CHUNK_SIZE): Promise<string[]> {
  const size = Math.max(1, Math.floor(chunkSize));
  const leaves: string[] = [];
  if (bytes.length === 0) return leaves;
  for (let offset = 0; offset < bytes.length; offset += size) {
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + size));
    leaves.push(await sha256Hex(slice));
  }
  return leaves;
}

export async function buildMerkle(bytes: Uint8Array, chunkSize = DEFAULT_MERKLE_CHUNK_SIZE): Promise<MerkleTree> {
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: Uint8Array[] = [];
  const leaves: string[] = [];
  if (bytes.length === 0) return { chunkSize: size, leaves, chunks };
  for (let offset = 0; offset < bytes.length; offset += size) {
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + size));
    chunks.push(slice);
    leaves.push(await sha256Hex(slice));
  }
  return { chunkSize: size, leaves, chunks };
}

export function missingLeaves(expected: string[], received: Array<Uint8Array | undefined>): number[] {
  const missing: number[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    if (!received[i]) missing.push(i);
  }
  return missing;
}

export function concatChunks(chunks: Array<Uint8Array | undefined>, expectedCount: number): Uint8Array | null {
  if (chunks.length < expectedCount) return null;
  for (let i = 0; i < expectedCount; i += 1) {
    if (!chunks[i]) return null;
  }
  const total = chunks.slice(0, expectedCount).reduce((sum, part) => sum + (part?.byteLength ?? 0), 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < expectedCount; i += 1) {
    const part = chunks[i]!;
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
