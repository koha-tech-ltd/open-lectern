import { useEffect, useState } from 'react';
import {
  markOnboardingComplete,
  type OnboardingMode,
} from '@/lib/onboarding';
import { LECTERN_MEDIA } from '@/lib/media';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';

const TEACHER_STEPS: ReadonlyArray<{ title: MessageKey; body: MessageKey; media: keyof typeof LECTERN_MEDIA }> = [
  { title: 'onboarding.teacher.step1.title', body: 'onboarding.teacher.step1.body', media: 'draft' },
  { title: 'onboarding.teacher.step2.title', body: 'onboarding.teacher.step2.body', media: 'copilot' },
  { title: 'onboarding.teacher.step3.title', body: 'onboarding.teacher.step3.body', media: 'publish' },
];

const STUDENT_STEPS: ReadonlyArray<{ title: MessageKey; body: MessageKey; media: keyof typeof LECTERN_MEDIA }> = [
  { title: 'onboarding.student.step1.title', body: 'onboarding.student.step1.body', media: 'student' },
  { title: 'onboarding.student.step2.title', body: 'onboarding.student.step2.body', media: 'mark' },
  { title: 'onboarding.student.step3.title', body: 'onboarding.student.step3.body', media: 'copilot' },
];

export function OnboardingOverlay({
  mode,
  open,
  onClose,
  onStartBlank,
  onLoadDemo,
  onLoadWebMcpDemo,
}: {
  mode: OnboardingMode;
  open: boolean;
  onClose: () => void;
  onStartBlank?: () => void;
  onLoadDemo?: () => void;
  onLoadWebMcpDemo?: () => void;
}) {
  const { t } = useI18n();
  const steps = mode === 'teacher' ? TEACHER_STEPS : STUDENT_STEPS;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open, mode]);

  if (!open) return null;

  const isLast = step >= steps.length - 1;
  const current = steps[step];
  const media = LECTERN_MEDIA[current.media];
  const mediaAltKey = `media.${current.media}.alt` as MessageKey;

  const finish = (action?: 'blank' | 'demo' | 'webmcp') => {
    markOnboardingComplete(mode);
    if (action === 'blank') onStartBlank?.();
    if (action === 'demo') onLoadDemo?.();
    if (action === 'webmcp') onLoadWebMcpDemo?.();
    onClose();
    setStep(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lectern-onboarding-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-walnut/15 bg-ivory shadow-lectern"
      >
        <div className="aspect-[16/10] overflow-hidden bg-cream sm:aspect-[2/1]">
          <img src={media.src} alt={t(mediaAltKey)} className="h-full w-full object-cover" />
        </div>
        <div className="p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ochre">
            {t('onboarding.progress', {
              mode: t(mode === 'teacher' ? 'chrome.teacher' : 'chrome.student'),
              step: step + 1,
              total: steps.length,
            })}
          </p>
          <h2
            id="lectern-onboarding-title"
            className="mt-2 font-display text-2xl text-forest sm:text-3xl"
          >
            {t(current.title)}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-walnut sm:text-base">{t(current.body)}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {!isLast ? (
              <>
                <button
                  type="button"
                  className="rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-cream"
                  onClick={() => setStep((s) => s + 1)}
                >
                  {t('onboarding.next')}
                </button>
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm text-walnut underline-offset-2 hover:underline"
                  onClick={() => finish()}
                >
                  {t('onboarding.skip')}
                </button>
              </>
            ) : mode === 'teacher' ? (
              <>
                <button
                  type="button"
                  className="rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-cream"
                  onClick={() => finish('blank')}
                >
                  {t('onboarding.startBlank')}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-walnut/20 bg-cream px-4 py-2.5 text-sm font-semibold text-forest"
                  onClick={() => finish('demo')}
                >
                  {t('onboarding.loadPhotosynthesis')}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-forest/25 bg-forest/10 px-4 py-2.5 text-sm font-semibold text-forest"
                  onClick={() => finish('webmcp')}
                >
                  {t('onboarding.loadWebmcp')}
                </button>
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm text-walnut underline-offset-2 hover:underline"
                  onClick={() => finish()}
                >
                  {t('onboarding.skip')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-md bg-forest px-4 py-2.5 text-sm font-semibold text-cream"
                onClick={() => finish()}
              >
                {t('onboarding.gotIt')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
