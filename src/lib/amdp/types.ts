/** Wire protocol identifier. Bump when offer/answer/bind shapes change. */
export const AMDP_PROTOCOL = 'AMDP/1' as const;

export const CAS_URI_SCHEME = 'cas:sha256:';

export type AmdpProtocol = typeof AMDP_PROTOCOL;

export type AmdpKind = 'image' | 'video' | 'binary';

export type AmdpProvenance = 'generated' | 'fetched' | 'user' | 'unknown';

/**
 * Ranked intakes. Lower index is cheaper.
 * cas-hit sends nothing. json-chunk is the JSON-RPC / WebMCP fallback.
 */
export const AMDP_INTAKE_RANK = [
  'cas-hit',
  'host-fetch',
  'plane-put',
  'merkle-slice',
  'json-chunk',
] as const;

export type AmdpIntake = (typeof AMDP_INTAKE_RANK)[number];

export type AmdpDisposition = 'have' | 'intake';

export type AmdpMerkleOffer = {
  chunkSize: number;
  leaves: string[];
};

/** Control-plane offer: cite bytes, never carry them. */
export type AmdpOfferInput = {
  sha256: string;
  byteLength: number;
  mimeType: string;
  width?: number;
  height?: number;
  merkle?: AmdpMerkleOffer;
  provenance?: AmdpProvenance;
  filename?: string;
};

export type AmdpAnswer = {
  protocol: AmdpProtocol;
  disposition: AmdpDisposition;
  intake: AmdpIntake;
  available: AmdpIntake[];
  sha256: string;
  byteLength: number;
  mimeType: string;
  fetchUrl?: string;
  recommendedChunkChars?: number;
  maxChunkChars?: number;
  merkleChunkSize?: number;
  missingLeaves?: number[];
};

export type AmdpBindInput = {
  sha256: string;
  purpose: string;
  alt: string;
  caption?: string;
  target?: Record<string, string | number | boolean | null>;
};

export type AmdpBindResult = {
  sha256: string;
  casUri: string;
  src: string;
  mimeType: string;
  kind: AmdpKind;
  byteLength: number;
  purpose: string;
  alt: string;
  caption?: string;
  target: Record<string, string | number | boolean | null>;
};

export type CasObject = {
  sha256: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type AmdpStatus = {
  sha256: string;
  present: boolean;
  mimeType?: string;
  byteLength?: number;
  merkle?: {
    chunkSize: number;
    leafCount: number;
    received: number;
    missingLeaves: number[];
  };
  jsonChunk?: {
    uploadId: string;
    chunkCount: number;
    receivedChars: number;
  };
};

export type AmdpPackObject = {
  sha256: string;
  mimeType: string;
  /** Standard base64 of the raw bytes. */
  blob: string;
};

/** Portable CAS snapshot for document restore packs (e.g. LCT1). */
export type AmdpPack = {
  protocol: AmdpProtocol;
  objects: AmdpPackObject[];
};

export type AmdpHost = {
  /**
   * Fetch raw bytes for a content hash (service worker, CDP Fetch.fulfill,
   * local sidecar). Return null if this host cannot supply the object.
   */
  fetch?(sha256: string, mimeType: string): Promise<Uint8Array | null>;
  /** Optional durable store (OPFS). Memory CAS is always used as the live index. */
  persist?(object: CasObject): Promise<void>;
  load?(sha256: string): Promise<CasObject | null>;
  /** Public URL the page would GET for host-fetch (default: `/.amdp/cas/{sha256}`). */
  fetchUrl?(sha256: string): string;
};

export type AmdpLimits = {
  now?: () => number;
  createId?: (prefix: string) => string;
  maxObjectBytes?: number;
  bytesLimitForMime?: (mimeType: string, kind: AmdpKind) => number;
  jsonChunkMaxChars?: number;
  jsonChunkRecommendedChars?: number;
  maxConcurrentJson?: number;
  jsonTtlMs?: number;
  merkleChunkSize?: number;
  allowedMimeTypes?: readonly string[];
  rejectMime?: (mimeType: string) => string | null;
  /**
   * `json` (default): recommend merkle-slice or json-chunk so a WebMCP/JSON agent
   * can complete intake. `binary`: prefer host-fetch / plane-put.
   */
  agentChannel?: 'json' | 'binary';
};

export type JsonChunkBegin = {
  uploadId: string;
  mimeType: string;
  kind: AmdpKind;
  filename: string;
  recommendedChunkChars: number;
  maxChunkChars: number;
  hint: string;
};

export type JsonChunkAppend = {
  uploadId: string;
  chunkIndex: number;
  chunkCount: number;
  receivedChars: number;
};

export type JsonChunkAssembled = {
  uploadId: string;
  sha256: string;
  casUri: string;
  src: string;
  mimeType: string;
  kind: AmdpKind;
  filename: string;
  byteLength: number;
};
