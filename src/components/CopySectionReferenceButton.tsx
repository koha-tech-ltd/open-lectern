import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { copyText } from '@/lib/clipboard';
import { buildQuizReference, buildSectionReference } from '@/lib/section-reference';
import type { LessonMode, SectionKind } from '@/types/lesson';

type SharedProps = {
  lessonTitle: string;
  mode: LessonMode;
};

export type CopySectionReferenceProps = SharedProps & {
  target?: 'section';
  sectionId: string;
  title: string;
  kind: SectionKind;
};

export type CopyQuizReferenceProps = SharedProps & {
  target: 'quiz';
  quizId: string;
  label: string;
  prompt: string;
  sectionId?: string;
};

export function CopySectionReferenceButton(props: CopySectionReferenceProps | CopyQuizReferenceProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<'idle' | 'copied' | 'fail'>('idle');
  const [draft, setDraft] = useState('');
  const student = props.mode === 'student';
  const quiz = props.target === 'quiz';
  const hint = t(
    quiz
      ? student
        ? 'quiz.copyRefHintStudent'
        : 'quiz.copyRefHint'
      : student
        ? 'section.copyRefHintStudent'
        : 'section.copyRefHint',
  );

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!draft) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => {
      const field = textRef.current;
      if (!field) return;
      field.focus();
      field.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draft]);

  function buildReference(): string {
    if (props.target === 'quiz') {
      const nested = Boolean(props.sectionId);
      const askKey = student
        ? nested
          ? 'quiz.copyRefAskStudentNested'
          : 'quiz.copyRefAskStudent'
        : nested
          ? 'quiz.copyRefAskNested'
          : 'quiz.copyRefAsk';
      return buildQuizReference({
        quizId: props.quizId,
        label: props.label,
        prompt: props.prompt,
        mode: props.mode,
        lesson: props.lessonTitle,
        sectionId: props.sectionId,
        instructions: t(askKey),
      });
    }
    const askKey = student ? 'section.copyRefAskStudent' : 'section.copyRefAsk';
    return buildSectionReference({
      sectionId: props.sectionId,
      title: props.title,
      kind: props.kind,
      mode: props.mode,
      lesson: props.lessonTitle,
      instructions: t(askKey),
    });
  }

  async function onCopy() {
    const reference = buildReference();
    const ok = await copyText(reference);
    if (ok) {
      setStatus('copied');
      dialogRef.current?.close();
      return;
    }
    setStatus('fail');
    setDraft(reference);
  }

  const label =
    status === 'copied'
      ? t('landing.ctaCopied')
      : status === 'fail'
        ? t('landing.ctaCopyFail')
        : t('section.copyRef');

  const quizId = props.target === 'quiz' ? props.quizId : undefined;
  const sectionId = props.target === 'quiz' ? props.sectionId : props.sectionId;

  return (
    <>
      <button
        type="button"
        className={`copy-ref-btn ${status === 'copied' ? 'is-copied' : ''}`.trim()}
        data-section-ref={quiz ? undefined : sectionId}
        data-quiz-ref={quizId}
        data-section-ref-mode={props.mode}
        title={hint}
        aria-label={t(quiz ? 'quiz.copyRefAria' : 'section.copyRefAria')}
        aria-live="polite"
        onClick={() => void onCopy()}
      >
        {label}
      </button>
      {draft ? (
        <dialog
          ref={dialogRef}
          className="landing-copy-dialog"
          onClose={() => setDraft('')}
        >
          <form method="dialog" className="landing-copy-dialog-inner">
            <h2>{t(quiz ? 'quiz.copyRefDialogTitle' : 'section.copyRefDialogTitle')}</h2>
            <p>{hint}</p>
            <textarea ref={textRef} readOnly value={draft} rows={12} spellCheck={false} />
            <div className="landing-copy-dialog-actions">
              <button type="button" className="landing-btn landing-btn-forest" onClick={() => void onCopy()}>
                {t('section.copyRef')}
              </button>
              <button type="submit" className="landing-btn landing-btn-ghost">
                {t('landing.ctaCopyDialogClose')}
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
