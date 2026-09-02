/**
 * Optional probabilistic evals via Chrome's webmcp-evals CLI.
 * Requires a provider key (GOOGLE_AI, OPENAI_API_KEY, or ANTHROPIC_API_KEY).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv.includes('--browser') ? 'browser' : 'local';
const url = process.env.LECTERN_EVAL_URL || 'https://lectern.click/studio';

const runs: Array<{ schema?: string; evals: string; label: string }> = [
  { schema: 'evals/schema/teacher.json', evals: 'evals/cases/isolation-teacher.json', label: 'teacher isolation (direct)' },
  { schema: 'evals/schema/teacher.json', evals: 'evals/cases/isolation-teacher-open.json', label: 'teacher isolation (open-ended)' },
  { schema: 'evals/schema/student.json', evals: 'evals/cases/isolation-student.json', label: 'student isolation' },
  { schema: 'evals/schema/teacher.json', evals: 'evals/cases/journeys-teacher.json', label: 'teacher journey' },
  { schema: 'evals/schema/student.json', evals: 'evals/cases/journeys-student.json', label: 'student journey' },
  { schema: 'evals/schema/teacher.json', evals: 'evals/cases/mid-chain.json', label: 'mid-chain' },
];

function run(args: string[], label: string): void {
  console.log(`\n→ ${label}\n  npx webmcp-evals ${args.join(' ')}\n`);
  const result = spawnSync('npx', ['--yes', 'webmcp-evals', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.GOOGLE_AI && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  console.error(
    'Set GOOGLE_AI, OPENAI_API_KEY, or ANTHROPIC_API_KEY to run probabilistic WebMCP evals.\n' +
      'Deterministic pipeline: npm run test:evals',
  );
  process.exit(1);
}

for (const batch of runs) {
  if (mode === 'browser') {
    run(['browser', '-u', url, '-e', batch.evals], `${batch.label} @ ${url}`);
  } else {
    run(
      ['local', '-t', batch.schema as string, '-e', batch.evals],
      batch.label,
    );
  }
}

console.log('\nProbabilistic WebMCP evals finished.');
