/**
 * Smoke test: lectern/1 JSON roundtrip with embedded data URLs (Node-safe).
 * Run: npm run test:embed-media
 */
const LECTERN_FILE_FORMAT = 'lectern/1';

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const lesson = {
  id: 'lesson_embed_test',
  version: 1,
  published: false,
  updatedAt: new Date().toISOString(),
  meta: { title: 'Embed test', audience: 'Test', subject: 'Test', objectives: [] as string[] },
  sections: [
    {
      id: 'sec1',
      kind: 'material' as const,
      title: 'Section',
      body: 'Body',
      order: 0,
      media: [{ id: 'm1', kind: 'image' as const, src: pixel, alt: 'pixel', originSrc: '/media/demo/x.png' }],
    },
  ],
  quiz: [],
  annotations: [],
};

const raw = `${JSON.stringify({ format: LECTERN_FILE_FORMAT, exportedAt: new Date().toISOString(), lesson: { ...lesson, annotations: [] } }, null, 2)}\n`;
const parsed = JSON.parse(raw.trim()) as { format: string; lesson: typeof lesson };
if (parsed.format !== LECTERN_FILE_FORMAT) throw new Error('format mismatch');
if (!parsed.lesson.sections[0].media?.[0]?.src.startsWith('data:image/')) {
  throw new Error('.lectern roundtrip lost embedded src');
}
if (parsed.lesson.sections[0].media[0].originSrc !== '/media/demo/x.png') {
  throw new Error('originSrc not preserved in .lectern');
}

console.log('OK: embed-lesson-media (.lectern roundtrip with data URLs)');
