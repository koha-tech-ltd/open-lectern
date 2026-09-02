import { useEffect, useRef, useState } from 'react';
import type { LecternMascotState } from '@/components/LecternMascot';
import type { AgentActivityEvent } from '@/lib/agent-activity';

function randomBetween(minMs: number, maxMs: number): number {
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

/**
 * Maps Co-pilot WebMCP status onto the owl reel (same moods as LIA).
 */
export function useCopilotMascotMood(input: {
  isBusy: boolean;
  hasCalls: boolean;
  webmcpStatus: 'idle' | 'ready' | 'missing' | 'error';
  latest: AgentActivityEvent | null;
}): {
  mood: LecternMascotState;
  clearOneShot: () => void;
  nudge: () => boolean;
} {
  const [oneShot, setOneShot] = useState<LecternMascotState | null>(null);
  const lastHandled = useRef<string | null>(null);

  useEffect(() => {
    const event = input.latest;
    if (!event) return;
    const key = `${event.id}-${event.phase}`;
    if (lastHandled.current === key) return;
    lastHandled.current = key;
    if (event.phase === 'done') setOneShot('cheer');
    if (event.phase === 'error') setOneShot('wave');
  }, [input.latest]);

  useEffect(() => {
    if (input.webmcpStatus === 'missing' || input.webmcpStatus === 'error') {
      setOneShot('wave');
    }
  }, [input.webmcpStatus]);

  const busy = input.isBusy || oneShot !== null;

  useEffect(() => {
    if (busy || input.webmcpStatus !== 'ready') return;
    const id = window.setTimeout(() => setOneShot('breathe'), randomBetween(4000, 9000));
    return () => window.clearTimeout(id);
  }, [busy, input.webmcpStatus, oneShot]);

  const nudge = () => {
    if (input.isBusy) return false;
    setOneShot('wave');
    return true;
  };

  const mood: LecternMascotState = input.isBusy
    ? 'talk'
    : oneShot
      ? oneShot
      : input.webmcpStatus === 'ready' && !input.hasCalls
        ? 'listen'
        : 'still';

  return {
    mood,
    clearOneShot: () => setOneShot(null),
    nudge,
  };
}

const LANDING_SHOWCASE: ReadonlyArray<LecternMascotState> = [
  'talk',
  'listen',
  'cheer',
  'wave',
  'breathe',
];

/**
 * Landing demo of the same reel as Co-pilot: cycles talk / listen / cheer
 * so visitors see WebMCP moods before they open the studio.
 */
export function useLandingMascotMood(): {
  mood: LecternMascotState;
  clearOneShot: () => void;
  nudge: () => boolean;
} {
  const [mood, setMood] = useState<LecternMascotState>('still');
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const cursor = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    if (mood !== 'still') return;
    const id = window.setTimeout(() => {
      const next = LANDING_SHOWCASE[cursor.current % LANDING_SHOWCASE.length]!;
      cursor.current += 1;
      setMood(next);
    }, randomBetween(2200, 3800));
    return () => window.clearTimeout(id);
  }, [mood, reduceMotion]);

  useEffect(() => {
    if (mood !== 'talk' && mood !== 'listen') return;
    const holdMs = mood === 'talk' ? 3600 : 2600;
    const id = window.setTimeout(() => setMood('still'), holdMs);
    return () => window.clearTimeout(id);
  }, [mood]);

  const nudge = () => {
    setMood('wave');
    return true;
  };

  return {
    mood,
    clearOneShot: () => setMood('still'),
    nudge,
  };
}
