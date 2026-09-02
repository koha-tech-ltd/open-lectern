import { useCallback, useSyncExternalStore } from 'react';
import type { LocaleCode } from '@/i18n/locales';
import {
  getServerSpeechReadSnapshot,
  getSpeechReadSnapshot,
  isSpeechReadSupported,
  setSpeechDoubleSpeed,
  stopSpeechRead,
  subscribeSpeechRead,
  toggleSpeechRead,
  type SpeechReadSnapshot,
} from '@/lib/speech-read';

export function useSpeechRead(): SpeechReadSnapshot & {
  supported: boolean;
  toggle: (blockId: string, root: HTMLElement | null, locale: LocaleCode) => void;
  setDoubleSpeed: (on: boolean) => void;
  stop: () => void;
} {
  const snapshot = useSyncExternalStore(
    subscribeSpeechRead,
    getSpeechReadSnapshot,
    getServerSpeechReadSnapshot,
  );

  const toggle = useCallback((blockId: string, root: HTMLElement | null, locale: LocaleCode) => {
    if (!root) return;
    void toggleSpeechRead({ blockId, root, locale });
  }, []);

  return {
    ...snapshot,
    supported: isSpeechReadSupported(),
    toggle,
    setDoubleSpeed: setSpeechDoubleSpeed,
    stop: stopSpeechRead,
  };
}
