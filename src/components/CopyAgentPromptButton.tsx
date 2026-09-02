import { useEffect, useRef, useState } from 'react';
import { site } from '@/content/site';
import { useI18n } from '@/i18n/I18nProvider';
import { copyText } from '@/lib/clipboard';
import type { LessonMode } from '@/types/lesson';

function promptUrl(mode: LessonMode): string {
  if (typeof window === 'undefined') {
    const q = mode === 'student' ? '?mode=student' : '';
    return `${site.url}${site.studioPath}${q}`;
  }
  const current = new URL(window.location.href);
  const onStudio =
    current.pathname === site.studioPath || current.pathname.endsWith(site.studioPath);
  if (onStudio) {
    current.searchParams.set('mode', mode);
    return current.toString();
  }
  const url = new URL(`${window.location.origin}${site.studioPath}`);
  if (mode === 'student') url.searchParams.set('mode', 'student');
  return url.toString();
}

export function CopyAgentPromptButton({
  className,
  mode = 'teacher',
}: {
  className?: string;
  mode?: LessonMode;
}) {
  const { t, locale, labels } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<'idle' | 'copied' | 'fail'>('idle');
  const [draft, setDraft] = useState('');
  const student = mode === 'student';
  const hint = t(student ? 'landing.ctaCopyPromptHintStudent' : 'landing.ctaCopyPromptHint');

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

  function buildPrompt(): string {
    const ask = t(student ? 'landing.agentPromptStudentAsk' : 'landing.agentPromptAsk');
    return t(student ? 'landing.agentPromptStudent' : 'landing.agentPrompt', {
      url: promptUrl(mode),
      locale,
      language: labels[locale],
      ask,
    });
  }

  async function onCopy() {
    const prompt = buildPrompt();
    const ok = await copyText(prompt);
    if (ok) {
      setStatus('copied');
      dialogRef.current?.close();
      return;
    }
    setStatus('fail');
    setDraft(prompt);
  }

  const label =
    status === 'copied'
      ? t('landing.ctaCopied')
      : status === 'fail'
        ? t('landing.ctaCopyFail')
        : t('landing.ctaCopyPrompt');

  return (
    <>
      <button
        type="button"
        className={`landing-btn landing-btn-copy ${status === 'copied' ? 'is-copied' : ''} ${className ?? ''}`.trim()}
        data-agent-prompt-mode={mode}
        onClick={() => void onCopy()}
        aria-live="polite"
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
            <h2>{t('landing.ctaCopyDialogTitle')}</h2>
            <p>{hint}</p>
            <textarea ref={textRef} readOnly value={draft} rows={12} spellCheck={false} />
            <div className="landing-copy-dialog-actions">
              <button type="button" className="landing-btn landing-btn-forest" onClick={() => void onCopy()}>
                {t('landing.ctaCopyPrompt')}
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
