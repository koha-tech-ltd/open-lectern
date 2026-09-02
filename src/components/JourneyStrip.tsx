import { useId, useState } from 'react';
import { MediaCta } from '@/components/MediaCta';
import { useI18n } from '@/i18n/I18nProvider';
import { isJourneyCollapsed, setJourneyCollapsed } from '@/lib/journey';
import type { LecternMediaId } from '@/lib/media';

const TEACHER_JOURNEY: LecternMediaId[] = ['draft', 'copilot', 'publish'];
const STUDENT_JOURNEY: LecternMediaId[] = ['student', 'mark', 'copilot'];

export function JourneyStrip({
  mode,
  onOpenCopilotHint,
  onPublish,
  onOpenMarkHint,
}: {
  mode: 'teacher' | 'student';
  onOpenCopilotHint?: () => void;
  onPublish?: () => void;
  onOpenMarkHint?: () => void;
}) {
  const { t } = useI18n();
  const panelId = useId();
  const ids = mode === 'teacher' ? TEACHER_JOURNEY : STUDENT_JOURNEY;
  const [collapsed, setCollapsed] = useState(() => isJourneyCollapsed(mode));

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setJourneyCollapsed(mode, next);
  };

  return (
    <section className={collapsed ? 'mt-auto pt-6' : 'mt-auto pt-10'} aria-label={t('journey.aria')}>
      <div className={`flex items-center justify-between gap-3 ${collapsed ? '' : 'mb-3'}`}>
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-ochre">{t('journey.easyPath')}</h2>
        <button
          type="button"
          className="shrink-0 rounded-md border border-walnut/15 bg-cream px-2.5 py-1 text-xs font-medium text-forest hover:bg-walnut/5"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={toggleCollapsed}
        >
          {collapsed ? t('journey.show') : t('journey.acknowledge')}
        </button>
      </div>
      {collapsed ? null : (
        <div id={panelId} className="grid gap-3 sm:grid-cols-3">
          {ids.map((id) => {
            let actionLabel: string | undefined;
            let onAction: (() => void) | undefined;
            if (id === 'copilot' && onOpenCopilotHint) {
              actionLabel = t('journey.seeCopilot');
              onAction = onOpenCopilotHint;
            }
            if (id === 'publish' && onPublish) {
              actionLabel = t('journey.publishLink');
              onAction = onPublish;
            }
            if (id === 'mark' && onOpenMarkHint) {
              actionLabel = t('journey.leaveMark');
              onAction = onOpenMarkHint;
            }
            return (
              <MediaCta
                key={id}
                id={id}
                actionLabel={actionLabel}
                onAction={onAction}
                compact
                blurb={
                  id === 'copilot' && mode === 'student' ? t('journey.copilotStudentBlurb') : undefined
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
