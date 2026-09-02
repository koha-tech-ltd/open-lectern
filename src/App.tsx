import { useEffect, useRef, useState } from 'react';
import { AttentionHighlight } from '@/components/AttentionHighlight';
import { CoPilotPanel } from '@/components/CoPilotPanel';
import { DocumentHead } from '@/components/DocumentHead';
import { JourneyStrip } from '@/components/JourneyStrip';
import { LessonEditor } from '@/components/LessonEditor';
import { LessonReader } from '@/components/LessonReader';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { SiteChrome } from '@/components/SiteChrome';
import { useAgentActivity } from '@/hooks/useAgentActivity';
import { useAnalyticsContext } from '@/hooks/useAnalyticsEligibility';
import { useBrowserAutomation } from '@/hooks/useBrowserAutomation';
import { useLessonStore } from '@/hooks/useLessonStore';
import { useWebMcpTools } from '@/hooks/useWebMcpTools';
import { useI18n } from '@/i18n/I18nProvider';
import { checkoutActivity, checkoutActivityHead } from '@/lib/agent-activity';
import { isPdfContinuation, trackPdfContinuation } from '@/lib/pdf-continuation';

export default function App() {
  const { t } = useI18n();
  useAnalyticsContext();
  const store = useLessonStore();
  const webmcp = useWebMcpTools(store);
  const activity = useAgentActivity();
  const automation = useBrowserAutomation();
  const copilotRef = useRef<HTMLDivElement>(null);
  const pdfContinuationTracked = useRef(false);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [fromPdf] = useState(() => isPdfContinuation());

  useEffect(() => {
    if (fromPdf && !pdfContinuationTracked.current) {
      pdfContinuationTracked.current = true;
      trackPdfContinuation('landing');
    }
  }, [fromPdf]);

  const modeLabel = t(store.mode === 'teacher' ? 'chrome.teacher' : 'chrome.student');
  const toolCount = webmcp.toolNames.length;

  const webmcpDetail =
    webmcp.status === 'ready'
      ? t(webmcp.polyfill ? 'webmcp.readyPolyfill' : 'webmcp.readyNative', {
          count: toolCount,
          mode: modeLabel,
        })
      : webmcp.status === 'missing'
        ? t('webmcp.missing')
        : webmcp.status === 'error'
          ? webmcp.error || t('webmcp.error')
          : t('webmcp.checking');

  const copilot = (
    <div ref={copilotRef}>
      <CoPilotPanel
        events={activity.events}
        active={activity.active}
        isBusy={activity.isBusy}
        webmcpStatus={webmcp.status}
        webmcpDetail={webmcpDetail}
        toolCount={toolCount}
        automation={automation}
        onClearHistory={activity.clear}
        mode={store.mode}
        viewId={activity.viewId}
        canRestore={store.mode === 'teacher'}
        onRestore={(eventId) => {
          void checkoutActivity(eventId).then((result) => {
            if (result.ok) store.applyHistoryLesson(result.lesson);
          });
        }}
        onReturnToCurrent={() => {
          void checkoutActivityHead().then((result) => {
            if (result.ok) store.applyHistoryLesson(result.lesson);
          });
        }}
      />
    </div>
  );

  const scrollToCopilot = () => {
    copilotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToMarks = () => {
    const target =
      document.querySelector('.manuscript-section-footer') ??
      document.querySelector('[data-lectern-target="annotations"]');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToExport = () => {
    document
      .querySelector('[data-lectern-target="publish"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <SiteChrome
      mode={store.mode}
      onMode={store.setMode}
      onHowItWorks={() => setOnboardingOpen(true)}
      toolNames={webmcp.toolNames.length > 0 ? webmcp.toolNames : undefined}
    >
      <DocumentHead page="studio" />
      <AttentionHighlight targets={activity.highlightTargets} />

      {store.mode === 'teacher' ? (
        <LessonEditor store={store} copilotSlot={copilot} />
      ) : (
        <LessonReader store={store} copilotSlot={copilot} fromPdf={fromPdf} />
      )}

      <JourneyStrip
        key={store.mode}
        mode={store.mode}
        onOpenCopilotHint={scrollToCopilot}
        onPublish={scrollToExport}
        onOpenMarkHint={scrollToMarks}
      />

      <OnboardingOverlay
        mode={store.mode}
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onStartBlank={() => store.newLesson()}
        onLoadDemo={() => store.loadDemo('photosynthesis')}
        onLoadWebMcpDemo={() => store.loadDemo('webmcp')}
      />
    </SiteChrome>
  );
}
