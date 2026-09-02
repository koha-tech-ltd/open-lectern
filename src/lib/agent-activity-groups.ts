/** Fold consecutive AMDP / json-chunk tool calls into one Co-pilot card. */

export type AgentActivityPhase = 'start' | 'done' | 'error';

export type AgentActivityFold = 'amdp' | 'json-chunk';

export interface AgentActivityStep {
  id: string;
  tool: string;
  phase: AgentActivityPhase;
  summary: string;
  at: number;
}

export interface AgentActivityEvent {
  id: string;
  tool: string;
  title: string;
  phase: AgentActivityPhase;
  summary: string;
  targets: string[];
  scroll: boolean;
  at: number;
  /** First moment this card started (folds keep this while slices land). */
  startedAt?: number;
  error?: string;
  fold?: AgentActivityFold;
  groupKey?: string;
  steps?: AgentActivityStep[];
  progressDone?: number;
  progressTotal?: number;
  source?: 'agent' | 'user';
  lessonId?: string;
  /** True when a lesson snapshot exists for restore. */
  hasSnapshot?: boolean;
}

export const AMDP_INTAKE_TOOLS = [
  'lectern_offer_media',
  'lectern_put_media_slice',
  'lectern_bind_media',
  'lectern_media_status',
] as const;

export const JSON_CHUNK_TOOLS = [
  'lectern_begin_media_upload',
  'lectern_append_media_chunk',
  'lectern_commit_media_upload',
] as const;

const AMDP_SET = new Set<string>(AMDP_INTAKE_TOOLS);
const CHUNK_SET = new Set<string>(JSON_CHUNK_TOOLS);

export function isAmdpIntakeTool(tool: string): boolean {
  return AMDP_SET.has(tool);
}

export function isJsonChunkTool(tool: string): boolean {
  return CHUNK_SET.has(tool);
}

export function isSilentFoldTool(tool: string): boolean {
  return tool === 'lectern_media_status';
}

export function isFoldTerminalTool(tool: string): boolean {
  return tool === 'lectern_bind_media' || tool === 'lectern_commit_media_upload';
}

export function humanToolTitle(tool: string): string {
  return tool
    .replace(/^lectern_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function foldTitle(fold: AgentActivityFold): string {
  return fold === 'json-chunk' ? 'Upload media' : 'Attach media';
}

function merkleLeafCount(args: Record<string, unknown>): number {
  return Array.isArray(args.merkleLeaves) ? args.merkleLeaves.length : 0;
}

function sha256Key(args: Record<string, unknown>): string {
  return typeof args.sha256 === 'string' ? args.sha256.trim().toLowerCase() : '';
}

export function activityGroupSpec(
  tool: string,
  args: Record<string, unknown>,
): { fold: AgentActivityFold; key: string } | null {
  if (isAmdpIntakeTool(tool)) {
    const sha = sha256Key(args);
    if (!sha) return { fold: 'amdp', key: '' };
    return { fold: 'amdp', key: sha };
  }
  if (isJsonChunkTool(tool)) {
    const uploadId = typeof args.uploadId === 'string' ? args.uploadId.trim() : '';
    return { fold: 'json-chunk', key: uploadId };
  }
  return null;
}

function findOpenFold(
  events: AgentActivityEvent[],
  spec: { fold: AgentActivityFold; key: string },
): AgentActivityEvent | undefined {
  const open = events.filter((event) => event.fold === spec.fold && event.phase === 'start');
  if (spec.fold === 'json-chunk') {
    if (spec.key) {
      const matched = open.find((event) => event.groupKey === spec.key);
      if (matched) return matched;
    }
    return open[0];
  }
  if (spec.key) return open.find((event) => event.groupKey === spec.key);
  return open[0];
}

function countSliceSteps(steps: AgentActivityStep[] | undefined): number {
  return (steps ?? []).filter((step) => step.tool === 'lectern_put_media_slice').length;
}

function countChunkSteps(steps: AgentActivityStep[] | undefined): number {
  return (steps ?? []).filter((step) => step.tool === 'lectern_append_media_chunk').length;
}

function foldSummary(event: AgentActivityEvent): string {
  const steps = event.steps ?? [];
  const slices = countSliceSteps(steps);
  const chunks = countChunkSteps(steps);
  if (event.fold === 'amdp') {
    const total = event.progressTotal;
    if (slices > 0 && total && total > 2) {
      const sliceTotal = total - 2;
      return `cite → intake → bind · ${slices} / ${sliceTotal} slices`;
    }
    if (slices > 0) return `cite → intake → bind · ${slices} slices`;
    return 'cite → intake → bind';
  }
  if (chunks > 0) return `begin → append → commit · ${chunks} chunks`;
  return 'begin → append → commit';
}

function progressFor(event: AgentActivityEvent): { done: number; total: number } {
  const steps = event.steps ?? [];
  const done = steps.filter((step) => step.phase === 'done').length;
  const started = steps.filter((step) => step.phase === 'start').length;
  const total = Math.max(event.progressTotal ?? 0, steps.length, done + started);
  return { done, total: Math.max(total, 1) };
}

function bumpToFront(events: AgentActivityEvent[], next: AgentActivityEvent, max: number): AgentActivityEvent[] {
  return [next, ...events.filter((event) => event.id !== next.id)].slice(0, max);
}

export function mergeBeginActivity(input: {
  events: AgentActivityEvent[];
  maxEvents: number;
  seq: number;
  now: number;
  tool: string;
  args: Record<string, unknown>;
  title: string;
  summary: string;
  targets: string[];
  scroll: boolean;
}): {
  events: AgentActivityEvent[];
  active: AgentActivityEvent;
  id: string;
  seq: number;
  silent: boolean;
} {
  const spec = activityGroupSpec(input.tool, input.args);
  if (!spec) {
    const id = `act_${input.seq + 1}_${input.now}`;
  const event: AgentActivityEvent = {
    id,
    tool: input.tool,
    title: input.title,
    phase: 'start',
    summary: input.summary,
    targets: input.targets,
    scroll: input.scroll,
    at: input.now,
    startedAt: input.now,
    source: 'agent',
  };
    return {
      events: [event, ...input.events].slice(0, input.maxEvents),
      active: event,
      id,
      seq: input.seq + 1,
      silent: false,
    };
  }

  const open = findOpenFold(input.events, spec);
  if (open && isSilentFoldTool(input.tool)) {
    const next = { ...open, at: input.now };
    return {
      events: bumpToFront(input.events, next, input.maxEvents),
      active: next,
      id: open.id,
      seq: input.seq,
      silent: true,
    };
  }

  if (open) {
    const seq = input.seq + 1;
    const stepId = `act_${seq}_${input.now}`;
    const step: AgentActivityStep = {
      id: stepId,
      tool: input.tool,
      phase: 'start',
      summary: input.summary,
      at: input.now,
    };
    const steps = [...(open.steps ?? []), step];
    let progressTotal = open.progressTotal;
    if (input.tool === 'lectern_offer_media') {
      const leaves = merkleLeafCount(input.args);
      progressTotal = leaves > 0 ? 1 + leaves + 1 : Math.max(progressTotal ?? 2, 2);
    }
    if (input.tool === 'lectern_put_media_slice') {
      const slices = countSliceSteps(steps);
      progressTotal = Math.max(progressTotal ?? 0, 1 + slices + 1);
    }
    if (input.tool === 'lectern_append_media_chunk') {
      progressTotal = Math.max(progressTotal ?? 0, steps.length + 1);
    }
    const groupKey = spec.key || open.groupKey;
    const next: AgentActivityEvent = {
      ...open,
      tool: input.tool,
      title: foldTitle(spec.fold),
      phase: 'start',
      summary: foldSummary({ ...open, steps, progressTotal, fold: spec.fold }),
      targets: input.targets.length > 0 ? input.targets : open.targets,
      scroll: input.scroll || open.scroll,
      at: input.now,
      startedAt: open.startedAt ?? open.at,
      source: 'agent',
      groupKey,
      steps,
      progressDone: progressFor({ ...open, steps }).done,
      progressTotal,
    };
    next.summary = foldSummary(next);
    return {
      events: bumpToFront(input.events, next, input.maxEvents),
      active: next,
      id: open.id,
      seq,
      silent: false,
    };
  }

  const seq = input.seq + 1;
  const id = `act_${seq}_${input.now}`;
  const leaves = merkleLeafCount(input.args);
  const progressTotal =
    spec.fold === 'amdp' ? (leaves > 0 ? 1 + leaves + 1 : 2) : 2;
  const event: AgentActivityEvent = {
    id,
    tool: input.tool,
    title: foldTitle(spec.fold),
    phase: 'start',
    summary: spec.fold === 'amdp' ? 'cite → intake → bind' : 'begin → append → commit',
    targets: input.targets,
    scroll: input.scroll,
    at: input.now,
    startedAt: input.now,
    source: 'agent',
    fold: spec.fold,
    groupKey: spec.key || id,
    steps: [
      {
        id: `${id}_0`,
        tool: input.tool,
        phase: 'start',
        summary: input.summary,
        at: input.now,
      },
    ],
    progressDone: 0,
    progressTotal,
  };
  event.summary = foldSummary(event);
  return {
    events: [event, ...input.events].slice(0, input.maxEvents),
    active: event,
    id,
    seq,
    silent: false,
  };
}

export function mergeFinishActivity(input: {
  events: AgentActivityEvent[];
  active: AgentActivityEvent | null;
  id: string;
  phase: 'done' | 'error';
  tool: string;
  error?: string;
  now: number;
  silent?: boolean;
}): { events: AgentActivityEvent[]; active: AgentActivityEvent | null } {
  const events = input.events.map((event) => {
    if (event.id !== input.id) return event;
    if (!event.fold || !event.steps) {
      return { ...event, phase: input.phase, error: input.error, at: input.now };
    }
    if (input.silent) {
      return { ...event, at: input.now };
    }
    let marked = false;
    const steps = event.steps.map((step) => {
      if (marked || step.phase !== 'start') return step;
      if (step.tool !== input.tool) return step;
      marked = true;
      return { ...step, phase: input.phase, at: input.now };
    });
    if (!marked) {
      const lastStart = [...event.steps].reverse().find((step) => step.phase === 'start');
      if (lastStart) {
        for (let i = steps.length - 1; i >= 0; i -= 1) {
          if (steps[i]?.id === lastStart.id) {
            steps[i] = { ...lastStart, phase: input.phase, at: input.now };
            break;
          }
        }
      }
    }
    const next: AgentActivityEvent = {
      ...event,
      steps,
      at: input.now,
      error: input.phase === 'error' ? input.error : event.error,
      progressDone: steps.filter((step) => step.phase === 'done').length,
    };
    next.summary = foldSummary(next);
    if (input.phase === 'error') {
      next.phase = 'error';
      next.tool = input.tool;
      return next;
    }
    if (isFoldTerminalTool(input.tool)) {
      next.phase = 'done';
      next.tool = input.tool;
      next.progressDone = next.progressTotal ?? next.progressDone;
      return next;
    }
    next.phase = 'start';
    next.tool = input.tool;
    return next;
  });
  const updated = events.find((event) => event.id === input.id) ?? null;
  let active = input.active;
  if (input.active?.id === input.id) {
    active = updated?.phase === 'start' ? updated : null;
  }
  return { events, active };
}

function synthesizeFold(cluster: AgentActivityEvent[], fold: AgentActivityFold): AgentActivityEvent {
  const newest = cluster[0]!;
  const oldest = cluster[cluster.length - 1]!;
  const phase: AgentActivityPhase = cluster.some((event) => event.phase === 'error')
    ? 'error'
    : cluster.some((event) => event.phase === 'start')
      ? 'start'
      : 'done';
  const steps: AgentActivityStep[] = [...cluster].reverse().map((event) => ({
    id: event.id,
    tool: event.tool,
    phase: event.phase,
    summary: event.summary,
    at: event.at,
  }));
  const slices = countSliceSteps(steps);
  const progressTotal = fold === 'amdp' ? Math.max(steps.length, slices > 0 ? slices + 2 : steps.length) : steps.length;
  const event: AgentActivityEvent = {
    id: `fold_${oldest.id}`,
    tool: newest.tool,
    title: foldTitle(fold),
    phase,
    summary: '',
    targets: newest.targets.length > 0 ? newest.targets : oldest.targets,
    scroll: cluster.some((item) => item.scroll),
    at: newest.at,
    error: cluster.find((item) => item.error)?.error,
    fold,
    groupKey: newest.groupKey ?? oldest.groupKey,
    steps,
    progressDone: steps.filter((step) => step.phase === 'done').length,
    progressTotal,
  };
  event.summary = foldSummary(event);
  return event;
}

/** Collapse already-recorded one-row-per-slice logs (legacy) into fold cards. */
export function collapseActivityEvents(events: AgentActivityEvent[]): AgentActivityEvent[] {
  const out: AgentActivityEvent[] = [];
  let i = 0;
  while (i < events.length) {
    const event = events[i]!;
    if (event.fold && event.steps && event.steps.length > 0) {
      out.push(event);
      i += 1;
      continue;
    }
    if (isAmdpIntakeTool(event.tool)) {
      const cluster = [event];
      let j = i + 1;
      while (j < events.length && !events[j]!.fold && isAmdpIntakeTool(events[j]!.tool)) {
        cluster.push(events[j]!);
        j += 1;
      }
      if (cluster.length >= 2) {
        out.push(synthesizeFold(cluster, 'amdp'));
        i = j;
        continue;
      }
    }
    if (isJsonChunkTool(event.tool)) {
      const cluster = [event];
      let j = i + 1;
      while (j < events.length && !events[j]!.fold && isJsonChunkTool(events[j]!.tool)) {
        cluster.push(events[j]!);
        j += 1;
      }
      if (cluster.length >= 2) {
        out.push(synthesizeFold(cluster, 'json-chunk'));
        i = j;
        continue;
      }
    }
    out.push(event);
    i += 1;
  }
  return out;
}

const USER_COALESCE_MS = 120_000;

export function mergeUserActivity(input: {
  events: AgentActivityEvent[];
  maxEvents: number;
  seq: number;
  now: number;
  lessonId: string;
  action: string;
  title: string;
  summary: string;
  targets: string[];
  forceNew?: boolean;
}): { events: AgentActivityEvent[]; seq: number; id: string; coalesced: boolean } {
  const tool = `user.${input.action}`;
  const groupKey = input.targets[0] || tool;
  const head = input.events[0];
  if (
    !input.forceNew &&
    head &&
    head.source === 'user' &&
    head.tool === tool &&
    (head.groupKey || head.targets[0]) === groupKey &&
    input.now - head.at < USER_COALESCE_MS
  ) {
    const next: AgentActivityEvent = {
      ...head,
      summary: input.summary || head.summary,
      title: input.title || head.title,
      at: input.now,
      phase: 'done',
    };
    return {
      events: [next, ...input.events.slice(1)].slice(0, input.maxEvents),
      seq: input.seq,
      id: head.id,
      coalesced: true,
    };
  }
  const seq = input.seq + 1;
  const id = `usr_${seq}_${input.now}`;
  const event: AgentActivityEvent = {
    id,
    tool,
    title: input.title,
    phase: 'done',
    summary: input.summary,
    targets: input.targets,
    scroll: input.targets.length > 0,
    at: input.now,
    startedAt: input.now,
    source: 'user',
    lessonId: input.lessonId,
    groupKey,
  };
  return {
    events: [event, ...input.events].slice(0, input.maxEvents),
    seq,
    id,
    coalesced: false,
  };
}
