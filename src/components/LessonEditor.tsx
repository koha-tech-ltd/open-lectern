import type { MouseEvent, ReactNode } from 'react';
import { useCallback, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApproveActionChips } from '@/components/ApproveActionChips';
import { InlineEditChip } from '@/components/InlineEditChip';
import { CopySectionReferenceButton } from '@/components/CopySectionReferenceButton';
import { ExportOptionsMenu } from '@/components/ExportOptionsMenu';
import { ImportRestorePanel } from '@/components/ImportRestorePanel';
import { LessonProse } from '@/components/LessonProse';
import { LessonStartBanner } from '@/components/LessonStartBanner';
import {
  ManuscriptObjectives,
  ManuscriptPage,
  ManuscriptQuizFrame,
  ManuscriptSection,
  ManuscriptSectionCheck,
  ManuscriptTitle,
} from '@/components/Manuscript';
import { SectionKindSelect } from '@/components/SectionKindSelect';
import { SectionMediaAttach } from '@/components/SectionMediaAttach';
import { ReadinessBlock } from '@/components/ReadinessBlock';
import { SectionMediaGallery } from '@/components/SectionMediaGallery';
import { StudioRailScroll } from '@/components/StudioRailScroll';
import type { LessonStore } from '@/hooks/useLessonStore';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import { caretOffsetAfterSnippet } from '@/lib/inline-snippet';
import { captureInlineTextTarget, placeSourceCaret, type InlineTextTarget } from '@/lib/inline-text-hit';
import { recordUserActivity } from '@/lib/agent-activity';
import { isSparseLesson, LECTERN_DEMO_IDS, lessonLevelQuiz, quizItemsForSection } from '@/lib/lesson';
import { uniqueCustomSectionKinds } from '@/lib/section-kind';
import { isGeneratedIllustration } from '@/lib/visual-learning';
import { conversionLecternExported, conversionPdfExported } from '@/lib/product-events';
import type { QuizItem } from '@/types/lesson';

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-walnut/25 bg-cream/40 px-4 py-6 text-sm text-walnut">
      {children}
    </div>
  );
}

function MaterialsEmpty({
  onAdd,
  t,
}: {
  onAdd: () => void;
  t: (key: MessageKey) => string;
}) {
  return (
    <div className="materials-empty">
      <div className="materials-empty-meta">
        <span className="manuscript-section-num" aria-hidden>
          01
        </span>
        <span className="manuscript-section-kind">{t('manuscript.kind.material')}</span>
      </div>
      <h3 className="materials-empty-title">{t('editor.emptyMaterialsTitle')}</h3>
      <p className="materials-empty-body">{t('editor.emptyMaterials')}</p>
      <div className="materials-empty-actions">
        <button type="button" className="materials-empty-cta" onClick={onAdd}>
          {t('editor.addFirstSection')}
        </button>
        <p className="materials-empty-hint">{t('editor.emptyMaterialsHint')}</p>
      </div>
    </div>
  );
}

function QuizChoicePreview({
  item,
  t,
}: {
  item: QuizItem;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const hasMedia = item.choiceMedia?.some(Boolean);
  if (!hasMedia) {
    return (
      <ol className="mt-3 list-decimal space-y-1 ps-5 text-sm text-ink/90">
        {item.choices.map((choice, index) => (
          <li key={`${item.id}_${index}`}>
            <LessonProse source={choice} inline />
            {index === item.answerIndex ? (
              <span className="ms-2 font-mono text-[0.65rem] uppercase text-moss">
                {t('editor.answer')}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {item.choices.map((choice, index) => {
        const media = item.choiceMedia?.[index];
        return (
          <div
            key={`${item.id}_${index}`}
            className={`overflow-hidden rounded-md border text-start text-sm ${
              index === item.answerIndex
                ? 'border-forest bg-forest/10'
                : 'border-walnut/15 bg-ivory'
            }`}
          >
            {media ? (
              <>
                <img
                  className="section-media-frame mb-6 max-h-48 w-full rounded-t-md"
                  src={media.src}
                  alt={media.alt || choice}
                />
                {isGeneratedIllustration(media) ? (
                  <span className="block px-3 text-[0.65rem] leading-tight text-moss">
                    {t('reader.aiNotice')}
                  </span>
                ) : null}
              </>
            ) : null}
            <span className="block px-3 pb-2.5 pt-2">
              <LessonProse source={choice} inline />
              {index === item.answerIndex ? (
                <span className="ms-2 font-mono text-[0.65rem] uppercase text-moss">
                  {t('editor.answer')}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TeacherQuizItemBlock({
  item,
  qIndex,
  open,
  store,
  t,
  onToggle,
}: {
  item: QuizItem;
  qIndex: number;
  open: boolean;
  store: LessonStore;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  onToggle: () => void;
}) {
  const label = `Q${qIndex + 1}`;
  return (
    <div className="manuscript-quiz-item" data-lectern-target={`quiz:${item.id}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-moss">{label}</span>
        <button
          type="button"
          className="ms-auto text-xs font-medium text-forest underline-offset-2 hover:underline"
          onClick={onToggle}
        >
          {open ? t('editor.done') : t('editor.edit')}
        </button>
        {open ? (
          <ApproveActionChips
            ask={t('editor.removeQuizAsk')}
            removeLabel={t('editor.remove')}
            confirmLabel={t('editor.confirm')}
            declineLabel={t('editor.decline')}
            onConfirm={() => store.removeQuizItem(item.id)}
          />
        ) : null}
        <CopySectionReferenceButton
          target="quiz"
          quizId={item.id}
          label={label}
          prompt={item.prompt}
          sectionId={item.sectionId}
          lessonTitle={store.lesson.meta.title}
          mode="teacher"
        />
      </div>

      {open ? (
        <>
          <textarea
            className="manuscript-source min-h-16"
            value={item.prompt}
            onChange={(e) =>
              store.upsertQuizItem({
                id: item.id,
                prompt: e.target.value,
                choices: item.choices,
                answerIndex: item.answerIndex,
                explanation: item.explanation,
                order: item.order,
              })
            }
          />
          <div className="mt-3 space-y-2">
            {item.choices.map((choice, index) => (
              <div key={`${item.id}_${index}`} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`answer_${item.id}`}
                  checked={item.answerIndex === index}
                  onChange={() =>
                    store.upsertQuizItem({
                      id: item.id,
                      prompt: item.prompt,
                      choices: item.choices,
                      choiceMedia: item.choiceMedia,
                      answerIndex: index,
                      explanation: item.explanation,
                      order: item.order,
                    })
                  }
                />
                <input
                  className="w-full rounded-md border border-walnut/10 bg-cream/70 px-3 py-1.5 font-mono text-sm outline-none focus:border-brass"
                  value={choice}
                  onChange={(e) => {
                    const choices = [...item.choices];
                    choices[index] = e.target.value;
                    store.upsertQuizItem({
                      id: item.id,
                      prompt: item.prompt,
                      choices,
                      choiceMedia: item.choiceMedia,
                      answerIndex: item.answerIndex,
                      explanation: item.explanation,
                      order: item.order,
                    });
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {item.choices.map((choice, index) => {
              const media = item.choiceMedia?.[index];
              return (
                <div key={`${item.id}_media_${index}`} className="rounded-lg border border-walnut/10 bg-cream/40 p-3">
                  <p className="mb-2 text-xs font-medium text-forest">{t('editor.visualAnswer', { choice })}</p>
                  {media ? (
                    <>
                      <img className="section-media-frame max-h-48 w-full rounded-md" src={media.src} alt={media.alt} />
                      <button
                        type="button"
                        className="mt-6 text-xs text-walnut underline-offset-2 hover:underline"
                        onClick={() => {
                          const choiceMedia = [...(item.choiceMedia ?? [])];
                          choiceMedia[index] = null;
                          store.upsertQuizItem({
                            id: item.id,
                            prompt: item.prompt,
                            choices: item.choices,
                            choiceMedia,
                            answerIndex: item.answerIndex,
                            explanation: item.explanation,
                            order: item.order,
                          });
                        }}
                      >
                        {t('editor.removeImage')}
                      </button>
                    </>
                  ) : (
                    <SectionMediaAttach
                      imageOnly
                      showTemplates={false}
                      onAdd={(added) => {
                        const choiceMedia = [...(item.choiceMedia ?? [])];
                        choiceMedia[index] = added;
                        store.upsertQuizItem({
                          id: item.id,
                          prompt: item.prompt,
                          choices: item.choices,
                          choiceMedia,
                          answerIndex: item.answerIndex,
                          explanation: item.explanation,
                          order: item.order,
                        });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <textarea
            className="manuscript-source mt-3 min-h-16"
            value={item.explanation}
            placeholder={t('editor.explanation')}
            onChange={(e) =>
              store.upsertQuizItem({
                id: item.id,
                prompt: item.prompt,
                choices: item.choices,
                choiceMedia: item.choiceMedia,
                answerIndex: item.answerIndex,
                explanation: e.target.value,
                order: item.order,
              })
            }
          />
          <p className="manuscript-preview-label">{t('editor.preview')}</p>
          <div className="font-medium text-ink">
            <LessonProse source={item.prompt} />
          </div>
          <QuizChoicePreview item={item} t={t} />
        </>
      ) : (
        <>
          <div className="font-medium text-ink">
            <LessonProse source={item.prompt} />
          </div>
          <QuizChoicePreview item={item} t={t} />
          <div className="mt-2 text-sm text-moss">
            <LessonProse source={item.explanation} />
          </div>
        </>
      )}
    </div>
  );
}

function SyntaxGuideLinks() {
  const { t } = useI18n();
  return (
    <span className="manuscript-preview-guides">
      <Link to="/markdown" target="_blank" rel="noreferrer">
        {t('guide.markdown')}
      </Link>
      <Link to="/math" target="_blank" rel="noreferrer">
        {t('guide.math')}
      </Link>
    </span>
  );
}

function ObjectivesFieldLabel({
  t,
}: {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const template = t('editor.objectives');
  const linkClass = 'font-medium text-forest underline underline-offset-2 hover:text-forest/80';
  const parts = template.split(/(\{markdown\}|\{math\})/);

  return (
    <>
      {parts.map((part, index) => {
        if (part === '{markdown}') {
          return (
            <Link key={index} to="/markdown" target="_blank" rel="noreferrer" className={linkClass}>
              {t('editor.syntax.markdown')}
            </Link>
          );
        }
        if (part === '{math}') {
          return (
            <Link key={index} to="/math" target="_blank" rel="noreferrer" className={linkClass}>
              {t('editor.syntax.math')}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}

export function LessonEditor({
  store,
  copilotSlot,
}: {
  store: LessonStore;
  copilotSlot?: ReactNode;
}) {
  const { t } = useI18n();
  const { lesson, gaps } = store;
  const bodyPlaceholder = t('editor.bodyPlaceholder');
  const isBlankTitle = !lesson.meta.title.trim() || lesson.meta.title === 'Untitled lesson';
  const sparse = isSparseLesson(lesson);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editingMeta, setEditingMeta] = useState(isBlankTitle || lesson.sections.length === 0);
  const [editingQuiz, setEditingQuiz] = useState<Record<string, boolean>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [pendingSourceCaret, setPendingSourceCaret] = useState<{
    sectionId: string;
    offset: number;
  } | null>(null);
  const [inlineHit, setInlineHit] = useState<(InlineTextTarget & { sectionId: string }) | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const articleMedia = lesson.sections.flatMap((section) => section.media ?? []);
  const customKinds = uniqueCustomSectionKinds(lesson.sections.map((section) => section.kind));
  const showStartBanner = sparse && !store.authoring;

  const isEditing = (id: string) => editing[id] === true;
  const toggleEdit = (id: string) => {
    if (isEditing(id)) {
      const section = store.lesson.sections.find((item) => item.id === id);
      recordUserActivity({
        action: 'section.edit',
        summary: section?.title.trim() || id,
        targets: [`section:${id}`, 'materials'],
      });
    }
    setEditing((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleMetaEdit = () => {
    if (editingMeta) {
      recordUserActivity({
        action: 'meta.edit',
        summary: lesson.meta.title.trim() || lesson.id,
        targets: ['meta'],
      });
    }
    setEditingMeta((value) => !value);
  };
  const toggleQuizEdit = (id: string) => {
    if (editingQuiz[id] === true) {
      const item = store.lesson.quiz.find((quiz) => quiz.id === id);
      recordUserActivity({
        action: 'quiz.edit',
        summary: item?.prompt.trim() || id,
        targets: item?.sectionId
          ? [`section:${item.sectionId}`, `quiz:${id}`, 'quiz']
          : [`quiz:${id}`, 'quiz'],
      });
    }
    setEditingQuiz((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useLayoutEffect(() => {
    if (!pendingSourceCaret) return;
    const el = document.querySelector(
      `[data-section-source="${CSS.escape(pendingSourceCaret.sectionId)}"]`,
    );
    if (!(el instanceof HTMLTextAreaElement)) return;
    placeSourceCaret(el, pendingSourceCaret.offset);
    setPendingSourceCaret(null);
  }, [pendingSourceCaret, editing]);

  const dismissInline = useCallback(() => {
    setInlineHit(null);
  }, []);

  const jumpToSource = useCallback(
    (sectionId: string, snippet: string, occurrence: number) => {
      const section = store.lesson.sections.find((item) => item.id === sectionId);
      const offset = section ? caretOffsetAfterSnippet(section.body, snippet, occurrence) : null;
      setInlineHit(null);
      setEditing((prev) => ({ ...prev, [sectionId]: true }));
      setPendingSourceCaret({
        sectionId,
        offset: offset ?? section?.body.length ?? 0,
      });
    },
    [store.lesson.sections],
  );

  const runPdfExport = useCallback(
    async (orientation: 'portrait' | 'landscape' = 'portrait') => {
      setExporting(true);
      setExportMsg(null);
      try {
        const { exportLessonPdf, downloadRestoreText } = await import('@/lib/export-pdf');
        const { filename, bundle, sizeWarning } = await exportLessonPdf(store.lesson, { orientation });
        downloadRestoreText(bundle, store.lesson.meta.title);
        conversionPdfExported({
          blockers: gaps.filter((gap) => gap.severity === 'blocker').length,
          warnings: gaps.filter((gap) => gap.severity === 'warning').length,
          orientation,
        });
        setExportMsg(
          t('editor.exportOk', {
            filename,
            warn: sizeWarning ? ` ${sizeWarning}` : '',
          }),
        );
      } catch (err) {
        setExportMsg(err instanceof Error ? err.message : t('editor.exportFail'));
      } finally {
        setExporting(false);
      }
    },
    [gaps, store.lesson, t],
  );

  const onMaterialDoubleClick = (sectionId: string, event: MouseEvent<HTMLDivElement>) => {
    const captured = captureInlineTextTarget(event.currentTarget, event);
    if (!captured) return;
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    setInlineHit({ sectionId, ...captured });
  };

  const addMaterialSection = (title: string) => {
    const result = store.upsertSection({
      title,
      body: '',
      kind: 'material',
    });
    if (result.ok && result.sectionId) {
      const id = result.sectionId;
      setEditing((prev) => ({ ...prev, [id]: true }));
      setPendingFocusId(id);
    }
  };

  const importPanel = (
    <ImportRestorePanel
      mode="teacher"
      lesson={store.lesson}
      libraryItems={store.libraryItems}
      onImport={(raw) => store.importRestorePayload(raw)}
      onLoadDemo={(id) => void store.loadDemo(id)}
      onOpenLibraryLesson={(id) => void store.openLibraryLesson(id)}
      onNewLesson={() => void store.newLesson()}
      onRemoveLibraryLesson={(id) => void store.deleteLibraryLesson(id)}
      layout={showStartBanner ? 'wide' : 'panel'}
    />
  );

  return (
    <div className={showStartBanner ? 'studio-idle' : 'studio-lesson grid gap-8 lg:grid-cols-[1.4fr_0.8fr]'}>
      <section className="min-w-0 space-y-5">
        {showStartBanner ? (
          <LessonStartBanner
            mediaId="draft"
            eyebrow={t('editor.startEyebrow')}
            title={t('editor.startTitle')}
            body={t('editor.startBody')}
            articleTarget="meta"
            copyTarget="materials"
            extraTargets={['quiz', 'publish', 'gaps']}
          >
            <div className="lesson-io-actions lesson-start-banner-actions">
              <button
                type="button"
                className="lesson-io-btn lesson-io-btn-primary"
                onClick={() => {
                  store.enterAuthoring();
                  setEditingMeta(true);
                }}
              >
                {t('editor.startCta')}
              </button>
              <button
                type="button"
                className="lesson-io-btn lesson-io-btn-secondary"
                onClick={() => {
                  const id =
                    LECTERN_DEMO_IDS[Math.floor(Math.random() * LECTERN_DEMO_IDS.length)] ??
                    'photosynthesis';
                  void store.loadDemo(id);
                }}
              >
                {t('editor.startRandomDemo')}
              </button>
            </div>
            <p className="lesson-io-hint">{t('editor.startCopilotHint')}</p>
          </LessonStartBanner>
        ) : (
        <ManuscriptPage className="manuscript-reveal">
          <div data-lectern-target="meta">
            <ManuscriptTitle
              eyebrow={t('editor.eyebrow')}
              title={
                editingMeta ? (
                  <input
                    className="w-full border-0 bg-transparent font-display text-[inherit] font-semibold text-forest outline-none placeholder:text-walnut/35"
                    value={lesson.meta.title}
                    onChange={(e) => store.setMeta({ title: e.target.value })}
                    placeholder={t('editor.titlePlaceholder')}
                  />
                ) : (
                  lesson.meta.title
                )
              }
              subtitle={
                editingMeta ? undefined : (
                  <>
                    {lesson.meta.subject || t('editor.subjectTbd')}
                    {lesson.meta.audience ? ` · ${lesson.meta.audience}` : ''}
                  </>
                )
              }
            >
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-walnut/20 bg-ivory px-3 py-1.5 text-xs font-medium text-forest"
                  onClick={toggleMetaEdit}
                >
                  {editingMeta ? t('editor.doneTitlePage') : t('editor.editTitlePage')}
                </button>
              </div>

              {editingMeta ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm text-walnut">
                      {t('editor.audience')}
                      <input
                        className="mt-1 w-full rounded-md border border-walnut/15 bg-cream px-3 py-2 text-ink outline-none focus:border-brass"
                        value={lesson.meta.audience}
                        onChange={(e) => store.setMeta({ audience: e.target.value })}
                        placeholder={t('editor.audiencePlaceholder')}
                      />
                    </label>
                    <label className="block text-sm text-walnut">
                      {t('editor.subject')}
                      <input
                        className="mt-1 w-full rounded-md border border-walnut/15 bg-cream px-3 py-2 text-ink outline-none focus:border-brass"
                        value={lesson.meta.subject}
                        onChange={(e) => store.setMeta({ subject: e.target.value })}
                        placeholder={t('editor.subjectPlaceholder')}
                      />
                    </label>
                  </div>
                  <label className="block text-sm text-walnut">
                    <ObjectivesFieldLabel t={t} />
                    <textarea
                      className="manuscript-source min-h-24"
                      value={lesson.meta.objectives.join('\n')}
                      placeholder={t('editor.objectivesPlaceholder')}
                      onChange={(e) =>
                        store.setMeta({
                          objectives: e.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                </div>
              ) : (
                <ManuscriptObjectives items={lesson.meta.objectives} />
              )}

              {isBlankTitle && !editingMeta ? (
                <p className="mt-3 text-sm text-walnut/80">
                  {t('editor.blankHint')}
                </p>
              ) : null}
            </ManuscriptTitle>
          </div>

          <div data-lectern-target="materials">
            <h2 className="mb-2 font-display text-xl text-forest">{t('editor.materials')}</h2>

            {lesson.sections.length === 0 ? (
              <MaterialsEmpty
                t={t}
                onAdd={() => addMaterialSection(t('editor.openingIdea'))}
              />
            ) : (
              lesson.sections.map((section, index) => {
                const open = isEditing(section.id);
                const nestedQuiz = quizItemsForSection(lesson, section.id);
                return (
                  <div key={section.id} data-lectern-target={`section:${section.id}`}>
                    <ManuscriptSection
                      kind={section.kind}
                      index={index}
                      title={
                        open ? (
                          <input
                            className="w-full border-0 bg-transparent font-display text-[inherit] font-semibold text-forest outline-none"
                            value={section.title}
                            autoFocus={pendingFocusId === section.id}
                            onFocus={(e) => {
                              if (pendingFocusId !== section.id) return;
                              e.currentTarget.select();
                              setPendingFocusId(null);
                            }}
                            onChange={(e) =>
                              store.upsertSection({
                                id: section.id,
                                title: e.target.value,
                                body: section.body,
                                kind: section.kind,
                                order: section.order,
                              })
                            }
                          />
                        ) : (
                          section.title
                        )
                      }
                      kindControl={
                        open ? (
                          <SectionKindSelect
                            value={section.kind}
                            extraKinds={customKinds}
                            onChange={(kind) =>
                              store.upsertSection({
                                id: section.id,
                                title: section.title,
                                body: section.body,
                                kind,
                                order: section.order,
                              })
                            }
                          />
                        ) : undefined
                      }
                      actions={
                        <>
                          <button
                            type="button"
                            className="text-xs font-medium text-forest underline-offset-2 hover:underline"
                            onClick={() => toggleEdit(section.id)}
                          >
                            {open ? t('editor.done') : t('editor.editSource')}
                          </button>
                          {open ? (
                            <ApproveActionChips
                              ask={t('editor.removeSectionAsk')}
                              removeLabel={t('editor.remove')}
                              confirmLabel={t('editor.confirm')}
                              declineLabel={t('editor.decline')}
                              onConfirm={() => store.removeSection(section.id)}
                            />
                          ) : null}
                          <CopySectionReferenceButton
                            sectionId={section.id}
                            title={section.title}
                            kind={section.kind}
                            lessonTitle={lesson.meta.title}
                            mode="teacher"
                          />
                        </>
                      }
                      footer={
                        <ManuscriptSectionCheck>
                          {nestedQuiz.length === 0 ? (
                            <p className="mb-2 text-xs text-walnut/70">{t('editor.emptySectionCheck')}</p>
                          ) : (
                            nestedQuiz.map((item, qIndex) => (
                              <TeacherQuizItemBlock
                                key={item.id}
                                item={item}
                                qIndex={qIndex}
                                open={editingQuiz[item.id] === true}
                                store={store}
                                t={t}
                                onToggle={() => toggleQuizEdit(item.id)}
                              />
                            ))
                          )}
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              className="rounded-md bg-forest/90 px-2.5 py-1 text-xs font-medium text-cream hover:bg-forest"
                              onClick={() => {
                                const result = store.upsertQuizItem({
                                  prompt: t('editor.newQuizPrompt'),
                                  choices: [
                                    t('editor.optionA'),
                                    t('editor.optionB'),
                                    t('editor.optionC'),
                                    t('editor.optionD'),
                                  ],
                                  answerIndex: 0,
                                  explanation: t('editor.explainChoice'),
                                  sectionId: section.id,
                                });
                                if (result.ok && result.quizId) {
                                  setEditingQuiz((prev) => ({ ...prev, [result.quizId!]: true }));
                                }
                              }}
                            >
                              {t('editor.addSectionCheck')}
                            </button>
                          </div>
                        </ManuscriptSectionCheck>
                      }
                    >
                      {open ? (
                        <>
                          {section.body.trim() ? (
                            <>
                              <p className="manuscript-preview-label">{t('editor.previewLabel')}</p>
                              <div
                                className="manuscript-inline-hit"
                                data-inline-hit={section.id}
                                onDoubleClick={(event) => onMaterialDoubleClick(section.id, event)}
                              >
                                <LessonProse source={section.body} />
                              </div>
                              <SectionMediaGallery
                                items={section.media ?? []}
                                galleryItems={articleMedia}
                                articleTitle={lesson.meta.title}
                              />
                            </>
                          ) : null}
                          <p className="manuscript-preview-label manuscript-preview-label-row">
                            <span>{t('editor.sourceLabel')}</span>
                            <SyntaxGuideLinks />
                          </p>
                          <textarea
                            className="manuscript-source"
                            data-section-source={section.id}
                            value={section.body}
                            placeholder={bodyPlaceholder}
                            onChange={(e) =>
                              store.upsertSection({
                                id: section.id,
                                title: section.title,
                                body: e.target.value,
                                kind: section.kind,
                                order: section.order,
                              })
                            }
                          />
                          <p className="manuscript-preview-label">{t('editor.mediaLabel')}</p>
                          <SectionMediaGallery
                            items={section.media ?? []}
                            galleryItems={articleMedia}
                            articleTitle={lesson.meta.title}
                            editable
                            onCaption={(id, caption) =>
                              store.updateSectionMedia(section.id, id, { caption })
                            }
                            onRemove={(id) => store.removeSectionMedia(section.id, id)}
                          />
                          <SectionMediaAttach
                            onAdd={(media) => store.addSectionMedia(section.id, media)}
                          />
                        </>
                      ) : (
                        <>
                          <div
                            className="manuscript-inline-hit"
                            data-inline-hit={section.id}
                            onDoubleClick={(event) => onMaterialDoubleClick(section.id, event)}
                          >
                            <LessonProse source={section.body} />
                          </div>
                          <SectionMediaGallery
                            items={section.media ?? []}
                            galleryItems={articleMedia}
                            articleTitle={lesson.meta.title}
                            editable
                            onCaption={(id, caption) =>
                              store.updateSectionMedia(section.id, id, { caption })
                            }
                            onRemove={(id) => store.removeSectionMedia(section.id, id)}
                          />
                          <SectionMediaAttach
                            onAdd={(media) => store.addSectionMedia(section.id, media)}
                          />
                        </>
                      )}
                    </ManuscriptSection>
                  </div>
                );
              })
            )}
            {lesson.sections.length > 0 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md bg-forest px-3 py-1.5 text-sm font-medium text-cream"
                  onClick={() => addMaterialSection(t('editor.newSectionTitle'))}
                >
                  {t('editor.addSection')}
                </button>
              </div>
            ) : null}
          </div>

          <div data-lectern-target="quiz">
            <ManuscriptQuizFrame>
              {(() => {
                const endQuiz = lessonLevelQuiz(lesson);
                if (endQuiz.length === 0) {
                  return (
                    <EmptyHint>
                      {t('editor.emptyQuiz')}
                    </EmptyHint>
                  );
                }
                return endQuiz.map((item, qIndex) => (
                  <TeacherQuizItemBlock
                    key={item.id}
                    item={item}
                    qIndex={qIndex}
                    open={editingQuiz[item.id] === true}
                    store={store}
                    t={t}
                    onToggle={() => toggleQuizEdit(item.id)}
                  />
                ));
              })()}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md bg-forest px-3 py-1.5 text-sm font-medium text-cream"
                  onClick={() => {
                    const result = store.upsertQuizItem({
                      prompt: t('editor.newQuizPrompt'),
                      choices: [t('editor.optionA'), t('editor.optionB'), t('editor.optionC'), t('editor.optionD')],
                      answerIndex: 0,
                      explanation: t('editor.explainChoice'),
                    });
                    if (result.ok) {
                      const id = result.quizId;
                      if (id) setEditingQuiz((prev) => ({ ...prev, [id]: true }));
                    }
                  }}
                >
                  {t('editor.addQuiz')}
                </button>
              </div>
            </ManuscriptQuizFrame>
          </div>
        </ManuscriptPage>
        )}
      </section>

      <aside className={showStartBanner ? 'studio-idle-copilot min-w-0' : 'studio-rail min-w-0'}>
        {showStartBanner ? (
          copilotSlot
        ) : (
          <StudioRailScroll>
            {copilotSlot}

            <ReadinessBlock gaps={gaps} />

            <div
              className="rounded-xl border border-walnut/10 bg-forest p-5 text-cream shadow-lectern"
              data-lectern-target="publish"
            >
              <div className="lectern-export-head">
                <h3 className="font-display text-xl">{t('editor.publish')}</h3>
                <ExportOptionsMenu
                  disabled={exporting || savingProject}
                  onLandscape={() => {
                    void runPdfExport('landscape');
                  }}
                />
              </div>
              <p className="mt-2 text-sm text-cream/80">{t('editor.publishBody')}</p>
              {gaps.length > 0 ? (
                <p className="lectern-export-warn" role="note">
                  <svg className="lectern-export-warn-icon" viewBox="0 0 20 20" aria-hidden>
                    <path
                      d="M10 3.2 18 17H2L10 3.2Z"
                      fill="currentColor"
                      opacity="0.9"
                    />
                    <path d="M10 8.2v4.6" stroke="#24382c" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="10" cy="14.6" r="0.95" fill="#24382c" />
                  </svg>
                  <span>{t('editor.exportIncomplete')}</span>
                </p>
              ) : null}
              <button
                type="button"
                className="lectern-export-btn"
                disabled={exporting || savingProject}
                onClick={() => {
                  void runPdfExport('portrait');
                }}
              >
                {exporting ? t('editor.exporting') : t('editor.exportPdf')}
              </button>
              <button
                type="button"
                className="mt-2 w-full rounded-md border border-cream/25 bg-cream/10 px-3 py-2 text-sm font-semibold text-cream disabled:opacity-60"
                disabled={exporting || savingProject}
                onClick={() => {
                  void (async () => {
                    setSavingProject(true);
                    setExportMsg(null);
                    try {
                      const { downloadLecternFile } = await import('@/lib/export-lectern');
                      const { warnings } = await downloadLecternFile(store.lesson);
                      conversionLecternExported();
                      const name = store.lesson.meta.title || 'lesson';
                      setExportMsg(
                        warnings.length > 0
                          ? `${t('editor.saveProjectOk', { name })} ${warnings.slice(0, 2).join(' ')}`
                          : t('editor.saveProjectOk', { name }),
                      );
                    } catch (err) {
                      setExportMsg(err instanceof Error ? err.message : t('editor.saveProjectFail'));
                    } finally {
                      setSavingProject(false);
                    }
                  })();
                }}
              >
                {savingProject ? t('editor.savingProject') : t('editor.saveProject')}
              </button>
              {exportMsg ? <p className="mt-2 text-xs text-cream/80">{exportMsg}</p> : null}
            </div>

            <div className="rounded-xl border border-walnut/10 bg-ivory/90 p-6 shadow-lectern">
              {importPanel}
            </div>
          </StudioRailScroll>
        )}
      </aside>

      {showStartBanner ? (
        <div className="studio-idle-library rounded-xl border border-walnut/10 bg-ivory/90 p-6 shadow-lectern">
          {importPanel}
        </div>
      ) : null}

      {inlineHit ? (
        <InlineEditChip
          key={`${inlineHit.sectionId}:${inlineHit.occurrence}:${inlineHit.snippet}`}
          sectionId={inlineHit.sectionId}
          target={inlineHit}
          onEdit={() => jumpToSource(inlineHit.sectionId, inlineHit.snippet, inlineHit.occurrence)}
          onDismiss={dismissInline}
        />
      ) : null}
    </div>
  );
}
