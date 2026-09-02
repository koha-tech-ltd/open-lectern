import { useId, useState } from 'react';
import {
  collapseActivityEvents,
  foldTitle,
  formatActivityDay,
  formatActivityTime,
  historyRole,
  humanToolTitle,
  type AgentActivityEvent,
  type HistoryRole,
  type UserActivityAction,
} from '@/lib/agent-activity';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';

const PHASE_KEYS: Record<AgentActivityEvent['phase'], MessageKey> = {
  start: 'copilot.phase.start',
  done: 'copilot.phase.done',
  error: 'copilot.phase.error',
};

const USER_TITLE_KEYS: Record<UserActivityAction, MessageKey> = {
  'section.edit': 'copilot.user.section.edit',
  'section.add': 'copilot.user.section.add',
  'section.remove': 'copilot.user.section.remove',
  'meta.edit': 'copilot.user.meta.edit',
  'quiz.edit': 'copilot.user.quiz.edit',
  'quiz.add': 'copilot.user.quiz.add',
  'quiz.remove': 'copilot.user.quiz.remove',
  'media.add': 'copilot.user.media.add',
  'media.remove': 'copilot.user.media.remove',
  'media.caption': 'copilot.user.media.caption',
  publish: 'copilot.user.publish',
  import: 'copilot.user.import',
  annotation: 'copilot.user.annotation',
  'project.open': 'copilot.user.project.open',
};

function userActionFromTool(tool: string): UserActivityAction | null {
  if (!tool.startsWith('user.')) return null;
  const action = tool.slice('user.'.length);
  return action in USER_TITLE_KEYS ? (action as UserActivityAction) : null;
}

function cardClassName(event: AgentActivityEvent, role: HistoryRole): string {
  const viewing = role === 'viewing' ? ' agent-event-viewing' : '';
  const future = role === 'future' ? ' agent-event-future' : '';
  if (event.source === 'user') {
    return `agent-event agent-event-user rounded-md border px-3 py-2 text-sm${viewing}${future}`;
  }
  if (event.phase === 'start') {
    return `agent-event rounded-md border border-brass/40 bg-brass/15 px-3 py-2 text-sm${viewing}${future}`;
  }
  if (event.phase === 'error') {
    return `agent-event rounded-md border border-red-300/30 bg-red-950/20 px-3 py-2 text-sm${viewing}${future}`;
  }
  return `agent-event rounded-md border border-cream/10 bg-cream/5 px-3 py-2 text-sm${viewing}${future}`;
}

export function CopilotActivityList({
  events,
  viewId,
  canRestore = false,
  onRestore,
  onReturnToCurrent,
}: {
  events: AgentActivityEvent[];
  viewId?: string | null;
  canRestore?: boolean;
  onRestore?: (eventId: string) => void;
  onReturnToCurrent?: () => void;
}) {
  const { locale } = useI18n();
  const rows = collapseActivityEvents(events);
  const groups: { day: string; items: AgentActivityEvent[] }[] = [];
  for (const event of rows) {
    const day = formatActivityDay(event.startedAt ?? event.at, locale);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(event);
    else groups.push({ day, items: [event] });
  }
  return (
    <>
      {groups.map((group) => (
        <section key={group.day} className="space-y-2">
          <h4 className="sticky top-0 z-[1] bg-forest/95 py-1 font-mono text-[10px] uppercase tracking-wide text-brass/80">
            {group.day}
          </h4>
          {group.items.map((event) => (
            <CopilotActivityCard
              key={event.id}
              event={event}
              role={historyRole(events, viewId ?? null, event.id)}
              isNewest={events[0]?.id === event.id}
              olderEventId={events[0]?.id === event.id ? events[1]?.id : undefined}
              canRestore={canRestore}
              onRestore={onRestore}
              onReturnToCurrent={onReturnToCurrent}
            />
          ))}
        </section>
      ))}
    </>
  );
}

function CopilotActivityCard({
  event,
  role,
  isNewest,
  olderEventId,
  canRestore,
  onRestore,
  onReturnToCurrent,
}: {
  event: AgentActivityEvent;
  role: HistoryRole;
  isNewest: boolean;
  olderEventId?: string;
  canRestore: boolean;
  onRestore?: (eventId: string) => void;
  onReturnToCurrent?: () => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const steps = event.steps ?? [];
  const folded = Boolean(event.fold && steps.length > 0);
  const total = Math.max(event.progressTotal ?? steps.length, 1);
  const done = event.phase === 'done' ? total : (event.progressDone ?? steps.filter((step) => step.phase === 'done').length);
  const percent = event.phase === 'error' ? Math.round((done / total) * 100) : Math.min(100, Math.round((done / total) * 100));
  const indeterminate = event.phase === 'start' && total <= 1;
  const userAction = event.source === 'user' ? userActionFromTool(event.tool) : null;
  const title = userAction
    ? t(USER_TITLE_KEYS[userAction])
    : event.fold === 'amdp'
      ? t('copilot.fold.amdp')
      : event.fold === 'json-chunk'
        ? t('copilot.fold.jsonChunk')
        : event.title;
  const pipeline =
    event.fold === 'amdp' ? t('copilot.fold.pipeline') : event.fold === 'json-chunk' ? t('copilot.fold.pipelineChunk') : event.summary;
  const performedAt = formatActivityTime(event.startedAt ?? event.at, locale);
  const stepBack = role === 'head' && Boolean(olderEventId);
  const showRestore =
    canRestore &&
    event.phase === 'done' &&
    role !== 'viewing' &&
    (stepBack || role === 'past' || role === 'future');

  return (
    <div className={cardClassName(event, role)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-cream">{title}</span>
        <span className="font-mono text-[10px] uppercase text-cream/50">
          {role === 'viewing'
            ? t('copilot.history.viewing')
            : role === 'future'
              ? t('copilot.history.later')
              : event.source === 'user'
                ? t('copilot.source.you')
                : t(PHASE_KEYS[event.phase])}
        </span>
      </div>
      <time className="mt-0.5 block font-mono text-[10px] text-brass/80" dateTime={new Date(event.startedAt ?? event.at).toISOString()}>
        {performedAt}
      </time>
      {folded ? (
        <>
          <p className="mt-0.5 text-xs text-cream/65">{pipeline}</p>
          <div
            className={`agent-event-progress mt-2 ${indeterminate ? 'agent-event-progress-indeterminate' : ''}`}
            role="progressbar"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : percent}
            aria-valuetext={event.summary}
          >
            <span style={indeterminate ? undefined : { width: `${percent}%` }} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-cream/55">
            {event.phase === 'start' && !indeterminate
              ? t('copilot.fold.progress', { percent, summary: event.summary })
              : event.summary}
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-xs text-cream/65">{event.summary}</p>
      )}
      {event.targets.length > 0 ? (
        <p className="mt-1 font-mono text-[10px] text-brass/90" dir="ltr">
          {event.targets.join(' · ')}
        </p>
      ) : null}
      {event.error ? <p className="mt-1 text-xs text-red-200">{event.error}</p> : null}
      {folded && steps.length > 1 ? (
        <div className="mt-2">
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-wide text-cream/55 underline-offset-2 hover:text-cream hover:underline"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? t('copilot.fold.hideSteps') : t('copilot.fold.showSteps', { count: steps.length })}
          </button>
          {open ? (
            <ol id={panelId} className="mt-2 space-y-1 border-t border-cream/10 pt-2">
              {steps.map((step) => (
                <li key={step.id} className="flex items-baseline justify-between gap-2 text-[11px] text-cream/70">
                  <span>
                    {humanToolTitle(step.tool)}
                    <span className="mt-0.5 block font-mono text-[10px] text-cream/45">{step.summary}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-cream/40">{t(PHASE_KEYS[step.phase])}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
      {showRestore ? (
        <div className="agent-event-restore">
          <button
            type="button"
            className="agent-event-restore-link"
            onClick={() => {
              if (stepBack && olderEventId) {
                onRestore?.(olderEventId);
                return;
              }
              if (role === 'future' && isNewest) {
                onReturnToCurrent?.();
                return;
              }
              onRestore?.(event.id);
            }}
          >
            <HistoryRestoreGlyph forward={role === 'future' && isNewest} />
            {stepBack
              ? t('copilot.history.stepBack')
              : role === 'future' && isNewest
                ? t('copilot.history.return')
                : t('copilot.history.restore')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HistoryRestoreGlyph({ forward = false }: { forward?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      {forward ? (
        <path
          d="M12 7H5.5a3.5 3.5 0 1 0 0 7H7M12 7 8.5 3.5M12 7 8.5 10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M4 7h6.5a3.5 3.5 0 1 1 0 7H9M4 7 7.5 3.5M4 7 7.5 10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function copilotNowTitle(event: AgentActivityEvent, t: (key: MessageKey, vars?: Record<string, string | number>) => string): string {
  if (event.fold === 'amdp') return t('copilot.fold.amdp');
  if (event.fold === 'json-chunk') return t('copilot.fold.jsonChunk');
  const userAction = event.source === 'user' ? userActionFromTool(event.tool) : null;
  if (userAction) return t(USER_TITLE_KEYS[userAction]);
  return event.title || foldTitle('amdp');
}
