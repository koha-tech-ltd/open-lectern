import {
  collapseActivityEvents,
  foldTitle,
  humanToolTitle,
  isFoldTerminalTool,
  mergeBeginActivity,
  mergeFinishActivity,
  mergeUserActivity,
  type AgentActivityEvent,
  type AgentActivityFold,
  type AgentActivityPhase,
  type AgentActivityStep,
} from './agent-activity-groups.ts';
import {
  discardFutureEvents,
  historyRole,
  isActivityAtHead,
  type HistoryRole,
} from './activity-history.ts';
import {
  ACTIVITY_HEAD_SNAPSHOT,
  clearLessonActivitySnapshots,
  cloneLessonSnapshot,
  deleteActivitySnapshots,
  getActivitySnapshot,
  putActivitySnapshot,
} from './activity-snapshots.ts';
import { createDemoById, demoIdFromLessonId } from './lesson.ts';
import type { LessonDocument } from '@/types/lesson';

export type { AgentActivityEvent, AgentActivityFold, AgentActivityPhase, AgentActivityStep, HistoryRole };
export { collapseActivityEvents, foldTitle, historyRole, humanToolTitle, isActivityAtHead };

export type UserActivityAction =
  | 'section.edit'
  | 'section.add'
  | 'section.remove'
  | 'meta.edit'
  | 'quiz.edit'
  | 'quiz.add'
  | 'quiz.remove'
  | 'media.add'
  | 'media.remove'
  | 'media.caption'
  | 'publish'
  | 'import'
  | 'annotation'
  | 'project.open';

type Listener = (
  events: AgentActivityEvent[],
  active: AgentActivityEvent | null,
  viewId: string | null,
) => void;

const MAX_EVENTS = 2000;
const LEGACY_STORAGE_KEY = 'lectern.agent-activity.v1';
const STORAGE_PREFIX = 'lectern.agent-activity.v3:';
const ACTIVITY_STORAGE_VERSION = 4;
const listeners = new Set<Listener>();

const READ_ONLY_TOOLS = new Set([
  'lectern_get_lesson',
  'lectern_get_section',
  'lectern_list_gaps',
  'lectern_list_annotations',
  'lectern_list_locales',
  'lectern_get_locale',
  'lectern_set_locale',
  'lectern_set_mode',
  'lectern_media_status',
  'lectern_list_media_templates',
  'lectern_preview_media_template',
  'lectern_plan_visual_learning',
  'lectern_audit_visual_learning',
  'lectern_get_restore_payload',
  'lectern_list_library',
  'lectern_list_activity',
  'lectern_get_activity',
  'lectern_restore_activity',
  'lectern_activity_head',
]);

/** Read the co-pilot log without adding another card to it. */
const UNLOGGED_TOOLS = new Set(['lectern_list_activity', 'lectern_get_activity', 'lectern_list_library']);

let lessonId = '';
let agentDepth = 0;
let events: AgentActivityEvent[] = [];
let active: AgentActivityEvent | null = null;
let viewId: string | null = null;
let seq = 0;
let snapshotSource: () => LessonDocument | null = () => null;
const snapshotCache = new Map<string, LessonDocument>();
let pendingNewBranch = false;

function storageKeyFor(id: string): string {
  return `${STORAGE_PREFIX}${id || '_pending'}`;
}

function cacheKey(eventId: string, id = lessonId): string {
  return `${id}::${eventId}`;
}

function rememberSnapshot(eventId: string, lesson: LessonDocument): void {
  snapshotCache.set(cacheKey(eventId), lesson);
}

function takeLessonClone(): LessonDocument | null {
  const current = snapshotSource();
  if (!current) return null;
  return cloneLessonSnapshot(current);
}

function parseStoredBundle(raw: string | null): { events: AgentActivityEvent[]; viewId: string | null } {
  if (!raw) return { events: [], viewId: null };
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      events?: AgentActivityEvent[];
      viewId?: string | null;
    };
    if (!Array.isArray(parsed.events)) return { events: [], viewId: null };
    const list = parsed.events
      .filter((event) => event && typeof event.id === 'string' && typeof event.tool === 'string')
      .map((event) =>
        event.phase === 'start'
          ? { ...event, phase: 'error' as const, error: 'Interrupted by a page reload.' }
          : event,
      );
    const nextView =
      typeof parsed.viewId === 'string' && list.some((event) => event.id === parsed.viewId)
        ? parsed.viewId
        : null;
    return { events: list, viewId: nextView };
  } catch {
    return { events: [], viewId: null };
  }
}

function migrateLegacyEvents(): AgentActivityEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const migrated = parseStoredBundle(raw).events;
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  } catch {
    return [];
  }
}

function loadLessonBundle(id: string): { events: AgentActivityEvent[]; viewId: string | null } {
  if (typeof localStorage === 'undefined') return { events: [], viewId: null };
  const stored = parseStoredBundle(localStorage.getItem(storageKeyFor(id)));
  if (stored.events.length > 0) {
    return { events: stored.events.slice(0, MAX_EVENTS), viewId: stored.viewId };
  }
  const legacy = migrateLegacyEvents();
  return { events: legacy.slice(0, MAX_EVENTS), viewId: null };
}

function persistEvents(): void {
  if (typeof localStorage === 'undefined') return;
  const storedId = lessonId || '_pending';
  const write = (list: AgentActivityEvent[]) => {
    localStorage.setItem(
      storageKeyFor(storedId),
      JSON.stringify({
        version: ACTIVITY_STORAGE_VERSION,
        lessonId: storedId,
        viewId,
        savedAt: new Date().toISOString(),
        events: list,
      }),
    );
  };
  try {
    write(events);
  } catch {
    const trimmed = events.slice(0, Math.max(50, Math.floor(events.length * 0.8)));
    events = trimmed;
    if (viewId && !events.some((event) => event.id === viewId)) viewId = null;
    try {
      write(trimmed);
    } catch {
      // Quota still exhausted; keep in-memory history for this session.
    }
  }
}

if (typeof window !== 'undefined') {
  const boot = loadLessonBundle('_pending');
  events = boot.events;
  viewId = boot.viewId;
}

function emit(): void {
  persistEvents();
  for (const listener of listeners) {
    listener(events, active, viewId);
  }
}

export function subscribeAgentActivity(listener: Listener): () => void {
  listeners.add(listener);
  listener(events, active, viewId);
  return () => {
    listeners.delete(listener);
  };
}

export function getAgentActivitySnapshot(): {
  events: AgentActivityEvent[];
  active: AgentActivityEvent | null;
  viewId: string | null;
} {
  return { events, active, viewId };
}

function serializeActivityEvent(event: AgentActivityEvent, detail: boolean) {
  return {
    id: event.id,
    tool: event.tool,
    title: event.title,
    summary: event.summary,
    phase: event.phase,
    source: event.source ?? 'agent',
    fold: event.fold,
    at: event.at,
    startedAt: event.startedAt,
    targets: event.targets,
    error: event.error,
    viewRole: historyRole(events, viewId, event.id),
    ...(detail && event.steps?.length
      ? {
          steps: event.steps.map((step) => ({
            id: step.id,
            tool: step.tool,
            phase: step.phase,
            summary: step.summary,
          })),
        }
      : {}),
  };
}

/** Collapsed co-pilot history for WebMCP agents (newest first). */
export function listActivityForAgent(limit = 40): {
  viewId: string | null;
  atHead: boolean;
  total: number;
  returned: number;
  events: ReturnType<typeof serializeActivityEvent>[];
} {
  const rows = collapseActivityEvents(events);
  const cap = Math.min(100, Math.max(1, Math.floor(limit) || 40));
  const slice = rows.slice(0, cap);
  return {
    viewId,
    atHead: isActivityAtHead(events, viewId),
    total: rows.length,
    returned: slice.length,
    events: slice.map((event) => serializeActivityEvent(event, false)),
  };
}

export function getActivityForAgent(eventId: string): {
  ok: true;
  viewId: string | null;
  atHead: boolean;
  event: ReturnType<typeof serializeActivityEvent> & { parentId?: string };
} | { ok: false; error: string } {
  const id = eventId.trim();
  if (!id) return { ok: false, error: 'eventId is required.' };
  const collapsed = collapseActivityEvents(events);
  const folded = collapsed.find((event) => event.id === id);
  if (folded) {
    return {
      ok: true,
      viewId,
      atHead: isActivityAtHead(events, viewId),
      event: serializeActivityEvent(folded, true),
    };
  }
  const raw = events.find((event) => event.id === id);
  if (raw) {
    return {
      ok: true,
      viewId,
      atHead: isActivityAtHead(events, viewId),
      event: serializeActivityEvent(raw, true),
    };
  }
  for (const row of collapsed) {
    const step = row.steps?.find((item) => item.id === id);
    if (step) {
      return {
        ok: true,
        viewId,
        atHead: isActivityAtHead(events, viewId),
        event: {
          id: step.id,
          tool: step.tool,
          title: humanToolTitle(step.tool),
          summary: step.summary,
          phase: step.phase,
          source: 'agent',
          fold: row.fold,
          at: row.at,
          startedAt: row.startedAt,
          targets: row.targets,
          error: undefined,
          viewRole: historyRole(events, viewId, row.id),
          parentId: row.id,
        },
      };
    }
  }
  return { ok: false, error: 'Activity event not found.' };
}

export function getActivityLessonId(): string {
  return lessonId;
}

export function getActivityViewId(): string | null {
  return viewId;
}

export function activityIsAtHead(): boolean {
  return isActivityAtHead(events, viewId);
}

export function setActivitySnapshotSource(source: () => LessonDocument | null): void {
  snapshotSource = source;
  const head = events[0];
  if (head && head.phase === 'done' && !head.hasSnapshot && source()) {
    captureSnapshot(head.id);
  }
}

export function setActivityLesson(id: string): void {
  const next = id.trim();
  if (!next || next === lessonId) return;
  const previousId = lessonId;
  const pending = events;
  const pendingView = viewId;
  persistEvents();
  lessonId = next;
  const stored = loadLessonBundle(next);
  if (!previousId && pending.length > 0) {
    const storedIds = new Set(stored.events.map((event) => event.id));
    const carry = pending
      .filter((event) => !storedIds.has(event.id))
      .map((event) => (event.lessonId ? event : { ...event, lessonId: next }));
    events = [...carry, ...stored.events].slice(0, MAX_EVENTS);
    viewId = pendingView && events.some((event) => event.id === pendingView) ? pendingView : stored.viewId;
    active = events.find((event) => event.phase === 'start') ?? null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(storageKeyFor('_pending'));
      } catch {
        /* no-op */
      }
    }
  } else {
    events = stored.events;
    viewId = stored.viewId;
    active = null;
  }
  emit();
}

export function clearAgentActivity(): void {
  const id = lessonId;
  events = [];
  active = null;
  viewId = null;
  pendingNewBranch = false;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(storageKeyFor(id));
    } catch {
      /* no-op */
    }
  }
  void clearLessonActivitySnapshots(id);
  emit();
}

export function isAgentExecuting(): boolean {
  return agentDepth > 0;
}

function shouldCaptureSnapshot(eventId: string, tool: string, phase: 'done' | 'error', silent: boolean): boolean {
  if (silent || phase !== 'done') return false;
  if (READ_ONLY_TOOLS.has(tool)) return false;
  const event = events.find((item) => item.id === eventId);
  if (!event || event.phase !== 'done') return false;
  if (event.fold && !isFoldTerminalTool(tool)) return false;
  return true;
}

function captureSnapshot(eventId: string, lesson?: LessonDocument | null): void {
  const clone = lesson ? cloneLessonSnapshot(lesson) : takeLessonClone();
  if (clone) {
    rememberSnapshot(eventId, clone);
    events = events.map((event) => (event.id === eventId ? { ...event, hasSnapshot: true } : event));
    void putActivitySnapshot(lessonId, eventId, clone).catch(() => {
      events = events.map((event) => (event.id === eventId ? { ...event, hasSnapshot: false } : event));
      emit();
    });
  }
  emit();
}

async function resolveSnapshot(eventId: string): Promise<LessonDocument | null> {
  const cached = snapshotCache.get(cacheKey(eventId));
  if (cached) return cloneLessonSnapshot(cached);
  const stored = await getActivitySnapshot(lessonId, eventId);
  if (stored) {
    rememberSnapshot(eventId, stored);
    return cloneLessonSnapshot(stored);
  }
  return null;
}

function freezeHeadLesson(): void {
  const clone = takeLessonClone();
  if (!clone) return;
  rememberSnapshot(ACTIVITY_HEAD_SNAPSHOT, clone);
  void putActivitySnapshot(lessonId, ACTIVITY_HEAD_SNAPSHOT, clone);
}

export function discardActivityFuture(): boolean {
  const cut = discardFutureEvents(events, viewId);
  if (!cut.truncated) {
    if (viewId && events[0]?.id === viewId) viewId = null;
    return false;
  }
  events = cut.events;
  viewId = null;
  pendingNewBranch = true;
  snapshotCache.delete(cacheKey(ACTIVITY_HEAD_SNAPSHOT));
  void deleteActivitySnapshots(lessonId, [...cut.droppedIds, ACTIVITY_HEAD_SNAPSHOT]);
  emit();
  return true;
}

export async function checkoutActivity(
  eventId: string,
): Promise<{ ok: true; lesson: LessonDocument } | { ok: false; error: string }> {
  if (events.length === 0) return { ok: false, error: 'No history to restore.' };
  const headId = events[0]?.id;
  if (eventId === headId || eventId === ACTIVITY_HEAD_SNAPSHOT) {
    return checkoutActivityHead();
  }
  const target = events.find((event) => event.id === eventId);
  if (!target) return { ok: false, error: 'That history card is gone.' };
  if (isActivityAtHead(events, viewId)) {
    freezeHeadLesson();
  }
  const lesson = await resolveSnapshot(eventId);
  if (!lesson) {
    const demoId = target.tool === 'user.project.open' ? demoIdFromLessonId(lessonId) : null;
    if (demoId) {
      viewId = eventId;
      emit();
      return { ok: true, lesson: createDemoById(demoId) };
    }
    return { ok: false, error: 'No snapshot for this card yet.' };
  }
  viewId = eventId;
  emit();
  return { ok: true, lesson };
}

export async function checkoutActivityHead(): Promise<
  { ok: true; lesson: LessonDocument } | { ok: false; error: string }
> {
  const head =
    (await resolveSnapshot(ACTIVITY_HEAD_SNAPSHOT)) ??
    (events[0] ? await resolveSnapshot(events[0].id) : null) ??
    takeLessonClone();
  if (!head) return { ok: false, error: 'Current version is not saved yet.' };
  viewId = null;
  emit();
  return { ok: true, lesson: head };
}

export function formatActivityTime(at: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at));
  } catch {
    return new Date(at).toISOString();
  }
}

export function formatActivityDay(at: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(at));
  } catch {
    return new Date(at).toISOString().slice(0, 10);
  }
}

export function summarizeArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof args.title === 'string' && args.title.trim()) {
    parts.push(`"${args.title.trim().slice(0, 48)}"`);
  }
  if (typeof args.prompt === 'string' && args.prompt.trim()) parts.push(`quiz: ${args.prompt.trim().slice(0, 40)}`);
  if (typeof args.note === 'string' && args.note.trim()) parts.push(`mark: ${args.note.trim().slice(0, 40)}`);
  if (typeof args.mode === 'string') parts.push(`mode → ${args.mode}`);
  if (typeof args.locale === 'string') parts.push(`locale → ${args.locale}`);
  if (typeof args.sectionId === 'string') parts.push(`section ${args.sectionId}`);
  if (typeof args.quizId === 'string') parts.push(`quiz:${args.quizId}`);
  if (typeof args.uploadId === 'string') parts.push(`upload ${args.uploadId}`);
  if (typeof args.purpose === 'string') parts.push(`purpose → ${args.purpose}`);
  if (typeof args.mimeType === 'string') parts.push(args.mimeType);
  if (typeof args.sha256 === 'string' && args.sha256.trim()) {
    parts.push(`sha ${args.sha256.trim().slice(0, 8)}…`);
  }
  if (typeof args.index === 'number' && Number.isFinite(args.index)) parts.push(`slice ${args.index}`);
  if (typeof args.id === 'string') parts.push(args.id);
  if (parts.length === 0) return 'no args';
  return parts.join(' · ');
}

/** Map a tool call to DOM data-lectern-target values and whether to scroll. */
export function resolveToolAttention(
  tool: string,
  args: Record<string, unknown>,
): { targets: string[]; scroll: boolean } {
  switch (tool) {
    case 'lectern_set_meta':
      return { targets: ['meta'], scroll: true };
    case 'lectern_commit_media_upload':
    case 'lectern_bind_media': {
      if (args.purpose === 'quiz-choice') {
        const quizId = typeof args.quizId === 'string' ? args.quizId : '';
        return { targets: quizId ? [`quiz:${quizId}`, 'quiz'] : ['quiz'], scroll: true };
      }
      const sectionId = typeof args.sectionId === 'string' ? args.sectionId : '';
      return {
        targets: sectionId ? [`section:${sectionId}`, 'materials'] : ['materials'],
        scroll: true,
      };
    }
    case 'lectern_get_section':
    case 'lectern_upsert_section':
    case 'lectern_attach_section_media':
    case 'lectern_attach_generated_illustration':
    case 'lectern_remove_section_media':
    case 'lectern_remove_section': {
      const id =
        (typeof args.sectionId === 'string' && args.sectionId) ||
        (typeof args.id === 'string' && args.id) ||
        '';
      return {
        targets: id ? [`section:${id}`, 'materials'] : ['materials'],
        scroll: tool !== 'lectern_get_section' || !!id,
      };
    }
    case 'lectern_attach_quiz_choice_media': {
      const quizId = typeof args.quizId === 'string' ? args.quizId : '';
      return { targets: quizId ? [`quiz:${quizId}`, 'quiz'] : ['quiz'], scroll: true };
    }
    case 'lectern_upsert_quiz_item':
    case 'lectern_remove_quiz_item': {
      const id = typeof args.id === 'string' ? args.id : '';
      const sectionId = typeof args.sectionId === 'string' ? args.sectionId.trim() : '';
      if (sectionId) {
        return {
          targets: id
            ? [`section:${sectionId}`, `quiz:${id}`, 'quiz']
            : [`section:${sectionId}`, 'quiz'],
          scroll: true,
        };
      }
      return {
        targets: id ? [`quiz:${id}`, 'quiz'] : ['quiz'],
        scroll: true,
      };
    }
    case 'lectern_list_gaps':
      return { targets: ['gaps'], scroll: true };
    case 'lectern_publish_lesson':
      return { targets: ['publish', 'gaps'], scroll: true };
    case 'lectern_get_restore_payload':
      return { targets: ['publish'], scroll: true };
    case 'lectern_list_library':
    case 'lectern_save_lesson':
    case 'lectern_new_lesson':
      return { targets: ['import'], scroll: true };
    case 'lectern_switch_lesson':
      return { targets: ['import', 'meta', 'materials'], scroll: true };
    case 'lectern_import_restore':
      return { targets: ['import', 'meta', 'materials'], scroll: true };
    case 'lectern_add_annotation': {
      const sectionId = typeof args.sectionId === 'string' ? args.sectionId : '';
      return {
        targets: sectionId
          ? [`section:${sectionId}`, 'annotations']
          : ['annotations'],
        scroll: true,
      };
    }
    case 'lectern_list_annotations':
      return { targets: ['annotations'], scroll: true };
    case 'lectern_set_mode':
      return { targets: ['mode-switch'], scroll: false };
    case 'lectern_set_locale':
      return { targets: ['language'], scroll: false };
    case 'lectern_get_lesson':
      return { targets: [], scroll: false };
    default:
      return { targets: [], scroll: false };
  }
}

export function beginAgentActivity(
  tool: string,
  args: Record<string, unknown> = {},
): { id: string; silent: boolean } {
  const { targets, scroll } = resolveToolAttention(tool, args);
  const merged = mergeBeginActivity({
    events,
    maxEvents: MAX_EVENTS,
    seq,
    now: Date.now(),
    tool,
    args,
    title: humanToolTitle(tool),
    summary: summarizeArgs(args),
    targets,
    scroll,
  });
  events = merged.events.map((event) =>
    event.lessonId ? event : { ...event, lessonId },
  );
  active = merged.active;
  seq = merged.seq;
  emit();

  if (scroll && targets.length > 0 && typeof document !== 'undefined') {
    const el = document.querySelector(`[data-lectern-target="${CSS.escape(targets[0])}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { id: merged.id, silent: merged.silent };
}

export function finishAgentActivity(
  id: string,
  phase: 'done' | 'error',
  error?: string,
  tool = '',
  silent = false,
): void {
  const merged = mergeFinishActivity({
    events,
    active,
    id,
    phase,
    tool,
    error,
    now: Date.now(),
    silent: silent && phase === 'done',
  });
  events = merged.events;
  active = merged.active;
  if (shouldCaptureSnapshot(id, tool, phase, silent && phase === 'done')) {
    captureSnapshot(id);
  } else {
    emit();
  }
}

export function recordUserActivity(input: {
  action: UserActivityAction;
  summary: string;
  targets?: string[];
  title?: string;
  lesson?: LessonDocument;
}): void {
  if (agentDepth > 0) return;
  const truncated = discardActivityFuture() || pendingNewBranch;
  pendingNewBranch = false;
  const merged = mergeUserActivity({
    events,
    maxEvents: MAX_EVENTS,
    seq,
    now: Date.now(),
    lessonId,
    action: input.action,
    title: input.title || input.action,
    summary: input.summary,
    targets: input.targets ?? [],
    forceNew: truncated,
  });
  events = merged.events;
  seq = merged.seq;
  captureSnapshot(merged.id, input.lesson);
}

export function wrapToolExecute<T>(
  tool: string,
  args: Record<string, unknown>,
  execute: () => Promise<T> | T,
): Promise<T> {
  if (UNLOGGED_TOOLS.has(tool)) {
    return Promise.resolve().then(() => execute());
  }
  if (!READ_ONLY_TOOLS.has(tool)) {
    discardActivityFuture();
  }
  const session = beginAgentActivity(tool, args);
  agentDepth += 1;
  return Promise.resolve()
    .then(() => execute())
    .then((result) => {
      finishAgentActivity(session.id, 'done', undefined, tool, session.silent);
      return result;
    })
    .catch((err: unknown) => {
      finishAgentActivity(
        session.id,
        'error',
        err instanceof Error ? err.message : String(err),
        tool,
        false,
      );
      throw err;
    })
    .finally(() => {
      agentDepth = Math.max(0, agentDepth - 1);
    });
}
