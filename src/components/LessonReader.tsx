import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { CopySectionReferenceButton } from '@/components/CopySectionReferenceButton';
import { ImportRestorePanel } from '@/components/ImportRestorePanel';
import { LessonProse } from '@/components/LessonProse';
import { ReadAloudButton } from '@/components/ReadAloudButton';
import { SectionMarginMark } from '@/components/SectionMarginMark';
import {
  ManuscriptObjectives,
  ManuscriptPage,
  ManuscriptQuizFrame,
  ManuscriptSection,
  ManuscriptSectionCheck,
  ManuscriptTitle,
} from '@/components/Manuscript';
import { MediaLightbox, SectionMediaGallery } from '@/components/SectionMediaGallery';
import { StudentResultsBlock } from '@/components/StudentResultsBlock';
import { StudioRailScroll } from '@/components/StudioRailScroll';
import type { LessonStore } from '@/hooks/useLessonStore';
import { useI18n } from '@/i18n/I18nProvider';
import { useSpeechRead } from '@/hooks/useSpeechRead';
import type { StudentResultsPdfCopy } from '@/lib/export-results-pdf';
import { isSparseLesson, lessonLevelQuiz, quizItemsForSection } from '@/lib/lesson';
import {
  cheerBand,
  recordQuizAttempt,
  summarizeAttempts,
  type AttemptsMap,
  type QuizAttempt,
} from '@/lib/student-results';
import { isGeneratedIllustration } from '@/lib/visual-learning';
import { conversionResultsExported } from '@/lib/product-events';
import type { LessonSection, QuizItem, SectionMedia } from '@/types/lesson';

export function LessonReader({
  store,
  copilotSlot,
  fromPdf = false,
}: {
  store: LessonStore;
  copilotSlot?: ReactNode;
  fromPdf?: boolean;
}) {
  const { t } = useI18n();
  const { lesson } = store;
  const articleMedia = lesson.sections.flatMap((section) => section.media ?? []);
  const noProject = isSparseLesson(lesson);
  const [attempts, setAttempts] = useState<AttemptsMap>({});
  const [studentName, setStudentName] = useState('');
  const [exporting, setExporting] = useState(false);

  const recordAttempt = useCallback((attempt: QuizAttempt) => {
    setAttempts((prev) => ({ ...prev, [attempt.quizItemId]: attempt }));
  }, []);

  const summary = useMemo(() => summarizeAttempts(lesson, attempts), [lesson, attempts]);
  const band = useMemo(() => cheerBand(summary), [summary]);

  const resultsCopy = useMemo((): StudentResultsPdfCopy => {
    return {
      forTeacher: t('reader.resultsPdf.forTeacher'),
      scoreLabel: t('reader.resultsPdf.scoreLabel'),
      cheer: {
        perfect: t('reader.resultsCheer.perfect'),
        strong: t('reader.resultsCheer.strong'),
        learning: t('reader.resultsCheer.learning'),
        started: t('reader.resultsCheer.started'),
      },
      missedHeading: t('reader.resultsPdf.missedHeading'),
      allCorrectHeading: t('reader.resultsPdf.allCorrectHeading'),
      skippedLabel: t('reader.resultsPdf.skipped'),
      yourAnswer: t('reader.resultsPdf.yourAnswer'),
      correctAnswer: t('reader.resultsPdf.correctAnswer'),
      nestedLabel: t('reader.resultsPdf.nested'),
      endLabel: t('reader.resultsPdf.end'),
      notesHeading: t('reader.resultsPdf.notesHeading'),
      noNotes: t('reader.resultsPdf.noNotes'),
      learnedLabel: t('reader.resultsPdf.learned'),
      studentLabel: t('reader.resultsPdf.student'),
      dateLabel: t('reader.resultsPdf.date'),
      handoffFooter: t('reader.resultsPdf.handoff'),
      countsLine: (s) =>
        t('reader.resultsPdf.counts', {
          correct: s.correct,
          missed: s.missed,
          skipped: s.skipped,
          total: s.total,
        }),
    };
  }, [t]);

  async function handleExportResults() {
    setExporting(true);
    try {
      const { exportStudentResultsPdf } = await import('@/lib/export-results-pdf');
      await exportStudentResultsPdf({
        lesson,
        attempts,
        studentName,
        copy: resultsCopy,
      });
      conversionResultsExported();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={noProject ? 'studio-idle' : 'grid gap-8 lg:grid-cols-[1.4fr_0.8fr]'}>
      <section>
        {noProject ? (
          <ImportRestorePanel
            mode="student"
            layout="banner"
            highlightPdfUpload={fromPdf}
            onImport={(raw) => store.importRestorePayload(raw)}
          />
        ) : (
          <ManuscriptPage className="manuscript-reveal">
            <div data-lectern-target="meta">
              <ManuscriptTitle
                eyebrow={t('reader.eyebrow')}
                title={lesson.meta.title}
                subtitle={
                  <>
                    {lesson.meta.subject}
                    {lesson.meta.audience ? ` · ${lesson.meta.audience}` : ''}
                  </>
                }
              >
                <ManuscriptObjectives items={lesson.meta.objectives} />
              </ManuscriptTitle>
            </div>

            <div data-lectern-target="materials">
              {lesson.sections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-walnut/25 bg-cream/40 px-4 py-6 text-sm text-walnut">
                  {t('reader.emptyMaterials')}
                </div>
              ) : (
                lesson.sections.map((section, index) => (
                  <StudentSection
                    key={section.id}
                    section={section}
                    index={index}
                    store={store}
                    articleMedia={articleMedia}
                    articleTitle={lesson.meta.title}
                    nestedQuiz={quizItemsForSection(lesson, section.id)}
                    onAttempt={recordAttempt}
                  />
                ))
              )}
            </div>

            <div data-lectern-target="quiz">
              <ManuscriptQuizFrame>
                {(() => {
                  const endQuiz = lessonLevelQuiz(lesson);
                  if (endQuiz.length === 0) {
                    return <p className="text-sm text-walnut">{t('reader.emptyQuiz')}</p>;
                  }
                  return endQuiz.map((item, qIndex) => (
                    <StudentQuizItem
                      key={item.id}
                      item={item}
                      qIndex={qIndex}
                      lessonTitle={lesson.meta.title}
                      onAttempt={recordAttempt}
                    />
                  ));
                })()}
              </ManuscriptQuizFrame>
            </div>

            <div className="mt-8">
              <StudentResultsBlock
                summary={summary}
                band={band}
                notesCount={lesson.annotations.length}
                studentName={studentName}
                onStudentNameChange={setStudentName}
                exporting={exporting}
                onExport={() => void handleExportResults()}
              />
            </div>
          </ManuscriptPage>
        )}
      </section>

      <aside className={noProject ? 'studio-idle-copilot' : 'studio-rail'}>
        {noProject ? (
          copilotSlot
        ) : (
        <StudioRailScroll>
        {copilotSlot}

          <div className="rounded-xl border border-walnut/10 bg-ivory/90 p-6 shadow-lectern">
            <ImportRestorePanel
              mode="student"
              highlightPdfUpload={fromPdf}
              onImport={(raw) => store.importRestorePayload(raw)}
            />
          </div>

          <div
            className="rounded-xl border border-walnut/10 bg-ivory/90 p-5 shadow-lectern"
            data-lectern-target="annotations"
          >
            <h3 className="font-display text-xl text-forest">{t('reader.yourMarks')}</h3>
            {lesson.annotations.length === 0 ? (
              <p className="mt-2 text-sm text-moss">{t('reader.noAnnotations')}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {lesson.annotations.map((annotation) => {
                  const section = lesson.sections.find((s) => s.id === annotation.sectionId);
                  return (
                    <li key={annotation.id} className="rounded-md bg-cream px-3 py-2 text-sm">
                      <div className="font-mono text-xs text-moss">
                        {section?.title ?? annotation.sectionId}
                      </div>
                      {annotation.kind === 'learned' || annotation.note === 'Learned' ? (
                        <div className="mt-1 font-medium text-forest">{t('reader.learned')}</div>
                      ) : (
                        <div className="mt-1 text-ink">{annotation.note}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </StudioRailScroll>
        )}
      </aside>
    </div>
  );
}

function StudentQuizItem({
  item,
  qIndex,
  lessonTitle,
  onAttempt,
}: {
  item: QuizItem;
  qIndex: number;
  lessonTitle: string;
  onAttempt: (attempt: QuizAttempt) => void;
}) {
  const { t } = useI18n();
  const visual = Boolean(item.choiceMedia?.some(Boolean));
  const galleryItems = (item.choiceMedia ?? []).filter((entry): entry is SectionMedia => Boolean(entry));
  const [pending, setPending] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const selected = visual ? confirmed : pending;
  const revealed = selected !== null;
  const highlighted = visual ? (revealed ? confirmed : pending) : pending;

  function commitChoice(index: number) {
    onAttempt(recordQuizAttempt(item, index));
  }

  function pickChoice(index: number) {
    if (revealed) return;
    if (visual) {
      setPending(index);
      return;
    }
    setPending(index);
    commitChoice(index);
  }

  function confirmVisual() {
    if (pending === null) return;
    setConfirmed(pending);
    commitChoice(pending);
  }

  const label = t('reader.question', { n: qIndex + 1 });

  return (
    <div className="manuscript-quiz-item" data-lectern-target={`quiz:${item.id}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="font-mono text-xs uppercase tracking-wider text-moss">{label}</p>
        <div className="ms-auto">
          <CopySectionReferenceButton
            target="quiz"
            quizId={item.id}
            label={label}
            prompt={item.prompt}
            sectionId={item.sectionId}
            lessonTitle={lessonTitle}
            mode="student"
          />
        </div>
      </div>
      <div className="font-medium text-ink">
        <LessonProse source={item.prompt} />
      </div>
      <div className={`mt-3 ${visual ? 'grid gap-3 sm:grid-cols-2' : 'space-y-2'}`}>
        {item.choices.map((choice, index) => {
          const media = item.choiceMedia?.[index];
          const active = highlighted === index;
          const cardClass = `overflow-hidden rounded-md border text-start text-sm ${
            revealed && active
              ? 'border-forest bg-forest/10'
              : active
                ? 'border-brass bg-brass/10'
                : 'border-walnut/15 bg-ivory'
          }`;

          if (!visual) {
            return (
              <button
                key={`${item.id}_${index}`}
                type="button"
                className={`block w-full ${cardClass} hover:border-brass`}
                onClick={() => pickChoice(index)}
                disabled={revealed}
              >
                <span className="block px-3 pb-2.5 pt-2">
                  <LessonProse source={choice} inline />
                </span>
              </button>
            );
          }

          return (
            <div key={`${item.id}_${index}`} className={cardClass}>
              {media ? (
                <>
                  <div className="section-media-launch quiz-choice-look">
                    <button
                      type="button"
                      className="quiz-choice-media"
                      onClick={() => pickChoice(index)}
                      disabled={revealed}
                      aria-pressed={pending === index}
                      aria-label={t('reader.selectChoice')}
                    >
                      <img
                        className="section-media-frame max-h-48 w-full"
                        src={media.src}
                        alt={media.alt || choice}
                      />
                    </button>
                    <button
                      type="button"
                      className="quiz-choice-gallery"
                      onClick={(event) => {
                        event.stopPropagation();
                        setGalleryId(media.id);
                      }}
                      aria-label={t('gallery.openAria', { alt: media.alt || choice })}
                    >
                      {t('gallery.view')}
                    </button>
                  </div>
                  {isGeneratedIllustration(media) ? (
                    <span className="block px-3 pt-2 text-[0.65rem] leading-tight text-moss">
                      {t('reader.aiNotice')}
                    </span>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                className="block w-full px-3 pb-2.5 pt-2 text-start hover:text-forest disabled:hover:text-inherit"
                onClick={() => pickChoice(index)}
                disabled={revealed}
                aria-pressed={pending === index}
                aria-label={t('reader.selectChoice')}
              >
                <LessonProse source={choice} inline />
              </button>
            </div>
          );
        })}
      </div>
      {visual && pending !== null && !revealed ? (
        <button
          type="button"
          className="mt-3 rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-cream hover:bg-moss"
          onClick={confirmVisual}
        >
          {t('reader.confirmAnswer')}
        </button>
      ) : null}
      {revealed ? (
        <div className="mt-3 text-sm text-moss">
          <p className="mb-1 font-semibold">
            {selected === item.answerIndex ? t('reader.correct') : t('reader.notQuite')}
          </p>
          <LessonProse source={item.explanation} />
        </div>
      ) : null}
      {visual ? (
        <MediaLightbox
          media={galleryItems}
          activeId={galleryId}
          articleTitle={t('reader.question', { n: qIndex + 1 })}
          onChangeActive={setGalleryId}
          onClose={() => setGalleryId(null)}
        />
      ) : null}
    </div>
  );
}

function StudentSection({
  section,
  index,
  store,
  articleMedia,
  articleTitle,
  nestedQuiz,
  onAttempt,
}: {
  section: LessonSection;
  index: number;
  store: LessonStore;
  articleMedia: SectionMedia[];
  articleTitle: string;
  nestedQuiz: QuizItem[];
  onAttempt: (attempt: QuizAttempt) => void;
}) {
  const readRootRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRead();
  const reading = speech.status === 'speaking' && speech.blockId === section.id;

  return (
    <div data-lectern-target={`section:${section.id}`}>
      <ManuscriptSection
        kind={section.kind}
        index={index}
        title={section.title}
        readRootRef={readRootRef}
        reading={reading}
        actions={<ReadAloudButton blockId={section.id} rootRef={readRootRef} />}
        footer={
          nestedQuiz.length > 0 ? (
            <ManuscriptSectionCheck>
              {nestedQuiz.map((item, qIndex) => (
                <StudentQuizItem
                  key={item.id}
                  item={item}
                  qIndex={qIndex}
                  lessonTitle={articleTitle}
                  onAttempt={onAttempt}
                />
              ))}
            </ManuscriptSectionCheck>
          ) : undefined
        }
      >
        <LessonProse source={section.body} />
        <div data-read-aloud-skip>
          <SectionMediaGallery
            items={section.media ?? []}
            galleryItems={articleMedia}
            articleTitle={articleTitle}
          />
        </div>
        <div data-read-aloud-skip>
          <SectionMarginMark
            sectionId={section.id}
            store={store}
            trailing={
              <CopySectionReferenceButton
                sectionId={section.id}
                title={section.title}
                kind={section.kind}
                lessonTitle={articleTitle}
                mode="student"
              />
            }
          />
        </div>
      </ManuscriptSection>
    </div>
  );
}
