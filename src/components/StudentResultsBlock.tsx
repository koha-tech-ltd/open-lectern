import { useI18n } from '@/i18n/I18nProvider';
import type { CheerBand, StudentResultsSummary } from '@/lib/student-results';

function ResultsRing({
  correct,
  total,
  perfect,
}: {
  correct: number;
  total: number;
  perfect: boolean;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = total === 0 ? 0 : correct / total;
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
        {perfect && total > 0 ? (
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
            {total === 0 ? '—' : `${correct}/${total}`}
          </span>
        )}
      </span>
    </div>
  );
}

function TileGlyph({ tone }: { tone: 'pass' | 'warn' | 'soft' }) {
  if (tone === 'pass') {
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
  if (tone === 'warn') {
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

export function StudentResultsBlock({
  summary,
  band,
  notesCount,
  studentName,
  onStudentNameChange,
  exporting,
  onExport,
}: {
  summary: StudentResultsSummary;
  band: CheerBand;
  notesCount: number;
  studentName: string;
  onStudentNameChange: (value: string) => void;
  exporting: boolean;
  onExport: () => void;
}) {
  const { t } = useI18n();
  const perfect = band === 'perfect';
  const shareReady = summary.total > 0 || notesCount > 0;

  const tiles: Array<{
    id: string;
    label: string;
    status: string;
    tone: 'pass' | 'warn' | 'soft';
  }> = [
    {
      id: 'correct',
      label: t('reader.resultsTile.correct'),
      status:
        summary.total === 0
          ? t('reader.resultsTile.open')
          : t('reader.resultsTile.count', { n: summary.correct }),
      tone: summary.correct > 0 || perfect ? 'pass' : 'soft',
    },
    {
      id: 'missed',
      label: t('reader.resultsTile.missed'),
      status:
        summary.missed === 0
          ? t('reader.resultsTile.clear')
          : t('reader.resultsTile.count', { n: summary.missed }),
      tone: summary.missed === 0 ? 'pass' : 'warn',
    },
    {
      id: 'skipped',
      label: t('reader.resultsTile.skipped'),
      status:
        summary.skipped === 0
          ? t('reader.resultsTile.clear')
          : t('reader.resultsTile.count', { n: summary.skipped }),
      tone: summary.skipped === 0 ? 'pass' : 'soft',
    },
    {
      id: 'notes',
      label: t('reader.resultsTile.notes'),
      status:
        notesCount === 0
          ? t('reader.resultsTile.optional')
          : t('reader.resultsTile.count', { n: notesCount }),
      tone: notesCount > 0 ? 'pass' : 'soft',
    },
  ];

  return (
    <section
      className={`studio-results studio-readiness${perfect ? ' is-ready' : ''}${shareReady ? ' is-shareable' : ''}`}
      data-lectern-target="results"
      data-results-band={band}
      aria-labelledby="studio-results-heading"
    >
      <div className="studio-readiness-rule" />
      <header className="studio-readiness-head">
        <ResultsRing correct={summary.correct} total={summary.total} perfect={perfect} />
        <div className="min-w-0">
          <p className="studio-readiness-eyebrow">{t('reader.resultsEyebrow')}</p>
          <h3 id="studio-results-heading" className="studio-readiness-title">
            {t('reader.resultsReadyStatus')}
          </h3>
          <p className="studio-readiness-lede">
            {summary.total === 0
              ? t('reader.resultsLede')
              : t('reader.resultsScore', {
                  correct: summary.correct,
                  total: summary.total,
                })}
          </p>
        </div>
      </header>

      <ol className="studio-readiness-tiles">
        {tiles.map((tile) => (
          <li key={tile.id} className={`studio-readiness-tile is-${tile.tone === 'soft' ? 'fail' : tile.tone}`}>
            <TileGlyph tone={tile.tone} />
            <div>
              <div className="studio-readiness-tile-label">{tile.label}</div>
              <div className="studio-readiness-tile-status">{tile.status}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="studio-results-actions">
        <label className="studio-results-name">
          <span className="studio-results-name-label">{t('reader.resultsNameLabel')}</span>
          <input
            type="text"
            className="studio-results-name-input"
            value={studentName}
            onChange={(e) => onStudentNameChange(e.target.value)}
            placeholder={t('reader.resultsNamePlaceholder')}
            autoComplete="name"
          />
        </label>
        <button
          type="button"
          className="studio-results-export"
          disabled={exporting}
          onClick={onExport}
        >
          {exporting ? t('reader.resultsExporting') : t('reader.resultsExport')}
        </button>
        <p className="studio-results-hint">{t('reader.resultsHint')}</p>
      </div>
    </section>
  );
}
