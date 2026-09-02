import { useState, type ReactNode } from 'react';
import type { LessonStore } from '@/hooks/useLessonStore';
import { useI18n } from '@/i18n/I18nProvider';

export function SectionMarginMark({
  sectionId,
  store,
  trailing,
}: {
  sectionId: string;
  store: LessonStore;
  trailing?: ReactNode;
}) {
  const { t } = useI18n();
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [flash, setFlash] = useState<'learned' | 'note' | null>(null);

  const markLearned = () => {
    const result = store.addAnnotation(sectionId, 'Learned', 'learned');
    if (result.ok) {
      setFlash('learned');
      window.setTimeout(() => setFlash(null), 1800);
    }
  };

  const saveNote = () => {
    const result = store.addAnnotation(sectionId, draft, 'note');
    if (result.ok) {
      setDraft('');
      setNoteOpen(false);
      setFlash('note');
      window.setTimeout(() => setFlash(null), 1800);
    }
  };

  return (
    <div className="manuscript-section-footer" aria-label={t('margin.label')}>
      <div className="margin-mark-actions">
        <button type="button" className="margin-mark-btn margin-mark-btn-learned" onClick={markLearned}>
          {t('margin.learned')}
        </button>
        <button
          type="button"
          className={`margin-mark-btn margin-mark-btn-note ${noteOpen ? 'is-active' : ''}`}
          onClick={() => setNoteOpen((open) => !open)}
          aria-expanded={noteOpen}
        >
          {t('margin.makeNote')}
        </button>
        {trailing ? <div className="margin-mark-trailing">{trailing}</div> : null}
      </div>

      {flash === 'learned' ? (
        <p className="margin-mark-flash">{t('margin.markedLearned')}</p>
      ) : flash === 'note' ? (
        <p className="margin-mark-flash">{t('margin.noteSaved')}</p>
      ) : null}

      {noteOpen ? (
        <div className="margin-mark-note-panel">
          <textarea
            className="manuscript-source min-h-20"
            placeholder={t('margin.placeholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="margin-mark-note-actions">
            <button
              type="button"
              className="margin-mark-btn margin-mark-btn-learned"
              disabled={!draft.trim()}
              onClick={saveNote}
            >
              {t('margin.saveNote')}
            </button>
            <button
              type="button"
              className="margin-mark-btn margin-mark-btn-note"
              onClick={() => {
                setNoteOpen(false);
                setDraft('');
              }}
            >
              {t('margin.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
