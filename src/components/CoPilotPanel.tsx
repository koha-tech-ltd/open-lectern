import { CopilotActivityList, copilotNowTitle } from '@/components/CopilotActivityCard';
import { CopyAgentPromptButton } from '@/components/CopyAgentPromptButton';
import { LecternMascot } from '@/components/LecternMascot';
import { useCopilotMascotMood } from '@/hooks/useCopilotMascotMood';
import type { AgentActivityEvent } from '@/lib/agent-activity';
import {
  type AutomationEvidence,
  type BrowserAutomationProbe,
} from '@/lib/browser-automation';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import type { LessonMode } from '@/types/lesson';

const EVIDENCE_KEYS: Record<AutomationEvidence, MessageKey> = {
  'navigator.webdriver': 'copilot.evidence.webdriver',
  'navigator.webdriver.prototype': 'copilot.evidence.webdriverProto',
  'cursor-agent-browser': 'copilot.evidence.cursor',
  'headless-chrome': 'copilot.evidence.headless',
  chromedriver: 'copilot.evidence.chromedriver',
  playwright: 'copilot.evidence.playwright',
  selenium: 'copilot.evidence.selenium',
  'dom-automation': 'copilot.evidence.dom',
};

export function CoPilotPanel({
  events,
  active,
  isBusy,
  webmcpStatus,
  webmcpDetail,
  toolCount,
  automation,
  onClearHistory,
  mode = 'teacher',
  viewId = null,
  canRestore = false,
  onRestore,
  onReturnToCurrent,
}: {
  events: AgentActivityEvent[];
  active: AgentActivityEvent | null;
  isBusy: boolean;
  webmcpStatus: 'idle' | 'ready' | 'missing' | 'error';
  webmcpDetail: string;
  toolCount: number;
  automation: BrowserAutomationProbe;
  onClearHistory: () => void;
  mode?: LessonMode;
  viewId?: string | null;
  canRestore?: boolean;
  onRestore?: (eventId: string) => void;
  onReturnToCurrent?: () => void;
}) {
  const { t } = useI18n();
  const hasHistory = events.length > 0;
  const viewingHistory = Boolean(viewId && events[0] && events[0].id !== viewId);
  const evidenceLine = describeEvidence(automation.evidence, t);
  const mascot = useCopilotMascotMood({
    isBusy,
    hasCalls: hasHistory,
    webmcpStatus,
    latest: active ?? events[0] ?? null,
  });
  const status = resolveCopilotStatus({
    isBusy,
    hasCalls: hasHistory,
    webmcpStatus,
    automation,
    t,
    evidenceLine,
  });

  return (
    <aside
      className="flex flex-col rounded-xl border border-walnut/10 bg-forest text-cream shadow-lectern"
      data-lectern-target="copilot"
      data-lectern-automation={automation.controlled ? 'on' : 'off'}
      data-lectern-automation-kind={automation.kind}
      data-lectern-webdriver={automation.webdriver === null ? 'unknown' : String(automation.webdriver)}
    >
      <div className="border-b border-cream/10 px-4 pb-3 pt-5">
        <div className="flex flex-col items-center">
          <button
            type="button"
            className="lectern-mascot-hit lectern-mascot-hit-hero"
            onClick={() => mascot.nudge()}
            aria-label={t('copilot.mascotWave')}
          >
            <LecternMascot
              state={mascot.mood}
              size="hero"
              alt={t('copilot.mascotAlt')}
              onEnded={mascot.clearOneShot}
            />
          </button>
          <div className="mt-3 w-full min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg">{t('copilot.title')}</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${status.badgeClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                {status.badge}
              </span>
            </div>
            <p className="mt-2 text-sm text-cream/75">
              {isBusy && active
                ? t('copilot.now', { title: copilotNowTitle(active, t) })
                : webmcpStatus === 'ready'
                  ? status.detail
                  : webmcpDetail}
            </p>
            {webmcpStatus === 'ready' ? (
              <>
                <p className="mt-1 font-mono text-[11px] text-cream/45">{status.meta(toolCount)}</p>
                <p className="mt-1 text-[11px] text-cream/45">
                  {automation.controlled
                    ? t('copilot.detectedVia', { evidence: evidenceLine })
                    : t('copilot.historySaved')}
                </p>
              </>
            ) : automation.controlled ? (
              <p className="mt-1 font-mono text-[11px] text-cream/45">
                {t('copilot.automationDetectedVia', { evidence: evidenceLine })}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {hasHistory ? (
        <div className="min-h-0 flex-1 space-y-2 px-4 py-3">
          {viewingHistory ? (
            <div className="rounded-md border border-brass/35 bg-brass/10 px-3 py-2 text-xs text-cream/80">
              <p>{t('copilot.history.banner')}</p>
              {onReturnToCurrent ? (
                <button
                  type="button"
                  className="mt-2 font-mono text-[10px] uppercase tracking-wide text-brass underline-offset-2 hover:underline"
                  onClick={onReturnToCurrent}
                >
                  {t('copilot.history.bannerReturn')}
                </button>
              ) : null}
            </div>
          ) : null}
          <div
            className="copilot-activity-scroll"
            role="log"
            aria-label={t('copilot.activityRegion')}
            aria-live="polite"
          >
            <CopilotActivityList
              events={events}
              viewId={viewId}
              canRestore={canRestore}
              onRestore={onRestore}
              onReturnToCurrent={onReturnToCurrent}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3 px-4 py-3 text-sm text-cream/55">
          <p>{t('copilot.noCalls')}</p>
          <div className="copilot-empty-cta">
            <CopyAgentPromptButton mode={mode} />
          </div>
          {webmcpStatus === 'ready' ? <p className="text-cream/75">{status.emptyHint}</p> : null}
        </div>
      )}

      {hasHistory ? (
        <div className="border-t border-cream/10 px-4 py-2 text-end">
          <button type="button" className="text-xs text-cream/60 underline-offset-2 hover:text-cream hover:underline" onClick={onClearHistory}>
            {t('copilot.clearActivity')}
          </button>
        </div>
      ) : null}

      {webmcpStatus === 'missing' ? (
        <div className="border-t border-cream/10 px-4 py-3 text-xs text-cream/70">
          {t('copilot.missingHint')}
        </div>
      ) : null}
    </aside>
  );
}

function describeEvidence(
  evidence: AutomationEvidence[],
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): string {
  if (evidence.length === 0) return t('copilot.evidence.none');
  return evidence.map((item) => t(EVIDENCE_KEYS[item])).join(' · ');
}

function resolveCopilotStatus({
  isBusy,
  hasCalls,
  webmcpStatus,
  automation,
  t,
  evidenceLine,
}: {
  isBusy: boolean;
  hasCalls: boolean;
  webmcpStatus: 'idle' | 'ready' | 'missing' | 'error';
  automation: BrowserAutomationProbe;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  evidenceLine: string;
}): {
  badge: string;
  badgeClass: string;
  dotClass: string;
  detail: string;
  emptyHint: string;
  meta: (toolCount: number) => string;
} {
  const live = 'bg-brass/30 text-brass';
  const ready = 'bg-cream/10 text-cream/80';
  const off = 'bg-walnut/40 text-cream/70';
  const pulse = 'animate-pulse bg-brass';
  const on = 'bg-brass';
  const dim = 'bg-cream/40';
  const host = hostCopy(automation, t);
  const automationMeta = automation.controlled
    ? evidenceLine
    : automation.webdriver === false
      ? t('copilot.line.webdriverFalse')
      : t('copilot.line.notReported');

  if (isBusy) {
    return {
      badge: t('copilot.badge.active'),
      badgeClass: live,
      dotClass: pulse,
      detail: '',
      emptyHint: '',
      meta: (toolCount) => t('copilot.meta.tools', { count: toolCount, line: automationMeta }),
    };
  }

  if (hasCalls) {
    return {
      badge: t('copilot.badge.session'),
      badgeClass: live,
      dotClass: on,
      detail: host.sessionDetail,
      emptyHint: '',
      meta: (toolCount) => t('copilot.meta.tools', { count: toolCount, line: automationMeta }),
    };
  }

  if (automation.controlled) {
    return {
      badge: host.badge,
      badgeClass: live,
      dotClass: on,
      detail: host.detail,
      emptyHint: host.emptyHint,
      meta: (toolCount) => t('copilot.meta.tools', { count: toolCount, line: automationMeta }),
    };
  }

  if (webmcpStatus === 'ready') {
    return {
      badge: t('copilot.badge.ready'),
      badgeClass: ready,
      dotClass: on,
      detail: t('copilot.ready.detail'),
      emptyHint: t('copilot.ready.emptyHint'),
      meta: (toolCount) => t('copilot.meta.noSignal', { count: toolCount }),
    };
  }

  return {
    badge: t('copilot.badge.offline'),
    badgeClass: off,
    dotClass: dim,
    detail: '',
    emptyHint: '',
    meta: () => automationMeta,
  };
}

function hostCopy(
  automation: BrowserAutomationProbe,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): {
  badge: string;
  detail: string;
  emptyHint: string;
  sessionDetail: string;
} {
  switch (automation.kind) {
    case 'chrome-webdriver':
      return {
        badge: t('copilot.badge.automation'),
        detail: t('copilot.host.chrome.detail'),
        emptyHint: t('copilot.host.chrome.emptyHint'),
        sessionDetail: t('copilot.host.chrome.sessionDetail'),
      };
    case 'cursor-agent':
      return {
        badge: t('copilot.badge.agentBrowser'),
        detail: t('copilot.host.cursor.detail'),
        emptyHint: t('copilot.host.cursor.emptyHint'),
        sessionDetail: t('copilot.host.cursor.sessionDetail'),
      };
    case 'headless':
      return {
        badge: t('copilot.badge.headless'),
        detail: t('copilot.host.headless.detail'),
        emptyHint: t('copilot.host.headless.emptyHint'),
        sessionDetail: t('copilot.host.headless.sessionDetail'),
      };
    default:
      return {
        badge: t('copilot.badge.automation'),
        detail: t('copilot.host.default.detail'),
        emptyHint: t('copilot.host.default.emptyHint'),
        sessionDetail: t('copilot.host.default.sessionDetail'),
      };
  }
}
