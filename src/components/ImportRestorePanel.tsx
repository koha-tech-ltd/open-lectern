import { useEffect, useRef, useState } from 'react';
import { downloadLecternFile } from '@/lib/export-lectern';
import { addRestoreSheet, decodeRestoreInput, RESTORE_MAGIC } from '@/lib/restore-codec';
import { trackPdfContinuation } from '@/lib/pdf-continuation';
import { conversionLecternExported } from '@/lib/product-events';
import {
  DEMO_LESSON_IDS,
  isDemoLessonId,
  isSparseLesson,
  LECTERN_DEMO_IDS,
  type LecternDemoId,
  type LibraryListItem,
} from '@/lib/lesson';
import { htmlLangFor } from '@/i18n/locales';
import { LessonStartBanner } from '@/components/LessonStartBanner';
import type { LessonDocument } from '@/types/lesson';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): (new (opts: { formats: string[] }) => BarcodeDetectorLike) | null {
  const w = window as Window & {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  };
  return w.BarcodeDetector ?? null;
}

function FileCtaIcon({ kind }: { kind: 'pdf' | 'lectern' }) {
  if (kind === 'pdf') {
    return (
      <svg className="lesson-io-cta-glyph" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M7 3.5h6.2L19 9.2V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5H7Zm6 .8v4.4h4.5L13 4.3ZM8.4 13.1h7.2v1.15H8.4V13.1Zm0 2.45h7.2v1.15H8.4V15.55Zm0 2.45h4.8v1.15H8.4V18Z"
        />
      </svg>
    );
  }
  return (
    <svg className="lesson-io-cta-glyph" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M6.4 4.2h7.3L19 9.4V19.4A1.6 1.6 0 0 1 17.4 21H6.6A1.6 1.6 0 0 1 5 19.4V5.8A1.6 1.6 0 0 1 6.6 4.2h-.2Zm7.1.9v4.2h4.3L13.5 5.1ZM8 13.05c1.55 0 2.55.7 2.55 1.85 0 .86-.5 1.42-1.28 1.64L11.7 19h-1.32l-2.2-2.28H8.95V19H8V13.05Zm.95 1.02v1.62h.38c.72 0 1.18-.32 1.18-.84 0-.5-.44-.78-1.14-.78H8.95Z"
      />
    </svg>
  );
}

const DEMO_TITLE_KEYS: Record<LecternDemoId, MessageKey> = {
  photosynthesis: 'import.demoPhotosynthesis',
  webmcp: 'import.demoWebmcp',
  cossacks: 'import.demoCossacks',
};

export function ImportRestorePanel({
  mode,
  lesson,
  onImport,
  highlightPdfUpload = false,
  layout = 'panel',
  libraryItems = [],
  onLoadDemo,
  onOpenLibraryLesson,
  onNewLesson,
  onRemoveLibraryLesson,
}: {
  mode: 'teacher' | 'student';
  lesson?: LessonDocument;
  onImport: (raw: string) => { ok: true } | { ok: false; error: string; progress?: { have: number; need: number } };
  highlightPdfUpload?: boolean;
  layout?: 'panel' | 'banner' | 'wide';
  libraryItems?: LibraryListItem[];
  onLoadDemo?: (id: LecternDemoId) => void;
  onOpenLibraryLesson?: (id: string) => void;
  onNewLesson?: () => void;
  onRemoveLibraryLesson?: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [blankConfirm, setBlankConfirm] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const collectedRef = useRef('');
  const Detector = getBarcodeDetector();
  const isTeacher = mode === 'teacher';

  const stopScan = () => {
    setScanning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopScan(), []);

  const tryImport = (raw: string) => {
    const result = onImport(raw);
    if (result.ok) {
      if (highlightPdfUpload) trackPdfContinuation('restored');
      setError(null);
      setMessage(isTeacher ? t('import.loadedTeacher') : t('import.loadedStudent'));
      stopScan();
      collectedRef.current = '';
      return;
    }
    setMessage(null);
    if (result.progress) {
      setError(t('import.progress', { error: result.error, have: result.progress.have, need: result.progress.need }));
    } else {
      setError(result.error);
    }
  };

  const ingestLine = (line: string) => {
    if (!line.includes(RESTORE_MAGIC) && !line.startsWith('{')) return;
    collectedRef.current = addRestoreSheet(collectedRef.current, line);
    const decoded = decodeRestoreInput(collectedRef.current);
    if (decoded.ok) {
      tryImport(collectedRef.current);
    } else if (decoded.progress) {
      setError(t('import.collectingQr', { have: decoded.progress.have, need: decoded.progress.need }));
      setMessage(null);
    }
  };

  const startScan = async () => {
    if (!Detector || !videoRef.current) {
      setError(t('import.cameraNeed'));
      return;
    }
    setError(null);
    setMessage(null);
    collectedRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      const detector = new Detector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          for (const code of codes) {
            if (code.rawValue) ingestLine(code.rawValue);
          }
        } catch {
          /* keep scanning */
        }
        if (streamRef.current) {
          requestAnimationFrame(() => {
            void tick();
          });
        }
      };
      void tick();
    } catch {
      setError(t('import.cameraDenied'));
      stopScan();
    }
  };

  const onLecternFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const raw = await file.text();
      tryImport(raw);
    } finally {
      setBusy(false);
    }
  };

  const onPdfFile = async (file: File) => {
    if (highlightPdfUpload) trackPdfContinuation('pdf_uploaded');
    setBusy(true);
    setError(null);
    setMessage(t('import.readingPdf'));
    try {
      const { extractRestoreFromPdfFile } = await import('@/lib/import-pdf');
      const extracted = await extractRestoreFromPdfFile(file);
      if (!extracted.ok) {
        setMessage(null);
        if (extracted.progress) {
          setError(t('import.progress', { error: extracted.error, have: extracted.progress.have, need: extracted.progress.need }));
        } else {
          setError(extracted.error);
        }
        return;
      }
      setMessage(t('import.foundRestore', { method: extracted.method }));
      tryImport(extracted.raw);
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : t('import.pdfFail'));
    } finally {
      setBusy(false);
    }
  };

  const onSaveLectern = () => {
    if (!lesson) return;
    setBusy(true);
    setError(null);
    void downloadLecternFile(lesson)
      .then(({ warnings }) => {
        conversionLecternExported({ source: 'import_panel' });
        setMessage(t('import.savedFile', { name: lesson.meta.title || 'lesson' }));
        if (warnings.length > 0) {
          setError(warnings.slice(0, 3).join(' '));
        }
      })
      .catch((err) => {
        setMessage(null);
        setError(err instanceof Error ? err.message : t('import.pdfFail'));
      })
      .finally(() => setBusy(false));
  };

  const formatWhen = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(htmlLangFor(locale), { dateStyle: 'medium', timeStyle: 'short' });
  };

  const yours = libraryItems.filter(
    (item) => !isDemoLessonId(item.id) && (!item.sparse || item.id === lesson?.id),
  );
  const pendingRemove = yours.find((item) => item.id === removeId);
  const currentIsSparse = lesson ? isSparseLesson(lesson) : true;

  const requestNewBlank = () => {
    if (!onNewLesson) return;
    if (currentIsSparse) {
      onNewLesson();
      return;
    }
    setBlankConfirm(true);
    setRemoveId(null);
  };

  const pdfContinueNotice = highlightPdfUpload ? (
    <div className="mb-4 rounded-lg border-2 border-brass bg-cream px-3 py-3 text-sm text-forest" data-lectern-target="pdf-continuation">
      <strong>{t('import.pdfContinue')}</strong>
    </div>
  ) : null;

  const loadActions = (
    <div className={`lesson-io-actions${layout === 'banner' ? ' lesson-start-banner-actions' : ''}`}>
      <label
        className={`lesson-io-btn cursor-pointer ${
          layout === 'banner' || highlightPdfUpload ? 'lesson-io-btn-primary' : 'lesson-io-btn-secondary'
        } ${highlightPdfUpload ? 'ring-2 ring-brass ring-offset-2 ring-offset-ivory' : ''}`}
        data-lectern-target={highlightPdfUpload ? 'pdf-upload' : undefined}
        title={t('import.pdfHint')}
      >
        {busy ? t('import.loading') : t('import.uploadPdf')}
        <input
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPdfFile(file);
            e.target.value = '';
          }}
        />
      </label>
      <label className="lesson-io-btn lesson-io-btn-secondary cursor-pointer">
        {t('import.uploadLectern')}
        <input
          type="file"
          accept=".lectern,.lectern.txt,.txt,application/json,text/plain"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onLecternFile(file);
            e.target.value = '';
          }}
        />
      </label>
      {Detector ? (
        <details className="lesson-io-legacy">
          <summary className="lesson-io-hint cursor-pointer">{t('import.legacySummary')}</summary>
          <button
            type="button"
            className="lesson-io-btn lesson-io-btn-secondary mt-2 w-full"
            disabled={busy}
            onClick={() => (scanning ? stopScan() : void startScan())}
          >
            {scanning ? t('import.stopCamera') : t('import.scanQr')}
          </button>
        </details>
      ) : null}
    </div>
  );

  const loadFeedback = (
    <>
      {scanning ? (
        <video ref={videoRef} className="lesson-io-camera" muted playsInline />
      ) : (
        <video ref={videoRef} className="hidden" muted playsInline />
      )}
      {error ? <p className="lesson-io-msg lesson-io-msg-error">{error}</p> : null}
      {message ? <p className="lesson-io-msg lesson-io-msg-ok">{message}</p> : null}
    </>
  );

  if (layout === 'banner') {
    return (
      <LessonStartBanner
        mediaId="student"
        eyebrow={t('reader.loadEyebrow')}
        title={t('reader.loadTitle')}
        body={t('reader.loadBody')}
        articleTarget="import"
        copyTarget="materials"
      >
        {pdfContinueNotice}
        {loadActions}
        <p className="lesson-io-hint">{t('import.pdfHint')}</p>
        {loadFeedback}
      </LessonStartBanner>
    );
  }

  const demosSection =
    isTeacher && onLoadDemo && onNewLesson ? (
      <section className="lesson-io-section is-demos" aria-label={t('import.demosHeading')}>
        <h4 className="lesson-io-kicker">{t('import.demosHeading')}</h4>
        <div className="lesson-io-list">
          {LECTERN_DEMO_IDS.map((id) => {
            const current = lesson?.id === DEMO_LESSON_IDS[id];
            return (
              <div
                key={id}
                className={`lesson-io-row is-demo ${current ? 'is-current' : ''}`}
              >
                <button
                  type="button"
                  className="lesson-io-history-open"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onLoadDemo(id)}
                >
                  <span className="lesson-io-history-title">{t(DEMO_TITLE_KEYS[id])}</span>
                  <span className="lesson-io-history-meta">
                    {current ? t('import.openNow') : t('import.demoMeta')}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>
    ) : null;

  const yoursSection =
    isTeacher && onLoadDemo && onNewLesson ? (
      <section className="lesson-io-section is-yours" aria-label={t('import.yoursHeading')}>
        <h4 className="lesson-io-kicker">{t('import.yoursHeading')}</h4>
        <div className="lesson-io-list">
          {yours.length === 0 ? (
            <p className="lesson-io-empty">{t('import.yoursEmpty')}</p>
          ) : (
            yours.map((item) => {
              const current = item.id === lesson?.id;
              return (
                <div
                  key={item.id}
                  className={`lesson-io-row ${current ? 'is-current' : ''}`}
                >
                  <button
                    type="button"
                    className="lesson-io-history-open"
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onOpenLibraryLesson?.(item.id)}
                  >
                    <span className="lesson-io-history-title">{item.title}</span>
                    <span className="lesson-io-history-meta">
                      {current
                        ? t('import.openNow')
                        : t('import.updated', { when: formatWhen(item.updatedAt) })}
                    </span>
                  </button>
                  {onRemoveLibraryLesson ? (
                    <button
                      type="button"
                      className="lesson-io-history-remove"
                      onClick={() => {
                        setBlankConfirm(false);
                        setRemoveId(item.id);
                      }}
                    >
                      {t('import.removeLesson')}
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <button type="button" className="lesson-io-add" onClick={requestNewBlank}>
          {t('editor.newBlank')}
        </button>
        {blankConfirm ? (
          <div className="lesson-io-confirm">
            <p>{t('import.newBlankConfirm')}</p>
            <div className="lesson-io-actions">
              <button
                type="button"
                className="lesson-io-btn lesson-io-btn-primary"
                onClick={() => {
                  setBlankConfirm(false);
                  onNewLesson();
                }}
              >
                {t('import.newBlankStart')}
              </button>
              <button
                type="button"
                className="lesson-io-btn lesson-io-btn-secondary"
                onClick={() => setBlankConfirm(false)}
              >
                {t('import.newBlankCancel')}
              </button>
            </div>
          </div>
        ) : null}
        {pendingRemove ? (
          <div className="lesson-io-confirm">
            <p>{t('import.removeConfirm', { title: pendingRemove.title })}</p>
            <div className="lesson-io-actions">
              <button
                type="button"
                className="lesson-io-btn lesson-io-btn-primary"
                onClick={() => {
                  onRemoveLibraryLesson?.(pendingRemove.id);
                  setRemoveId(null);
                }}
              >
                {t('import.removeLesson')}
              </button>
              <button
                type="button"
                className="lesson-io-btn lesson-io-btn-secondary"
                onClick={() => setRemoveId(null)}
              >
                {t('import.removeCancel')}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    ) : null;

  const filesSection = (
    <section className="lesson-io-files" aria-label={t('import.files')}>
      <h4 className="lesson-io-kicker">{t('import.files')}</h4>
      {isTeacher && lesson && !currentIsSparse ? (
        <button
          type="button"
          className="lesson-io-btn lesson-io-btn-secondary lesson-io-btn-block"
          disabled={busy}
          title={t('import.saveHint')}
          onClick={onSaveLectern}
        >
          {t('import.downloadLectern')}
        </button>
      ) : null}
      <div className="lesson-io-cta-row">
        <label
          className={`lesson-io-cta is-pdf cursor-pointer ${highlightPdfUpload ? 'is-pulse' : ''}`}
          data-lectern-target={highlightPdfUpload ? 'pdf-upload' : undefined}
        >
          <span className="lesson-io-cta-icon">
            <FileCtaIcon kind="pdf" />
          </span>
          <span className="lesson-io-cta-copy">
            <span className="lesson-io-cta-title">{busy ? t('import.loading') : t('import.uploadPdf')}</span>
            <span className="lesson-io-cta-hint">{t('import.pdfHint')}</span>
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPdfFile(file);
              e.target.value = '';
            }}
          />
        </label>
        <label className="lesson-io-cta is-lectern cursor-pointer">
          <span className="lesson-io-cta-icon">
            <FileCtaIcon kind="lectern" />
          </span>
          <span className="lesson-io-cta-copy">
            <span className="lesson-io-cta-title">{t('import.uploadLectern')}</span>
            <span className="lesson-io-cta-hint">{t('import.uploadLecternHint')}</span>
          </span>
          <input
            type="file"
            accept=".lectern,.lectern.txt,.txt,application/json,text/plain"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onLecternFile(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {Detector ? (
        <details className="lesson-io-legacy">
          <summary className="lesson-io-hint cursor-pointer">{t('import.legacySummary')}</summary>
          <button
            type="button"
            className="lesson-io-btn lesson-io-btn-secondary mt-2 w-full"
            disabled={busy}
            onClick={() => (scanning ? stopScan() : void startScan())}
          >
            {scanning ? t('import.stopCamera') : t('import.scanQr')}
          </button>
        </details>
      ) : null}
    </section>
  );

  return (
    <div
      className={`lesson-io-panel${layout === 'wide' ? ' is-wide' : ''}`}
      data-lectern-target="import"
    >
      <header className="lesson-io-head">
        <h3 className="font-display text-xl text-forest">{t('import.title')}</h3>
        <p className="lesson-io-lede">
          {isTeacher ? t('import.ledeTeacher') : t('import.ledeStudent')}
        </p>
      </header>
      {pdfContinueNotice}

      {layout === 'wide' ? (
        <div className="lesson-io-wide-grid">
          {demosSection}
          {yoursSection}
          {filesSection}
        </div>
      ) : (
        <>
          {demosSection}
          {yoursSection}
          {filesSection}
        </>
      )}

      {loadFeedback}
    </div>
  );
}
