import { useEffect, useState } from 'react';
import {
  getAgentActivitySnapshot,
  clearAgentActivity,
  subscribeAgentActivity,
  type AgentActivityEvent,
} from '@/lib/agent-activity';

export function useAgentActivity() {
  const [events, setEvents] = useState<AgentActivityEvent[]>(() => getAgentActivitySnapshot().events);
  const [active, setActive] = useState<AgentActivityEvent | null>(
    () => getAgentActivitySnapshot().active,
  );
  const [viewId, setViewId] = useState<string | null>(() => getAgentActivitySnapshot().viewId);
  const [highlightTargets, setHighlightTargets] = useState<string[]>([]);

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    return subscribeAgentActivity((nextEvents, nextActive, nextViewId) => {
      setEvents(nextEvents);
      setActive(nextActive);
      setViewId(nextViewId);
      if (nextActive?.targets.length) {
        setHighlightTargets(nextActive.targets);
        if (clearTimer) clearTimeout(clearTimer);
      } else {
        const last = nextEvents.find((e) => e.phase === 'done' || e.phase === 'error');
        if (last?.targets.length) {
          setHighlightTargets(last.targets);
          if (clearTimer) clearTimeout(clearTimer);
          clearTimer = setTimeout(() => setHighlightTargets([]), 2200);
        }
      }
    });
  }, []);

  return {
    events,
    active,
    viewId,
    highlightTargets,
    isBusy: active?.phase === 'start',
    clear: clearAgentActivity,
  };
}
