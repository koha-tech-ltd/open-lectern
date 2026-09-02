/**
 * Timeline for the single Google Flow states reel:
 * `public/mascots/states/lectern-states.mp4` (24fps, 240 frames / 10s).
 *
 * Same layout as LIA: anchors split five segments. Playing a state plays to its
 * end rest, then idle holds that last emotion frame (does not jump back to 0).
 * Playback is muted — the reel soundtrack is too repetitive for a looping copilot.
 */

export const LECTERN_STATES_SRC = '/mascots/states/lectern-states.mp4';
/** First decoded frame of `lectern-states.mp4` — keep in sync when replacing the reel. */
export const LECTERN_STATES_POSTER = '/mascots/states/lectern-states-poster.webp';
export const LECTERN_STATES_FPS = 24;

/** Home / idle rest pose. */
export const LECTERN_IDLE_FRAME = 0;

/** One-shot rest: freeze this much before the segment `to` frame. */
export const LECTERN_IDLE_STOP_EARLY_S = 0.1;

/**
 * Rest-pose frames (0-indexed) between segments.
 * Calibrated to this reel: LIA’s 136 / 189 / 232 land ~4 frames into the next beat
 * (wing already up). Park 4 frames earlier so cheer/wave freeze with wings down.
 */
export const LECTERN_ANCHORS = [0, 40, 93, 132, 185, 228] as const;

/** Mid-pose where listen freezes while waiting for the first tool call. */
export const LECTERN_LISTEN_HOLD_FRAME = 114;

export type LecternMascotState =
  | 'still'
  | 'breathe'
  | 'talk'
  | 'listen'
  | 'listenEnd'
  | 'cheer'
  | 'wave';

export type LecternStateSegment = {
  from: number;
  to: number;
  loop: boolean;
  hold?: number;
};

export const LECTERN_STATE_SEGMENTS: Record<Exclude<LecternMascotState, 'still'>, LecternStateSegment> =
  {
    breathe: { from: 0, to: 40, loop: false },
    talk: { from: 40, to: 93, loop: true },
    listen: { from: 93, to: 132, loop: false, hold: LECTERN_LISTEN_HOLD_FRAME },
    listenEnd: { from: LECTERN_LISTEN_HOLD_FRAME, to: 132, loop: false },
    cheer: { from: 132, to: 185, loop: false },
    wave: { from: 185, to: 228, loop: false },
  };

export function frameToTime(frame: number, fps = LECTERN_STATES_FPS): number {
  return frame / fps;
}

export function restFrameFor(frame: number, fps = LECTERN_STATES_FPS): number {
  return frame - LECTERN_IDLE_STOP_EARLY_S * fps;
}
