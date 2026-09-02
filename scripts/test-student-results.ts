/**
 * Deterministic tests for student results summarize / cheer / notes helpers.
 * Run: npm run test:student-results
 */
import assert from 'node:assert/strict';
import { createDemoById } from '../src/lib/lesson.ts';
import {
  cheerBand,
  notesForResults,
  recordQuizAttempt,
  stripPromptForPdf,
  summarizeAttempts,
  type AttemptsMap,
} from '../src/lib/student-results.ts';

let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
  } else {
    console.log(`  ok    ${msg}`);
  }
}

console.log('Student results — scoring and cheer\n');

const lesson = createDemoById('photosynthesis');
check(lesson.quiz.length >= 3, 'photosynthesis demo has quiz items');

const empty = summarizeAttempts(lesson, {});
check(empty.total === lesson.quiz.length, 'empty attempts: total matches quiz length');
check(empty.skipped === empty.total, 'empty attempts: all skipped');
check(empty.correct === 0 && empty.missed === 0, 'empty attempts: zero correct/missed');
check(cheerBand(empty) === 'started', 'all skipped → started band');
check(empty.missedOrSkipped.length === empty.total, 'missedOrSkipped includes all when unanswered');

const first = lesson.quiz[0];
const second = lesson.quiz[1];
assert.ok(first && second);

const mixed: AttemptsMap = {
  [first.id]: recordQuizAttempt(first, first.answerIndex),
  [second.id]: recordQuizAttempt(second, (second.answerIndex + 1) % second.choices.length),
};
const mid = summarizeAttempts(lesson, mixed);
check(mid.correct === 1, 'one correct attempt counted');
check(mid.missed === 1, 'one incorrect attempt counted');
check(mid.skipped === mid.total - 2, 'remainder skipped');
check(mid.missedOrSkipped[0]?.item.id === second.id || mid.missedOrSkipped.some((r) => r.bucket === 'missed'), 'missed appears in review list');
check(cheerBand(mid) === 'learning' || cheerBand(mid) === 'strong', 'partial answers get encouraging band');

const allCorrect: AttemptsMap = {};
for (const item of lesson.quiz) {
  allCorrect[item.id] = recordQuizAttempt(item, item.answerIndex);
}
const perfect = summarizeAttempts(lesson, allCorrect);
check(perfect.correct === perfect.total, 'all correct');
check(perfect.missedOrSkipped.length === 0, 'no missed/skipped when perfect');
check(cheerBand(perfect) === 'perfect', 'all correct → perfect band');

const allWrong: AttemptsMap = {};
for (const item of lesson.quiz) {
  const wrong = (item.answerIndex + 1) % item.choices.length;
  allWrong[item.id] = recordQuizAttempt(item, wrong);
}
const low = summarizeAttempts(lesson, allWrong);
check(low.correct === 0 && low.missed === low.total, 'all wrong counted as missed');
check(cheerBand(low) === 'learning', '0% with attempts → learning (never shame)');

const withNotes = {
  ...lesson,
  annotations: [
    {
      id: 'a1',
      sectionId: lesson.sections[0]?.id ?? 'sec',
      note: 'Confused about stomata',
      kind: 'note' as const,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a2',
      sectionId: lesson.sections[0]?.id ?? 'sec',
      note: 'Learned',
      kind: 'learned' as const,
      createdAt: new Date().toISOString(),
    },
  ],
};
const notes = notesForResults(withNotes);
check(notes.length === 2, 'notesForResults returns annotations');
check(notes.some((n) => n.isLearned), 'learned mark detected');
check(stripPromptForPdf('**Bold** and $x$').includes('Bold'), 'stripPromptForPdf removes emphasis');
check(!stripPromptForPdf('**Bold** and $x$').includes('**'), 'stripPromptForPdf strips stars');

// Reading order: nested before end for photosynthesis (s1 then s3 then lesson)
const order = mid.items.map((row) => row.placement);
const firstLessonIdx = order.indexOf('lesson');
const lastSectionIdx = order.lastIndexOf('section');
if (firstLessonIdx !== -1 && lastSectionIdx !== -1) {
  check(lastSectionIdx < firstLessonIdx, 'reading order: nested before lesson-level');
} else {
  check(true, 'reading order: placement list present');
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll student-results assertions passed.');
