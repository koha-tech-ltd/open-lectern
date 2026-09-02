/**
 * Deterministic tests for AMDP-backed WebMCP media upload.
 * Run: npm run test:media-upload
 */
import { estimateBase64Bytes, sanitizeJsonChunk } from '../src/lib/amdp/index.ts';
import {
  MEDIA_UPLOAD_MAX_CHUNK_CHARS,
  createMediaUploadRegistry,
  sanitizeMediaChunk,
} from '../src/lib/webmcp-media-upload.ts';
import { compressAmdpRaster, ingestAmdpFile, lecternAmdp } from '../src/lib/amdp-lectern.ts';

let failed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed += 1;
    console.error(`  FAIL  ${message}`);
  } else {
    console.log(`  ok    ${message}`);
  }
}

const PIXEL_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

console.log('WebMCP chunked media upload (AMDP)\n');

{
  const first = sanitizeMediaChunk(`data:image/png;base64,${PIXEL_B64.slice(0, 24)}`, MEDIA_UPLOAD_MAX_CHUNK_CHARS);
  assert(first.ok && first.body === PIXEL_B64.slice(0, 24), 'strips data URL prefix from first chunk');
  const spaced = sanitizeJsonChunk(`${PIXEL_B64.slice(0, 8)}\n ${PIXEL_B64.slice(8, 16)}`, MEDIA_UPLOAD_MAX_CHUNK_CHARS);
  assert(spaced.ok && spaced.body === PIXEL_B64.slice(0, 16), 'strips whitespace inside a chunk');
}

{
  let n = 0;
  const registry = createMediaUploadRegistry({
    createId: () => `upl_test${++n}`,
  });
  const began = registry.begin({ mimeType: 'image/png', filename: 'pixel.png' });
  assert(began.ok && began.uploadId === 'upl_test1', 'begin returns uploadId');
  if (!began.ok) throw new Error('begin failed');
  const mid = Math.floor(PIXEL_B64.length / 2);
  const a = registry.append({ uploadId: began.uploadId, chunk: PIXEL_B64.slice(0, mid), index: 0 });
  const b = registry.append({
    uploadId: began.uploadId,
    chunk: `data:image/png;base64,${PIXEL_B64.slice(mid)}`,
    index: 1,
  });
  assert(a.ok && b.ok && b.chunkCount === 2, 'two chunks append in order');
  const assembled = await registry.assemble(began.uploadId);
  assert(assembled.ok && assembled.src === `data:image/png;base64,${PIXEL_B64}`, 'assemble joins to a data URL');
  if (assembled.ok) {
    assert(assembled.byteLength === estimateBase64Bytes(PIXEL_B64), 'byteLength matches decoded size');
    assert(typeof assembled.sha256 === 'string' && assembled.sha256.length === 64, 'assemble returns sha256');
    const offered = registry.runtime.offer({
      sha256: assembled.sha256,
      byteLength: assembled.byteLength,
      mimeType: 'image/png',
    });
    assert(offered.ok && offered.intake === 'cas-hit', 'offer cas-hits after assemble');
    const bound = registry.runtime.bind({ sha256: assembled.sha256, purpose: 'illustration', alt: 'pixel' });
    assert(bound.ok && bound.src === assembled.src, 'bind returns the same data URL without resending bytes');
  }
  assert(registry.snapshot(began.uploadId).ok, 'assemble keeps the session until commit/abort');
  assert(registry.abort(began.uploadId).ok, 'abort releases the session');
  assert(!(await registry.assemble(began.uploadId)).ok, 'aborted upload cannot assemble');
}

{
  const registry = createMediaUploadRegistry({ createId: () => 'upl_order' });
  const began = registry.begin({ mimeType: 'image/png' });
  if (!began.ok) throw new Error('begin failed');
  registry.append({ uploadId: began.uploadId, chunk: PIXEL_B64.slice(0, 8) });
  const skipped = registry.append({ uploadId: began.uploadId, chunk: PIXEL_B64.slice(8, 16), index: 2 });
  assert(!skipped.ok, 'rejects out-of-order index');
}

{
  let now = 1000;
  const registry = createMediaUploadRegistry({
    now: () => now,
    ttlMs: 50,
    createId: () => 'upl_ttl',
  });
  const began = registry.begin({ mimeType: 'image/png' });
  if (!began.ok) throw new Error('begin failed');
  now = 1060;
  const expired = registry.append({ uploadId: began.uploadId, chunk: PIXEL_B64 });
  assert(!expired.ok, 'expired upload is rejected');
}

{
  const svg = lecternAmdp.beginJsonChunk({ mimeType: 'image/svg+xml' });
  assert(!svg.ok, 'Lectern AMDP rejects SVG rasters');
}

{
  const bytes = new Uint8Array(Buffer.from(PIXEL_B64, 'base64'));
  const file = new File([bytes], 'pixel.png', { type: 'image/png' });
  const put = await ingestAmdpFile(file);
  assert(put.ok, 'ingestAmdpFile puts a File into CAS');
  if (put.ok) {
    const offered = lecternAmdp.offer({
      sha256: put.sha256,
      byteLength: put.byteLength,
      mimeType: 'image/png',
    });
    assert(offered.ok && offered.disposition === 'have', 'offer cas-hits after file ingest');
    const bound = lecternAmdp.bind({ sha256: put.sha256, purpose: 'section', alt: 'pixel' });
    assert(bound.ok && bound.src.startsWith('data:image/png'), 'bind after file ingest returns a data URL for media add');
  }
  const unnamed = new File([bytes], 'pixel.png', { type: '' });
  const guessed = await ingestAmdpFile(unnamed);
  assert(guessed.ok, 'ingestAmdpFile infers PNG mime from the filename when File.type is empty');
}

{
  const missing = await compressAmdpRaster('a'.repeat(64));
  assert(!missing.ok, 'compressAmdpRaster rejects a hash that is not in CAS');
  const bytes = new Uint8Array(Buffer.from(PIXEL_B64, 'base64'));
  const file = new File([bytes], 'pixel.png', { type: 'image/png' });
  const put = await ingestAmdpFile(file);
  assert(put.ok, 'pixel is in CAS before compress tool');
  if (put.ok) {
    const compressed = await compressAmdpRaster(put.sha256);
    assert(compressed.ok, 'lectern_compress_media shrinks or keeps a CAS raster');
    if (compressed.ok) {
      assert(compressed.originalSha256 === put.sha256, 'compress reports the original hash');
      assert(compressed.byteLength > 0, 'compress returns a stored byteLength');
      const bound = lecternAmdp.bind({ sha256: compressed.sha256, purpose: 'section', alt: 'pixel' });
      assert(bound.ok, 'bind accepts the hash returned by compress');
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll webmcp-media-upload assertions passed.');
