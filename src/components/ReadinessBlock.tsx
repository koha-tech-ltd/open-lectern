import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import type { LessonGap } from '@/types/lesson';

const GAP_CODES = new Set(['title', 'objectives', 'sections', 'thin_sections', 'quiz', 'quiz_shape']);

const CHECKS = [
  { id: 'title', label: 'editor.check.title', fail: ['title'], warn: [] },
  { id: 'objectives', label: 'editor.check.objectives', fail: ['objectives'], warn: [] },
  { id: 'materials', label: 'editor.check.materials', fail: ['sections'], warn: ['thin_sections'] },
  { id: 'tests', label: 'editor.check.tests', fail: ['quiz_shape'], warn: ['quiz'] },
] as const;

type CheckId = (typeof CHECKS)[number]['id'];
type CheckState = 'pass' | 'fail' | 'warn';

function gapMap(gaps: LessonGap[]): Map<string, LessonGap> {
  return new Map(gaps.map((gap) => [gap.code, gap]));
}

function checkStateFor(id: CheckId, byCode: Map<string, LessonGap>): CheckState {
  const spec = CHECKS.find((item) => item.id === id);
  if (!spec) return 'pass';
  if (spec.fail.some((code) => byCode.has(code))) return 'fail';
  if (spec.warn.some((code) => byCode.has(code))) return 'warn';
  return 'pass';
}

function statusLabel(id: CheckId, state: CheckState): MessageKey {
  if (state === 'pass') return 'editor.check.pass';
  if (id === 'tests' && state === 'warn') return 'editor.check.quizOptional';
  if (state === 'warn') return 'editor.check.warn';
  return 'editor.check.fail';
}

function CheckGlyph({ state }: { state: CheckState }) {
  if (state === 'pass') {
    return (
      <svg viewBox="0 0 20 20" className="studio-readiness-glyph" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="#3a5644" />
        <path
          d="M6.2 10.4 8.6 12.8 13.8 7.4"
          fill="none"
          stroke="#faf7f1"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === 'warn') {
    return (
      <svg viewBox="0 0 20 20" className="studio-readiness-glyph" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="#c4a35a" />
        <path d="M10 6.2v5" stroke="#1a1612" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="14" r="1.05" fill="#1a1612" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="studio-readiness-glyph" aria-hidden>
      <circle cx="10" cy="10" r="8.2" fill="none" stroke="#5c3a21" strokeWidth="1.6" />
    </svg>
  );
}

function ReadinessRing({ done, total, ready }: { done: number; total: number; ready: boolean }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = total === 0 ? 0 : done / total;
  const offset = circumference * (1 - progress);

  return (
    <div className="studio-readiness-ring" aria-hidden>
      <svg className="studio-readiness-ring-svg" viewBox="0 0 40 44">
        <circle className="studio-readiness-ring-track" cx="20" cy="22" r={radius} />
        <circle
          className="studio-readiness-ring-arc"
          cx="20"
          cy="22"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="studio-readiness-ring-count">
        {ready ? (
          <svg viewBox="0 0 20 20" width="18" height="18">
            <path
              d="M5 10.4 8.3 13.2 15 6.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="studio-readiness-ring-score">
            {done}/{total}
          </span>
        )}
      </span>
    </div>
  );
}

export function ReadinessBlock({ gaps }: { gaps: LessonGap[] }) {
  const { t } = useI18n();
  const byCode = gapMap(gaps);
  const checks = CHECKS.map((item) => {
    const state = checkStateFor(item.id, byCode);
    return { ...item, state };
  });
  const done = checks.filter((item) => item.state === 'pass').length;
  const ready = gaps.length === 0;

  return (
    <section
      className={`studio-readiness${ready ? ' is-ready' : ''}`}
      data-lectern-target="gaps"
      data-readiness={ready ? 'ready' : 'open'}
      aria-labelledby="studio-readiness-heading"
    >
      <div className="studio-readiness-rule" />
      <header className="studio-readiness-head">
        <ReadinessRing done={done} total={checks.length} ready={ready} />
        <div className="min-w-0">
          <p className="studio-readiness-eyebrow">{t('editor.checklist')}</p>
          <h3 id="studio-readiness-heading" className="studio-readiness-title">
            {ready ? t('editor.readyStatus') : t('editor.notReadyStatus')}
          </h3>
          <p className="studio-readiness-lede">
            {ready
              ? t('editor.ready')
              : t('editor.readyScore', { done, total: checks.length })}
          </p>
        </div>
      </header>

      <ol className="studio-readiness-tiles">
        {checks.map((item) => (
          <li key={item.id} className={`studio-readiness-tile is-${item.state}`}>
            <CheckGlyph state={item.state} />
            <div>
              <div className="studio-readiness-tile-label">{t(item.label)}</div>
              <div className="studio-readiness-tile-status">{t(statusLabel(item.id, item.state))}</div>
            </div>
          </li>
        ))}
      </ol>

      {ready ? null : (
        <ul className="studio-readiness-gaps">
          {gaps.map((gap) => (
            <li
              key={gap.code}
              className={`studio-readiness-gap is-${gap.severity}`}
            >
              <span className="studio-readiness-gap-tag">
                {t(gap.severity === 'blocker' ? 'gap.blocker' : 'gap.warning')}
              </span>
              <span>
                {GAP_CODES.has(gap.code)
                  ? t(`gap.${gap.code}` as MessageKey, { count: gap.count ?? 0 })
                  : gap.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
