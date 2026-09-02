import { useEffect, useRef, useState } from 'react';
import {
  LECTERN_IDLE_FRAME,
  LECTERN_STATES_FPS,
  LECTERN_STATES_POSTER,
  LECTERN_STATES_SRC,
  LECTERN_STATE_SEGMENTS,
  frameToTime,
  restFrameFor,
  type LecternMascotState,
} from '@/components/lectern-mascot-timeline';

export type { LecternMascotState } from '@/components/lectern-mascot-timeline';

type Size = 'sm' | 'md' | 'lg' | 'hero' | 'showcase';

type Props = {
  state: LecternMascotState;
  size?: Size;
  className?: string;
  alt?: string;
  onEnded?: () => void;
};

function prepareInlineVideo(video: HTMLVideoElement): void {
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.001) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', finish);
      window.clearTimeout(fallback);
      resolve();
    };

    const fallback = window.setTimeout(finish, 400);
    video.addEventListener('seeked', finish);
    try {
      video.currentTime = time;
    } catch {
      finish();
    }
  });
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Single-reel mascot: pause on anchors between moods; on state change,
 * seek to the segment start, play to hold/end, then pause.
 * Playback is muted.
 */
export function LecternMascot({
  state,
  size = 'md',
  className = '',
  alt = 'Lectern owl',
  onEnded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ending = useRef(onEnded);
  ending.current = onEnded;
  const ready = useRef(false);
  const runId = useRef(0);
  const prevState = useRef<LecternMascotState>(state);
  const lastPark = useRef(0);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    prepareInlineVideo(video);
  }, [videoOk]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoOk) return;

    const id = ++runId.current;
    let raf = 0;
    let cancelled = false;
    const previous = prevState.current;
    prevState.current = state;

    const stopWatch = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const holdAt = (target: number) => {
      video.pause();
      // Decoder frames already in flight can present after pause; snap back.
      if (video.currentTime > target + 0.5 / LECTERN_STATES_FPS) {
        try {
          video.currentTime = target;
        } catch {
          // Ignore seek rejection; pause still stops forward motion.
        }
        video.pause();
      }
    };

    const parkAt = async (frame: number) => {
      stopWatch();
      prepareInlineVideo(video);
      lastPark.current = frame;
      const target = frameToTime(frame);
      video.pause();
      await seekTo(video, target);
      if (cancelled || runId.current !== id) return;
      holdAt(target);
      if (Math.abs(video.currentTime - target) > 0.08) {
        await seekTo(video, target);
        if (cancelled || runId.current !== id) return;
      }
      holdAt(target);
      await nextPaint();
      if (cancelled || runId.current !== id) return;
      holdAt(target);
    };

    const watchUntil = (targetFrame: number, opts: { from: number; loop: boolean; fireEnded: boolean }) => {
      stopWatch();
      const restFrame = opts.fireEnded ? restFrameFor(targetFrame) : targetFrame;
      const endTime = frameToTime(restFrame) - 0.5 / LECTERN_STATES_FPS;

      const tick = () => {
        if (cancelled || runId.current !== id) return;
        if (video.currentTime >= endTime) {
          if (opts.loop) {
            video.currentTime = frameToTime(opts.from);
            void video.play().catch(() => undefined);
            raf = requestAnimationFrame(tick);
            return;
          }
          video.pause();
          void parkAt(restFrame).then(() => {
            if (!cancelled && runId.current === id && opts.fireEnded) ending.current?.();
          });
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    };

    const playFromTo = async (
      from: number,
      to: number,
      opts: { loop: boolean; fireEnded: boolean; skipSeek?: boolean },
    ) => {
      prepareInlineVideo(video);
      if (!opts.skipSeek) {
        await seekTo(video, frameToTime(from));
        if (cancelled || runId.current !== id) return;
      } else {
        stopWatch();
      }
      if (cancelled || runId.current !== id) return;
      try {
        await video.play();
      } catch {
        await new Promise((r) => window.setTimeout(r, 50));
        if (cancelled || runId.current !== id) return;
        try {
          await video.play();
        } catch {
          return;
        }
      }
      if (cancelled || runId.current !== id) return;
      watchUntil(to, { from, loop: opts.loop, fireEnded: opts.fireEnded });
    };

    const run = async () => {
      prepareInlineVideo(video);
      if (!ready.current) {
        if (video.readyState < 1) {
          await new Promise<void>((resolve) => {
            const onMeta = () => {
              video.removeEventListener('loadedmetadata', onMeta);
              resolve();
            };
            video.addEventListener('loadedmetadata', onMeta);
            video.addEventListener('error', () => resolve(), { once: true });
          });
        }
        ready.current = true;
        if (state === 'still') {
          await parkAt(LECTERN_IDLE_FRAME);
          return;
        }
      }
      if (cancelled || runId.current !== id) return;

      if (state === 'still') {
        stopWatch();
        video.pause();
        if (lastPark.current > 0) {
          await parkAt(lastPark.current);
        } else if (video.currentTime < 0.02) {
          await parkAt(LECTERN_IDLE_FRAME);
        }
        return;
      }

      const segment = LECTERN_STATE_SEGMENTS[state];

      if (state === 'listen' && segment.hold != null) {
        await playFromTo(segment.from, segment.hold, { loop: false, fireEnded: false });
        return;
      }

      if (state === 'listenEnd') {
        const skipSeek = previous === 'listen';
        await playFromTo(segment.from, segment.to, {
          loop: false,
          fireEnded: true,
          skipSeek,
        });
        return;
      }

      await playFromTo(segment.from, segment.to, {
        loop: segment.loop,
        fireEnded: !segment.loop,
      });
    };

    void run();

    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [state, videoOk]);

  return (
    <div
      className={`lectern-mascot lectern-mascot-${size}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={alt}
    >
      <div className="lectern-mascot-stage">
        <img className="lectern-mascot-poster" src={LECTERN_STATES_POSTER} alt="" draggable={false} />
        {videoOk ? (
          <video
            ref={videoRef}
            className="is-active"
            src={LECTERN_STATES_SRC}
            poster={LECTERN_STATES_POSTER}
            muted
            playsInline
            preload="auto"
            controls={false}
            disableRemotePlayback
            onError={() => setVideoOk(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
