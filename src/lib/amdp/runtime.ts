import { createMemoryCas, type CasStore } from './cas.ts';
import { base64ToBytes, bytesToBase64, parseDataUrl, toDataUrl } from './codec.ts';
import { sha256Hex, normalizeSha256 } from './hash.ts';
import {
  JSON_CHUNK_MAX_CHARS,
  JSON_CHUNK_MAX_CONCURRENT,
  JSON_CHUNK_RECOMMENDED_CHARS,
  JSON_CHUNK_TTL_MS,
  createJsonChunkRegistry,
} from './json-chunk.ts';
import { concatChunks, DEFAULT_MERKLE_CHUNK_SIZE, missingLeaves } from './merkle.ts';
import { normalizeMimeType } from './mime.ts';
import { err, ok, type AmdpResult } from './result.ts';
import type {
  AmdpAnswer,
  AmdpBindInput,
  AmdpBindResult,
  AmdpHost,
  AmdpIntake,
  AmdpKind,
  AmdpLimits,
  AmdpOfferInput,
  AmdpPack,
  AmdpStatus,
  CasObject,
} from './types.ts';
import { AMDP_INTAKE_RANK, AMDP_PROTOCOL } from './types.ts';
import { casUri } from './uri.ts';

export type AmdpRuntime = {
  offer(input: AmdpOfferInput): AmdpResult<AmdpAnswer>;
  put(bytes: Uint8Array, mimeType: string): Promise<AmdpResult<{ sha256: string; byteLength: number; casUri: string; mimeType: string; kind: AmdpKind }>>;
  putBase64(base64: string, mimeType: string): Promise<AmdpResult<{ sha256: string; byteLength: number; casUri: string; mimeType: string; kind: AmdpKind }>>;
  ingestFromHost(sha256: string, mimeType?: string): Promise<AmdpResult<{ sha256: string; byteLength: number; casUri: string }>>;
  putMerkleSlice(input: {
    sha256: string;
    index: number;
    bytes?: Uint8Array;
    chunk?: string;
  }): Promise<AmdpResult<{ sha256: string; index: number; received: number; missingLeaves: number[]; complete: boolean }>>;
  beginJsonChunk: ReturnType<typeof createJsonChunkRegistry>['begin'];
  appendJsonChunk: ReturnType<typeof createJsonChunkRegistry>['append'];
  assembleJsonChunk(uploadId: string): Promise<
    AmdpResult<{
      uploadId: string;
      sha256: string;
      casUri: string;
      src: string;
      mimeType: string;
      kind: AmdpKind;
      filename: string;
      byteLength: number;
    }>
  >;
  abortJsonChunk: ReturnType<typeof createJsonChunkRegistry>['abort'];
  snapshotJsonChunk: ReturnType<typeof createJsonChunkRegistry>['snapshot'];
  jsonChunkCount(): number;
  bind(input: AmdpBindInput): AmdpResult<AmdpBindResult>;
  status(sha256: string): AmdpResult<AmdpStatus>;
  get(sha256: string): CasObject | undefined;
  toDataUrl(sha256: string): string | undefined;
  toCasUri(sha256: string): string | undefined;
  hydrateFromDataUrl(src: string): Promise<AmdpResult<{ sha256: string; mimeType: string; byteLength: number; casUri: string }>>;
  exportPack(): AmdpPack;
  importPack(pack: AmdpPack): AmdpResult<{ imported: number }>;
};

type MerkleSession = {
  sha256: string;
  mimeType: string;
  byteLength: number;
  chunkSize: number;
  leaves: string[];
  chunks: Array<Uint8Array | undefined>;
};

function defaultId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createAmdpRuntime(options?: AmdpLimits & { cas?: CasStore; host?: AmdpHost }): AmdpRuntime {
  const now = options?.now ?? Date.now;
  const createId = options?.createId ?? defaultId;
  const cas = options?.cas ?? createMemoryCas();
  const host = options?.host;
  const maxObjectBytes = options?.maxObjectBytes ?? 8_000_000;
  const merkleChunkSize = options?.merkleChunkSize ?? DEFAULT_MERKLE_CHUNK_SIZE;
  const jsonMax = options?.jsonChunkMaxChars ?? JSON_CHUNK_MAX_CHARS;
  const jsonRecommended = options?.jsonChunkRecommendedChars ?? JSON_CHUNK_RECOMMENDED_CHARS;
  const agentChannel = options?.agentChannel ?? 'json';
  const merkleSessions = new Map<string, MerkleSession>();

  const bytesLimitForMime =
    options?.bytesLimitForMime ??
    ((_mime: string, _kind: AmdpKind) => maxObjectBytes);

  const json = createJsonChunkRegistry({
    now,
    createId,
    ttlMs: options?.jsonTtlMs ?? JSON_CHUNK_TTL_MS,
    maxChars: jsonMax,
    recommendedChars: jsonRecommended,
    maxConcurrent: options?.maxConcurrentJson ?? JSON_CHUNK_MAX_CONCURRENT,
    allowedMimeTypes: options?.allowedMimeTypes,
    rejectMime: options?.rejectMime,
    bytesLimitForMime,
  });

  function parseMime(raw: string): AmdpResult<{ mimeType: string; kind: AmdpKind }> {
    return normalizeMimeType(raw, {
      allowedMimeTypes: options?.allowedMimeTypes,
      rejectMime: options?.rejectMime,
    });
  }

  async function store(bytes: Uint8Array, mimeType: string): Promise<AmdpResult<CasObject & { kind: AmdpKind }>> {
    const parsed = parseMime(mimeType);
    if (!parsed.ok) return parsed;
    const limit = bytesLimitForMime(parsed.mimeType, parsed.kind);
    if (bytes.byteLength > limit) {
      return err(`Object is ${bytes.byteLength} bytes; max is ${limit}.`);
    }
    const sha256 = await sha256Hex(bytes);
    const object: CasObject = { sha256, mimeType: parsed.mimeType, bytes };
    cas.put(object);
    merkleSessions.delete(sha256);
    if (host?.persist) {
      try {
        await host.persist(object);
      } catch {
        // Live CAS still holds the object; durable persist is best-effort.
      }
    }
    return ok({ ...object, kind: parsed.kind });
  }

  function availableIntakes(hasMerkle: boolean): AmdpIntake[] {
    const list: AmdpIntake[] = [];
    if (typeof host?.fetch === 'function') list.push('host-fetch');
    list.push('plane-put');
    if (hasMerkle) list.push('merkle-slice');
    list.push('json-chunk');
    return list;
  }

  function pickIntake(available: AmdpIntake[]): AmdpIntake {
    const rank: AmdpIntake[] =
      agentChannel === 'binary'
        ? [...AMDP_INTAKE_RANK]
        : ['host-fetch', 'merkle-slice', 'json-chunk', 'plane-put'];
    for (const item of rank) {
      if (item === 'cas-hit') continue;
      if (available.includes(item)) return item;
    }
    return 'json-chunk';
  }

  const runtime: AmdpRuntime = {
    offer(input) {
      const sha256 = normalizeSha256(input.sha256);
      if (!sha256) return err('sha256 must be 64 lowercase hex characters.');
      if (!Number.isFinite(input.byteLength) || input.byteLength < 0) {
        return err('byteLength must be a non-negative number.');
      }
      const parsed = parseMime(input.mimeType);
      if (!parsed.ok) return parsed;
      const existing = cas.get(sha256);
      if (existing) {
        return ok({
          protocol: AMDP_PROTOCOL,
          disposition: 'have',
          intake: 'cas-hit',
          available: ['cas-hit'],
          sha256,
          byteLength: existing.bytes.byteLength,
          mimeType: existing.mimeType,
        });
      }
      const hasMerkle = Boolean(input.merkle?.leaves?.length);
      if (hasMerkle && input.merkle) {
        merkleSessions.set(sha256, {
          sha256,
          mimeType: parsed.mimeType,
          byteLength: input.byteLength,
          chunkSize: input.merkle.chunkSize || merkleChunkSize,
          leaves: input.merkle.leaves.map((leaf) => leaf.toLowerCase()),
          chunks: [],
        });
      }
      const available = availableIntakes(hasMerkle);
      const intake = pickIntake(available);
      const answer: AmdpAnswer = {
        protocol: AMDP_PROTOCOL,
        disposition: 'intake',
        intake,
        available,
        sha256,
        byteLength: input.byteLength,
        mimeType: parsed.mimeType,
        recommendedChunkChars: jsonRecommended,
        maxChunkChars: jsonMax,
        merkleChunkSize: input.merkle?.chunkSize || merkleChunkSize,
        missingLeaves: hasMerkle && input.merkle ? input.merkle.leaves.map((_, i) => i) : undefined,
      };
      if (intake === 'host-fetch') {
        answer.fetchUrl = host?.fetchUrl?.(sha256) ?? `/.amdp/cas/${sha256}`;
      }
      return ok(answer);
    },

    async put(bytes, mimeType) {
      const stored = await store(bytes, mimeType);
      if (!stored.ok) return stored;
      return ok({
        sha256: stored.sha256,
        byteLength: stored.bytes.byteLength,
        casUri: casUri(stored.sha256),
        mimeType: stored.mimeType,
        kind: stored.kind,
      });
    },

    async putBase64(base64, mimeType) {
      const decoded = base64ToBytes(base64);
      if (!decoded.ok) return decoded;
      return runtime.put(decoded.bytes, mimeType);
    },

    async ingestFromHost(sha256, mimeType) {
      const hex = normalizeSha256(sha256);
      if (!hex) return err('sha256 must be 64 lowercase hex characters.');
      const existing = cas.get(hex);
      if (existing) {
        return ok({ sha256: hex, byteLength: existing.bytes.byteLength, casUri: casUri(hex) });
      }
      if (!host?.fetch) return err('No AMDP host fetch is configured.');
      const loaded = host.load ? await host.load(hex) : null;
      if (loaded) {
        cas.put(loaded);
        return ok({ sha256: hex, byteLength: loaded.bytes.byteLength, casUri: casUri(hex) });
      }
      const bytes = await host.fetch(hex, mimeType ?? 'application/octet-stream');
      if (!bytes) return err('Host did not return bytes for this hash.');
      const actual = await sha256Hex(bytes);
      if (actual !== hex) return err(`Host bytes hashed to ${actual}, expected ${hex}.`);
      const stored = await store(bytes, mimeType ?? 'application/octet-stream');
      if (!stored.ok) return stored;
      return ok({ sha256: hex, byteLength: stored.bytes.byteLength, casUri: casUri(hex) });
    },

    async putMerkleSlice(input) {
      const hex = normalizeSha256(input.sha256);
      if (!hex) return err('sha256 must be 64 lowercase hex characters.');
      const session = merkleSessions.get(hex);
      if (!session) return err('No merkle intake for this hash. Call offer with merkle.leaves first.');
      if (!Number.isInteger(input.index) || input.index < 0 || input.index >= session.leaves.length) {
        return err(`slice index ${input.index} is out of range (0..${session.leaves.length - 1}).`);
      }
      let bytes = input.bytes;
      if (!bytes && input.chunk) {
        const decoded = base64ToBytes(input.chunk);
        if (!decoded.ok) return decoded;
        bytes = decoded.bytes;
      }
      if (!bytes) return err('Provide bytes or a base64 chunk.');
      const leaf = await sha256Hex(bytes);
      if (leaf !== session.leaves[input.index]) {
        return err(`slice ${input.index} hashed to ${leaf}, expected ${session.leaves[input.index]}.`);
      }
      session.chunks[input.index] = bytes;
      const missing = missingLeaves(session.leaves, session.chunks);
      if (missing.length > 0) {
        return ok({
          sha256: hex,
          index: input.index,
          received: session.leaves.length - missing.length,
          missingLeaves: missing,
          complete: false,
        });
      }
      const joined = concatChunks(session.chunks, session.leaves.length);
      if (!joined) return err('Could not concatenate merkle slices.');
      if (joined.byteLength !== session.byteLength && session.byteLength > 0) {
        return err(`Assembled ${joined.byteLength} bytes, offer cited ${session.byteLength}.`);
      }
      const actual = await sha256Hex(joined);
      if (actual !== hex) return err(`Assembled bytes hashed to ${actual}, expected ${hex}.`);
      const stored = await store(joined, session.mimeType);
      if (!stored.ok) return stored;
      return ok({
        sha256: hex,
        index: input.index,
        received: session.leaves.length,
        missingLeaves: [],
        complete: true,
      });
    },

    beginJsonChunk: (input) => json.begin(input),
    appendJsonChunk: (input) => json.append(input),
    snapshotJsonChunk: (uploadId) => json.snapshot(uploadId),
    abortJsonChunk: (uploadId) => json.abort(uploadId),
    jsonChunkCount: () => json.size(),

    async assembleJsonChunk(uploadId) {
      const taken = json.take(uploadId);
      if (!taken.ok) return taken;
      const decoded = base64ToBytes(taken.body);
      if (!decoded.ok) return decoded;
      const stored = await store(decoded.bytes, taken.session.mimeType);
      if (!stored.ok) return stored;
      return ok({
        uploadId: taken.session.id,
        sha256: stored.sha256,
        casUri: casUri(stored.sha256),
        src: toDataUrl(stored.mimeType, stored.bytes),
        mimeType: stored.mimeType,
        kind: stored.kind,
        filename: taken.session.filename,
        byteLength: stored.bytes.byteLength,
      });
    },

    bind(input) {
      const hex = normalizeSha256(input.sha256);
      if (!hex) return err('sha256 must be 64 lowercase hex characters.');
      const object = cas.get(hex);
      if (!object) {
        return err('Object is not in CAS. Offer then complete intake (put, host-fetch, merkle, or json-chunk) before bind.');
      }
      const purpose = input.purpose.trim();
      if (!purpose) return err('purpose is required.');
      const alt = input.alt.trim();
      if (!alt) return err('alt is required.');
      const parsed = parseMime(object.mimeType);
      const kind = parsed.ok ? parsed.kind : 'binary';
      return ok({
        sha256: hex,
        casUri: casUri(hex),
        src: toDataUrl(object.mimeType, object.bytes),
        mimeType: object.mimeType,
        kind,
        byteLength: object.bytes.byteLength,
        purpose,
        alt,
        caption: input.caption?.trim() || undefined,
        target: input.target ?? {},
      });
    },

    status(sha256) {
      const hex = normalizeSha256(sha256);
      if (!hex) return err('sha256 must be 64 lowercase hex characters.');
      const object = cas.get(hex);
      const merkle = merkleSessions.get(hex);
      if (object) {
        return ok({
          sha256: hex,
          present: true,
          mimeType: object.mimeType,
          byteLength: object.bytes.byteLength,
        });
      }
      if (merkle) {
        const missing = missingLeaves(merkle.leaves, merkle.chunks);
        return ok({
          sha256: hex,
          present: false,
          mimeType: merkle.mimeType,
          byteLength: merkle.byteLength,
          merkle: {
            chunkSize: merkle.chunkSize,
            leafCount: merkle.leaves.length,
            received: merkle.leaves.length - missing.length,
            missingLeaves: missing,
          },
        });
      }
      return ok({ sha256: hex, present: false });
    },

    get(sha256) {
      const hex = normalizeSha256(sha256);
      return hex ? cas.get(hex) : undefined;
    },

    toDataUrl(sha256) {
      const object = runtime.get(sha256);
      return object ? toDataUrl(object.mimeType, object.bytes) : undefined;
    },

    toCasUri(sha256) {
      const hex = normalizeSha256(sha256);
      return hex && cas.has(hex) ? casUri(hex) : undefined;
    },

    async hydrateFromDataUrl(src) {
      const parsed = parseDataUrl(src);
      if (!parsed.ok) return parsed;
      const stored = await store(parsed.bytes, parsed.mimeType);
      if (!stored.ok) return stored;
      return ok({
        sha256: stored.sha256,
        mimeType: stored.mimeType,
        byteLength: stored.bytes.byteLength,
        casUri: casUri(stored.sha256),
      });
    },

    exportPack() {
      return {
        protocol: AMDP_PROTOCOL,
        objects: cas.entries().map((object) => ({
          sha256: object.sha256,
          mimeType: object.mimeType,
          blob: bytesToBase64(object.bytes),
        })),
      };
    },

    importPack(pack) {
      if (pack.protocol !== AMDP_PROTOCOL) {
        return err(`Unsupported pack protocol "${String(pack.protocol)}". Expected ${AMDP_PROTOCOL}.`);
      }
      let imported = 0;
      for (const entry of pack.objects) {
        const hex = normalizeSha256(entry.sha256);
        if (!hex) return err('Pack object has an invalid sha256.');
        const decoded = base64ToBytes(entry.blob);
        if (!decoded.ok) return decoded;
        cas.put({ sha256: hex, mimeType: entry.mimeType, bytes: decoded.bytes });
        imported += 1;
      }
      return ok({ imported });
    },
  };

  return runtime;
}
