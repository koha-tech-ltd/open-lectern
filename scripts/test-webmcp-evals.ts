/**
 * Deterministic WebMCP eval pipeline (Chrome evals, no LLM).
 *
 *   npm run test:evals
 *   npm run eval:schema   # rewrite evals/schema/*.json from the catalog
 *
 * Probabilistic LLM evals: npm run eval:local | eval:browser
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG_LOCALE_LIST, CHUNKED_MEDIA_HINT, catalogForMode, toEvalsSchema } from '../src/lib/webmcp-catalog.ts';
import {
  analyzeGaps,
  createDemoById,
  createDemoLesson,
  createEmptyLesson,
  decodeLessonFromShare,
  demoShareUrl,
  encodeLessonForShare,
  isPublishable,
  lessonLevelQuiz,
  parseDemoQueryParam,
  quizAnswerKeyStripes,
  quizItemsForSection,
  quizItemsInReadingOrder,
  studentShareUrl,
} from '../src/lib/lesson.ts';
import { SUPPORTED_LOCALES } from '../src/i18n/locales.ts';
import { en } from '../src/i18n/en.ts';
import { ALLOW_PDF_RESTORE_AUTHORING } from '../src/lib/product-flags.ts';
import { buildSectionReference, parseSectionIdFromReference, buildQuizReference, parseQuizIdFromReference } from '../src/lib/section-reference.ts';
import type { LessonDocument, QuizItem } from '../src/types/lesson.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'evals', 'schema');
const CASES_DIR = join(ROOT, 'evals', 'cases');
const HOOK_PATH = join(ROOT, 'src', 'hooks', 'useWebMcpTools.ts');
const WRITE_SCHEMA = process.argv.includes('--write-schema');

type ExpectedNode = {
  functionName?: string;
  arguments?: unknown;
  ordered?: ExpectedNode[];
  unordered?: ExpectedNode[];
};

type EvalCase = {
  name: string;
  messages?: Array<{ role?: string; content?: string }>;
  expectedCall?: ExpectedNode[];
};

let failed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed += 1;
    console.error(`  FAIL  ${message}`);
  } else {
    console.log(`  ok    ${message}`);
  }
}

function collectFunctionNames(nodes: ExpectedNode[] | undefined): string[] {
  if (!nodes) return [];
  const names: string[] = [];
  for (const node of nodes) {
    if (typeof node.functionName === 'string') names.push(node.functionName);
    if (Array.isArray(node.ordered)) names.push(...collectFunctionNames(node.ordered));
    if (Array.isArray(node.unordered)) names.push(...collectFunctionNames(node.unordered));
  }
  return names;
}

function schemaNames(mode: 'teacher' | 'student'): Set<string> {
  return new Set(toEvalsSchema(mode).map((tool) => tool.name));
}

function modeFromCaseName(name: string): 'teacher' | 'student' {
  if (name.includes('[student]')) return 'student';
  return 'teacher';
}

function writeSchemaFiles(): void {
  mkdirSync(SCHEMA_DIR, { recursive: true });
  for (const mode of ['teacher', 'student'] as const) {
    const body = `${JSON.stringify(toEvalsSchema(mode), null, 2)}\n`;
    writeFileSync(join(SCHEMA_DIR, `${mode}.json`), body, 'utf8');
  }
}

function readSchemaFile(mode: 'teacher' | 'student'): unknown {
  const path = join(SCHEMA_DIR, `${mode}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function hookToolNames(): string[] {
  const source = readFileSync(HOOK_PATH, 'utf8');
  const found = source.matchAll(/name:\s*'lectern_[a-z0-9_]+'/g);
  const names = [...found].map((match) => match[0].slice(match[0].indexOf("'") + 1, -1));
  return [...new Set(names)];
}

function loadCases(): Array<{ file: string; cases: EvalCase[] }> {
  return readdirSync(CASES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      cases: JSON.parse(readFileSync(join(CASES_DIR, file), 'utf8')) as EvalCase[],
    }));
}

function bump(lesson: LessonDocument, patch: Partial<LessonDocument>): LessonDocument {
  return {
    ...lesson,
    ...patch,
    version: lesson.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

console.log('WebMCP evals — deterministic pipeline\n');

if (WRITE_SCHEMA) {
  writeSchemaFiles();
  console.log(`Wrote ${join('evals', 'schema', 'teacher.json')} and student.json`);
}

console.log('Catalog and application state');
{
  const teacher = catalogForMode('teacher').map((tool) => tool.name);
  const student = catalogForMode('student').map((tool) => tool.name);
  assert(teacher.includes('lectern_compress_media'), 'teacher state exposes lectern_compress_media');
  assert(!student.includes('lectern_compress_media'), 'student state does not expose compress media');
  assert(!student.includes('lectern_publish_lesson'), 'student state does not expose publish');
  assert(student.includes('lectern_add_annotation'), 'student state exposes lectern_add_annotation');
  assert(!teacher.includes('lectern_add_annotation'), 'teacher state does not expose annotations');
  assert(teacher.includes('lectern_import_restore') && student.includes('lectern_import_restore'), 'both states expose import');
  assert(teacher.includes('lectern_list_library'), 'teacher state exposes lectern_list_library');
  assert(teacher.includes('lectern_switch_lesson'), 'teacher state exposes lectern_switch_lesson');
  assert(teacher.includes('lectern_new_lesson'), 'teacher state exposes lectern_new_lesson');
  assert(teacher.includes('lectern_save_lesson'), 'teacher state exposes lectern_save_lesson');
  assert(!student.includes('lectern_list_library'), 'student state does not expose library list');
  assert(!student.includes('lectern_switch_lesson'), 'student state does not expose switch lesson');
  assert(!student.includes('lectern_save_lesson'), 'student state does not expose save lesson');
  assert(teacher.includes('lectern_list_activity') && student.includes('lectern_list_activity'), 'both states expose list activity');
  assert(teacher.includes('lectern_get_activity') && student.includes('lectern_get_activity'), 'both states expose get activity');
  assert(teacher.includes('lectern_restore_activity'), 'teacher can restore activity');
  assert(teacher.includes('lectern_activity_head'), 'teacher can return to activity head');
  assert(!student.includes('lectern_restore_activity'), 'student cannot restore activity');
  assert(!student.includes('lectern_activity_head'), 'student cannot rewind to activity head');
  assert(
    CATALOG_LOCALE_LIST === SUPPORTED_LOCALES.join(', '),
    'catalog locale list matches SUPPORTED_LOCALES',
  );
  assert(
    CHUNKED_MEDIA_HINT.includes('%TEMP%') &&
      CHUNKED_MEDIA_HINT.includes('evaluate_script.args') &&
      CHUNKED_MEDIA_HINT.includes('temporary <input type="file">') &&
      CHUNKED_MEDIA_HINT.includes('leave it there') &&
      CHUNKED_MEDIA_HINT.includes('Lectern hides it visually') &&
      CHUNKED_MEDIA_HINT.includes('The page plane-puts on change') &&
      CHUNKED_MEDIA_HINT.includes('arrayBuffer()') &&
      CHUNKED_MEDIA_HINT.includes('__lecternAmdp.put') &&
      CHUNKED_MEDIA_HINT.includes('lectern_compress_media') &&
      CHUNKED_MEDIA_HINT.includes('Attach-media') &&
      CHUNKED_MEDIA_HINT.includes('Do not skip a later rank') &&
      CHUNKED_MEDIA_HINT.includes('STOP') &&
      CHUNKED_MEDIA_HINT.includes('lectern_begin_media_upload'),
    'AMDP intake hint ranks cas-hit → plane-put → merkle → json-chunk, tries each until present, then STOP',
  );
  assert(
    !en['landing.agentPrompt'].includes('%TEMP%') &&
      !en['landing.agentPrompt'].includes('#__lecternAmdpFile') &&
      !en['landing.agentPrompt'].includes('evaluate_script.args'),
    'copied teacher prompt stays light: AMDP intake lives on lectern_offer_media, not the paste',
  );
  assert(
    en['landing.agentPrompt'].includes('lectern_offer_media') &&
      en['landing.agentPrompt'].includes('navigator.modelContext') &&
      en['landing.agentPrompt'].includes('command-line flag') &&
      en['landing.agentPrompt'].includes('chrome://flags/#enable-webmcp-testing'),
    'copied teacher prompt bootstraps WebMCP and points at lectern_offer_media for rasters',
  );
  assert(
    en['landing.agentPromptStudent'].includes('navigator.modelContext') &&
      en['landing.agentPromptStudent'].includes('command-line flag') &&
      !en['landing.agentPromptStudent'].includes('#__lecternAmdpFile'),
    'copied student prompt bootstraps WebMCP and stays off AMDP intake',
  );

  const hookNames = hookToolNames().sort();
  const catalogNames = [...new Set(catalogForMode('teacher').concat(catalogForMode('student')).map((t) => t.name))].sort();
  assert(
    JSON.stringify(hookNames) === JSON.stringify(catalogNames),
    `hook names match catalog (${catalogNames.length} tools)`,
  );
  if (JSON.stringify(hookNames) !== JSON.stringify(catalogNames)) {
    console.error('    hook:', hookNames.join(', '));
    console.error('    catalog:', catalogNames.join(', '));
  }

  for (const tool of catalogForMode('teacher')) {
    assert(tool.description.trim().length > 24, `${tool.name} has a complete description`);
    assert(tool.inputSchema?.type === 'object', `${tool.name} has an object inputSchema`);
  }
}

console.log('\nSection reference (Copy reference)');
{
  const text = buildSectionReference({
    sectionId: 'sec_leaf01',
    title: 'Light reactions',
    kind: 'material',
    mode: 'student',
    lesson: 'Photosynthesis',
    instructions: 'Call lectern_get_section with this sectionId.',
  });
  assert(text.startsWith('LECTERN_SECTION\n'), 'copied payload starts with LECTERN_SECTION');
  assert(text.includes('sectionId: sec_leaf01'), 'payload includes sectionId');
  assert(text.includes('mode: student'), 'payload includes mode');
  assert(parseSectionIdFromReference(text) === 'sec_leaf01', 'parser reads sectionId from a pasted block');
  assert(
    parseSectionIdFromReference('Call lectern_get_section with this sectionId.') === null,
    'instruction line without a labeled id is not a false-positive id',
  );
  assert(
    parseSectionIdFromReference('Call lectern_get_section with sectionId="sec_leaf01"') === 'sec_leaf01',
    'parser reads sectionId from a tool-call sentence',
  );

  const quizText = buildQuizReference({
    quizId: 'quiz_q1',
    label: 'Q1',
    prompt: 'Which picture shows WebMCP?',
    mode: 'student',
    lesson: 'WebMCP explained',
    sectionId: 'sec_leaf01',
    instructions: 'Call lectern_get_lesson. Find this quizId.',
  });
  assert(quizText.startsWith('LECTERN_QUIZ\n'), 'quiz payload starts with LECTERN_QUIZ');
  assert(quizText.includes('quizId: quiz_q1'), 'quiz payload includes quizId');
  assert(quizText.includes('label: Q1'), 'quiz payload includes Q label');
  assert(parseQuizIdFromReference(quizText) === 'quiz_q1', 'parser reads quizId from a pasted block');
}

console.log('\nSchema files (evals-cli application state)');
{
  for (const mode of ['teacher', 'student'] as const) {
    const expected = `${JSON.stringify(toEvalsSchema(mode), null, 2)}\n`;
    let onDisk = '';
    try {
      onDisk = readFileSync(join(SCHEMA_DIR, `${mode}.json`), 'utf8');
    } catch {
      onDisk = '';
    }
    if (WRITE_SCHEMA) {
      assert(onDisk === expected, `${mode}.json written`);
    } else {
      assert(
        onDisk === expected,
        `${mode}.json matches catalog (run npm run eval:schema if you changed tools)`,
      );
    }
    const parsed = readSchemaFile(mode);
    assert(Array.isArray(parsed) && parsed.length === toEvalsSchema(mode).length, `${mode} schema is a tool array`);
  }
}

console.log('\nexpectedCall fixtures');
{
  const teacherNames = schemaNames('teacher');
  const studentNames = schemaNames('student');
  const bundles = loadCases();
  assert(bundles.length >= 4, 'isolation, open, journey, and mid-chain case files exist');
  let total = 0;
  for (const { file, cases } of bundles) {
    assert(Array.isArray(cases) && cases.length > 0, `${file} is a non-empty array`);
    for (const evalCase of cases) {
      total += 1;
      assert(typeof evalCase.name === 'string' && evalCase.name.length > 0, `${file} case has a name`);
      assert(Array.isArray(evalCase.messages) && evalCase.messages.length > 0, `${evalCase.name} has messages`);
      assert(Array.isArray(evalCase.expectedCall) && evalCase.expectedCall.length > 0, `${evalCase.name} has expectedCall`);
      const mode = modeFromCaseName(evalCase.name);
      const allowed = mode === 'student' ? studentNames : teacherNames;
      for (const fn of collectFunctionNames(evalCase.expectedCall)) {
        assert(allowed.has(fn), `${evalCase.name}: ${fn} is in the ${mode} schema`);
      }
    }
  }
  assert(total >= 10, `at least 10 eval cases (found ${total})`);
}

console.log('\nDeterministic tool logic (publish gate, gaps, file share)');
{
  assert(
    ALLOW_PDF_RESTORE_AUTHORING === true,
    'ALLOW_PDF_RESTORE_AUTHORING is true (PDF restore may reopen authoring)',
  );

  const publishTool = catalogForMode('teacher').find((t) => t.name === 'lectern_publish_lesson');
  assert(!!publishTool, 'publish tool is in the teacher catalog');
  assert(
    !/\bproduce a student share URL\b|\bmint a student share URL\b|\?l=/i.test(publishTool!.description) &&
      /Does not mint a student URL/i.test(publishTool!.description),
    'publish tool description does not mint a student share URL',
  );
  assert(
    /PDF/i.test(publishTool!.description) && /\.lectern/i.test(publishTool!.description),
    'publish tool points teachers at PDF and .lectern export',
  );

  const importTool = catalogForMode('teacher').find((t) => t.name === 'lectern_import_restore');
  assert(!!importTool, 'import restore tool is in the teacher catalog');
  assert(
    !/switch back with lectern_set_mode if you need to edit/i.test(importTool!.description),
    'import restore no longer tells agents to edit after PDF via set_mode',
  );
  assert(
    /\.lectern/i.test(importTool!.description) && /student/i.test(importTool!.description),
    'import restore documents .lectern → teacher and PDF → student',
  );
  const listLibraryTool = catalogForMode('teacher').find((t) => t.name === 'lectern_list_library');
  assert(!!listLibraryTool, 'list library tool is in the teacher catalog');
  assert(
    /Your materials/i.test(listLibraryTool!.description) && /lectern_switch_lesson/i.test(listLibraryTool!.description),
    'list library points agents at Your materials and switch',
  );
  const switchTool = catalogForMode('teacher').find((t) => t.name === 'lectern_switch_lesson');
  assert(!!switchTool, 'switch lesson tool is in the teacher catalog');
  assert(/Your materials/i.test(switchTool!.description), 'switch lesson mentions Your materials');
  const saveTool = catalogForMode('teacher').find((t) => t.name === 'lectern_save_lesson');
  assert(!!saveTool, 'save lesson tool is in the teacher catalog');
  assert(/\.lectern/i.test(saveTool!.description), 'save lesson downloads .lectern');
  const empty = createEmptyLesson();
  const emptyGaps = analyzeGaps(empty);
  assert(!isPublishable(empty), 'empty lesson is not publishable');
  assert(
    emptyGaps.some((gap) => gap.code === 'title' && gap.severity === 'blocker'),
    'empty lesson has a title blocker',
  );
  assert(
    emptyGaps.some((gap) => gap.code === 'objectives' && gap.severity === 'blocker'),
    'empty lesson has an objectives blocker',
  );
  assert(
    emptyGaps.some((gap) => gap.code === 'sections' && gap.severity === 'blocker'),
    'empty lesson has a sections blocker',
  );

  const headed = bump(empty, {
    meta: {
      title: 'Photosynthesis: factories of light',
      audience: 'Grade 8',
      subject: 'Biology',
      objectives: ['Name the inputs and outputs of photosynthesis.'],
    },
  });
  assert(!isPublishable(headed), 'title + objectives without materials still blocked');

  const withSection = bump(headed, {
    sections: [
      {
        id: 'sec_leaf01',
        kind: 'material',
        title: 'The leaf as a factory floor',
        body: 'Photosynthesis converts light energy into chemical energy stored in sugars. Stomata take in carbon dioxide.',
        order: 0,
      },
    ],
  });
  assert(isPublishable(withSection), 'title + objectives + a real section is publishable');
  assert(
    analyzeGaps(withSection).some((gap) => gap.code === 'quiz' && gap.severity === 'warning'),
    'missing quiz is a warning, not a blocker',
  );

  const nestedOnly = bump(withSection, {
    quiz: [
      {
        id: 'q_nested',
        prompt: 'What gas do stomata take in?',
        choices: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'],
        answerIndex: 1,
        explanation: 'Stomata admit CO2.',
        order: 0,
        sectionId: 'sec_leaf01',
      },
    ],
  });
  assert(
    !analyzeGaps(nestedOnly).some((gap) => gap.code === 'quiz'),
    'a nested section check satisfies the quiz warning',
  );
  assert(isPublishable(nestedOnly), 'nested check alone does not block publish');

  assert(quizItemsForSection(nestedOnly, 'sec_leaf01').length === 1, 'quizItemsForSection finds nested item');
  assert(lessonLevelQuiz(nestedOnly).length === 0, 'lessonLevelQuiz ignores valid nested item');

  const orphaned = bump(withSection, {
    quiz: [
      {
        id: 'q_orphan',
        prompt: 'Orphan check',
        choices: ['A', 'B'],
        answerIndex: 0,
        explanation: 'x',
        order: 0,
        sectionId: 'sec_missing',
      },
    ],
  });
  assert(lessonLevelQuiz(orphaned).length === 1, 'unknown sectionId is treated as lesson-level');
  assert(
    quizItemsForSection(orphaned, 'sec_leaf01').length === 0,
    'orphan is not attached to a real section',
  );
  assert(
    quizItemsInReadingOrder(orphaned).every((row) => row.placement === 'lesson'),
    'orphan appears only in the end-of-lesson reading slot',
  );

  const mixed = bump(withSection, {
    sections: [
      ...withSection.sections,
      {
        id: 'sec_rate',
        kind: 'example',
        title: 'Rate sketch',
        body: 'A saturating model for light response with enough prose to clear thin_sections.',
        order: 1,
      },
    ],
    quiz: [
      {
        id: 'q_n1',
        prompt: 'Nested 1',
        choices: ['A', 'B'],
        answerIndex: 0,
        explanation: 'e1',
        order: 0,
        sectionId: 'sec_leaf01',
      },
      {
        id: 'q_end',
        prompt: 'End quiz',
        choices: ['A', 'B'],
        answerIndex: 1,
        explanation: 'e2',
        order: 0,
      },
      {
        id: 'q_n2',
        prompt: 'Nested 2',
        choices: ['A', 'B'],
        answerIndex: 0,
        explanation: 'e3',
        order: 0,
        sectionId: 'sec_rate',
      },
    ],
  });
  const reading = quizItemsInReadingOrder(mixed);
  assert(
    reading.map((row) => row.item.id).join(',') === 'q_n1,q_n2,q_end',
    'reading order is nested by section then lesson-level',
  );
  const stripes = quizAnswerKeyStripes(mixed);
  assert(stripes.length === 3, 'answer key has one stripe per quiz item');
  assert(stripes[0]?.letter === 'A' && stripes[1]?.letter === 'A' && stripes[2]?.letter === 'B', 'stripe letters match answers');

  const withNestedShare = encodeLessonForShare(nestedOnly);
  const nestedRoundtrip = decodeLessonFromShare(withNestedShare);
  assert(
    nestedRoundtrip?.quiz[0]?.sectionId === 'sec_leaf01',
    'share token round-trips quiz sectionId',
  );

  const badQuiz: QuizItem = {
    id: 'q_bad',
    prompt: 'Broken item',
    choices: ['only-one'],
    answerIndex: 0,
    explanation: '',
    order: 0,
  };
  const malformed = bump(withSection, { quiz: [badQuiz] });
  assert(!isPublishable(malformed), 'quiz with a single choice is a blocker (mid-chain failure)');
  assert(
    analyzeGaps(malformed).some((gap) => gap.code === 'quiz_shape' && gap.severity === 'blocker'),
    'quiz_shape blocker is reported for the agent',
  );

  const demo = createDemoLesson();
  assert(isPublishable(demo), 'demo lesson is publishable');
  const token = encodeLessonForShare(demo);
  const roundtrip = decodeLessonFromShare(token);
  assert(roundtrip?.meta.title === demo.meta.title, 'share token round-trips the lesson title');

  assert(parseDemoQueryParam('webmcp') === 'webmcp', 'demo query param accepts webmcp');
  assert(parseDemoQueryParam('nope') === null, 'unknown demo query param is ignored');
  assert(
    demoShareUrl('webmcp') === 'https://lectern.click/studio?demo=webmcp&mode=student',
    'canonical WebMCP student URL is short and stable',
  );

  const webmcp = createDemoById('webmcp');
  assert(isPublishable(webmcp), 'WebMCP demo lesson is publishable');
  assert(
    demoShareUrl('webmcp') === 'https://lectern.click/studio?demo=webmcp&mode=student',
    'demo student URL stays a studio demo link (not a lesson token)',
  );
  assert(
    studentShareUrl(webmcp) === demoShareUrl('webmcp'),
    'legacy studentShareUrl helper still short-circuits demos (kept for old bookmarks)',
  );
  const visualQuizzes = webmcp.quiz.filter((item) => item.choiceMedia?.filter(Boolean).length === 4);
  assert(visualQuizzes.length >= 2, 'WebMCP demo has at least two 4-picture quiz items');
  const mediaSrcs: string[] = [];
  for (const section of webmcp.sections) {
    for (const media of section.media ?? []) mediaSrcs.push(media.src);
  }
  for (const item of webmcp.quiz) {
    for (const media of item.choiceMedia ?? []) {
      if (media?.src) mediaSrcs.push(media.src);
    }
  }
  assert(mediaSrcs.length >= 12, 'WebMCP demo ships section figures and quiz cards');
  for (const src of mediaSrcs) {
    assert(src.startsWith('/media/demo/'), `WebMCP media stays on public demo paths: ${src}`);
    const file = join(ROOT, 'public', src.replace(/^\//, ''));
    assert(existsSync(file), `WebMCP demo media exists on disk: ${src}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}

console.log('\nAll deterministic WebMCP evals passed.');
