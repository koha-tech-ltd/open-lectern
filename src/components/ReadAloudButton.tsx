import { useEffect, type RefObject } from 'react';
import { useSpeechRead } from '@/hooks/useSpeechRead';
import { useI18n } from '@/i18n/I18nProvider';
import { getSpeechReadSnapshot, stopSpeechRead } from '@/lib/speech-read';

export function ReadAloudButton({
  blockId,
  rootRef,
}: {
  blockId: string;
  rootRef: RefObject<HTMLElement | null>;
}) {
  const { t, locale } = useI18n();
  const speech = useSpeechRead();
  const playing = speech.status === 'speaking' && speech.blockId === blockId;

  useEffect(() => {
    return () => {
      if (getSpeechReadSnapshot().blockId === blockId) stopSpeechRead();
    };
  }, [blockId]);

  if (!speech.supported) {
    return (
      <div className="read-aloud-controls">
        <button type="button" className="read-aloud-cta is-disabled" disabled title={t('reader.readUnsupported')}>
          <ReadAloudIcon playing={false} />
          <span>{t('reader.read')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="read-aloud-controls">
      <button
        type="button"
        className={`read-aloud-cta${playing ? ' is-playing' : ''}`}
        aria-pressed={playing}
        aria-label={playing ? t('reader.readStopAria') : t('reader.readAria')}
        onClick={() => speech.toggle(blockId, rootRef.current, locale)}
      >
        <ReadAloudIcon playing={playing} />
        <span>{playing ? t('reader.readStop') : t('reader.read')}</span>
        {playing ? (
          <span className="read-aloud-bars" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : null}
      </button>
      {playing ? (
        <button
          type="button"
          className={`read-aloud-speed${speech.doubleSpeed ? ' is-on' : ''}`}
          aria-pressed={speech.doubleSpeed}
          aria-label={speech.doubleSpeed ? t('reader.readSpeedOnAria') : t('reader.readSpeedAria')}
          title={speech.doubleSpeed ? t('reader.readSpeedOnAria') : t('reader.readSpeedAria')}
          onClick={() => speech.setDoubleSpeed(!speech.doubleSpeed)}
        >
          {t('reader.readSpeed')}
        </button>
      ) : null}
    </div>
  );
}

function ReadAloudIcon({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <svg className="read-aloud-icon" viewBox="0 0 20 20" aria-hidden>
        <rect x="5" y="5" width="3.5" height="10" rx="0.8" />
        <rect x="11.5" y="5" width="3.5" height="10" rx="0.8" />
      </svg>
    );
  }
  return (
    <svg className="read-aloud-icon" viewBox="0 0 20 20" aria-hidden>
      <path d="M3.2 7.4h2.3L8.8 4.6a.8.8 0 0 1 1.3.6v9.6a.8.8 0 0 1-1.3.6L5.5 12.6H3.2A1.2 1.2 0 0 1 2 11.4V8.6a1.2 1.2 0 0 1 1.2-1.2Z" />
      <path
        d="M12.6 7.1c.7.7 1.1 1.7 1.1 2.9s-.4 2.2-1.1 2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M14.8 5.3c1.3 1.3 2 3 2 4.7s-.7 3.4-2 4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
