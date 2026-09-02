/**
 * Co-pilot AMDP / json-chunk activity folding.
 * Run: npm run test:agent-activity
 */
import {
  collapseActivityEvents,
  mergeBeginActivity,
  mergeFinishActivity,
  mergeUserActivity,
  type AgentActivityEvent,
} from '../src/lib/agent-activity-groups.ts';
import { discardFutureEvents, historyRole, isActivityAtHead } from '../src/lib/activity-history.ts';
import {
  beginAgentActivity,
  clearAgentActivity,
  finishAgentActivity,
  getActivityForAgent,
  listActivityForAgent,
  wrapToolExecute,
} from '../src/lib/agent-activity.ts';

let failed = 0;

function check(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
  } else {
    console.log(`  ok    ${msg}`);
  }
}

const attention = { targets: ['materials'], scroll: false };

function begin(
  events: AgentActivityEvent[],
  seq: number,
  tool: string,
  args: Record<string, unknown>,
  now: number,
) {
  return mergeBeginActivity({
    events,
    maxEvents: 24,
    seq,
    now,
    tool,
    args,
    title: tool,
    summary: JSON.stringify(args),
    ...attention,
  });
}

function play(calls: Array<{ tool: string; args: Record<string, unknown> }>): AgentActivityEvent[] {
  let events: AgentActivityEvent[] = [];
  let seq = 0;
  let now = 1_000;
  let active: AgentActivityEvent | null = null;
  for (const call of calls) {
    const started = begin(events, seq, call.tool, call.args, now);
    events = started.events;
    seq = started.seq;
    now += 1;
    const finished = mergeFinishActivity({
      events,
      active: started.active,
      id: started.id,
      phase: 'done',
      tool: call.tool,
      now,
      silent: started.silent,
    });
    events = finished.events;
    active = finished.active;
    now += 1;
  }
  check(active === null, 'fold is idle after bind/commit');
  return events;
}

console.log('Agent activity folds\n');

{
  const leaves = ['a', 'b', 'c'];
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const events = play([
    { tool: 'lectern_offer_media', args: { sha256: sha, merkleLeaves: leaves, mimeType: 'image/jpeg' } },
    { tool: 'lectern_put_media_slice', args: { sha256: sha, index: 0 } },
    { tool: 'lectern_put_media_slice', args: { sha256: sha, index: 1 } },
    { tool: 'lectern_put_media_slice', args: { sha256: sha, index: 2 } },
    { tool: 'lectern_bind_media', args: { sha256: sha, purpose: 'section', sectionId: 'sec_1' } },
  ]);
  check(events.length === 1, 'offer + 3 slices + bind is a single card');
  const fold = events[0]!;
  check(fold.fold === 'amdp', 'fold kind is amdp');
  check(fold.phase === 'done', 'bind completes the fold');
  check((fold.steps?.length ?? 0) === 5, `five steps recorded (got ${fold.steps?.length})`);
  check(fold.title === 'Attach media', 'card title is Attach media, not Put Media Slice');
  check((fold.progressTotal ?? 0) >= 5, 'progress total covers offer, slices, bind');
}

{
  const sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const events = play([
    { tool: 'lectern_offer_media', args: { sha256: sha, mimeType: 'image/jpeg' } },
    { tool: 'lectern_bind_media', args: { sha256: sha, purpose: 'illustration', sectionId: 'sec_1' } },
  ]);
  check(events.length === 1, 'cas-hit offer + bind is one card');
  check(events[0]?.steps?.length === 2, 'two steps: offer and bind');
}

{
  let events: AgentActivityEvent[] = [];
  let seq = 0;
  const sha = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
  const started = begin(events, seq, 'lectern_put_media_slice', { sha256: sha, index: 0 }, 10);
  const mid = mergeFinishActivity({
    events: started.events,
    active: started.active,
    id: started.id,
    phase: 'done',
    tool: 'lectern_put_media_slice',
    now: 11,
  });
  check(mid.active?.phase === 'start', 'a slice finish does not close the fold');
  check(mid.events.length === 1, 'still one card while slices land');
}

{
  const legacy: AgentActivityEvent[] = [
    {
      id: 'bind',
      tool: 'lectern_bind_media',
      title: 'Bind Media',
      phase: 'done',
      summary: 'purpose → section',
      targets: [],
      scroll: false,
      at: 3,
    },
    {
      id: 's1',
      tool: 'lectern_put_media_slice',
      title: 'Put Media Slice',
      phase: 'done',
      summary: 'slice 1',
      targets: [],
      scroll: false,
      at: 2,
    },
    {
      id: 's0',
      tool: 'lectern_put_media_slice',
      title: 'Put Media Slice',
      phase: 'done',
      summary: 'slice 0',
      targets: [],
      scroll: false,
      at: 1,
    },
    {
      id: 'offer',
      tool: 'lectern_offer_media',
      title: 'Offer Media',
      phase: 'done',
      summary: 'image/jpeg',
      targets: [],
      scroll: false,
      at: 0,
    },
  ];
  const collapsed = collapseActivityEvents(legacy);
  check(collapsed.length === 1, 'legacy Put Media Slice rows collapse to one card');
  check(collapsed[0]?.fold === 'amdp', 'legacy collapse is an AMDP fold');
  check(collapsed[0]?.title === 'Attach media', 'legacy card uses grouped title');
}

{
  const events = play([
    { tool: 'lectern_begin_media_upload', args: { mimeType: 'image/jpeg' } },
    { tool: 'lectern_append_media_chunk', args: { uploadId: 'upl_1', chunk: 'aaa' } },
    { tool: 'lectern_append_media_chunk', args: { uploadId: 'upl_1', chunk: 'bbb' } },
    { tool: 'lectern_commit_media_upload', args: { uploadId: 'upl_1', purpose: 'section', sectionId: 'sec_1' } },
  ]);
  check(events.length === 1, 'begin/append/commit is a single card');
  check(events[0]?.fold === 'json-chunk', 'json-chunk fold kind');
  check(events[0]?.title === 'Upload media', 'json-chunk title');
}

{
  const sha = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
  let events: AgentActivityEvent[] = [];
  let seq = 0;
  const offer = begin(events, seq, 'lectern_offer_media', { sha256: sha, merkleLeaves: ['x'] }, 1);
  events = mergeFinishActivity({
    events: offer.events,
    active: offer.active,
    id: offer.id,
    phase: 'done',
    tool: 'lectern_offer_media',
    now: 2,
  }).events;
  seq = offer.seq;
  const status = begin(events, seq, 'lectern_media_status', { sha256: sha }, 3);
  check(status.silent, 'media_status is absorbed into the open fold');
  check(status.events.length === 1, 'status does not add a second card');
  check((status.events[0]?.steps?.length ?? 0) === 1, 'status does not add a visible step');
}

console.log('\nUser activity\n');

{
  const first = mergeUserActivity({
    events: [],
    maxEvents: 2000,
    seq: 0,
    now: 1_000,
    lessonId: 'les_1',
    action: 'section.edit',
    title: 'section.edit',
    summary: 'Castle',
    targets: ['section:s1', 'materials'],
  });
  const second = mergeUserActivity({
    events: first.events,
    maxEvents: 2000,
    seq: first.seq,
    now: 2_000,
    lessonId: 'les_1',
    action: 'section.edit',
    title: 'section.edit',
    summary: 'Night castle',
    targets: ['section:s1', 'materials'],
  });
  check(second.coalesced, 'same section edit within 2 min coalesces');
  check(second.events.length === 1, 'coalesced edit stays one card');
  check(second.events[0]?.summary === 'Night castle', 'coalesced summary updates');
  check(second.events[0]?.source === 'user', 'user source is set');
  check(second.events[0]?.tool === 'user.section.edit', 'user tool name');
}

{
  const first = mergeUserActivity({
    events: [],
    maxEvents: 2000,
    seq: 0,
    now: 1_000,
    lessonId: 'les_1',
    action: 'section.edit',
    title: 'section.edit',
    summary: 'A',
    targets: ['section:s1'],
  });
  const other = mergeUserActivity({
    events: first.events,
    maxEvents: 2000,
    seq: first.seq,
    now: 2_000,
    lessonId: 'les_1',
    action: 'section.edit',
    title: 'section.edit',
    summary: 'B',
    targets: ['section:s2'],
  });
  check(other.events.length === 2, 'edits on different sections stay separate');
  check(other.coalesced === false, 'different target is a new card');
}

{
  const first = mergeUserActivity({
    events: [],
    maxEvents: 2000,
    seq: 0,
    now: 1_000,
    lessonId: 'les_1',
    action: 'meta.edit',
    title: 'meta.edit',
    summary: 'Title',
    targets: ['meta'],
  });
  const later = mergeUserActivity({
    events: first.events,
    maxEvents: 2000,
    seq: first.seq,
    now: 1_000 + 121_000,
    lessonId: 'les_1',
    action: 'meta.edit',
    title: 'meta.edit',
    summary: 'Title later',
    targets: ['meta'],
  });
  check(later.coalesced === false, 'after 2 min a new user card starts');
  check(later.events.length === 2, 'history keeps both user cards');
}

{
  const user = mergeUserActivity({
    events: [],
    maxEvents: 2000,
    seq: 0,
    now: 10,
    lessonId: 'les_1',
    action: 'section.edit',
    title: 'section.edit',
    summary: 'Manual',
    targets: ['section:s1'],
  });
  const mixed = play([
    { tool: 'lectern_offer_media', args: { sha256: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', merkleLeaves: ['x', 'y'] } },
    { tool: 'lectern_put_media_slice', args: { sha256: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', index: 0 } },
    { tool: 'lectern_bind_media', args: { sha256: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' } },
  ]);
  const collapsed = collapseActivityEvents([...mixed, ...user.events]);
  check(collapsed.some((event) => event.source === 'user'), 'user cards survive AMDP collapse');
  check(collapsed.filter((event) => event.fold === 'amdp').length === 1, 'AMDP still folds beside user cards');
}

console.log('\nHistory checkout\n');

{
  const events = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
  check(isActivityAtHead(events, null), 'null view is at head');
  check(isActivityAtHead(events, 'c'), 'viewing newest is at head');
  check(!isActivityAtHead(events, 'b'), 'older view is not head');
  check(historyRole(events, null, 'c') === 'head', 'newest at head');
  check(historyRole(events, 'b', 'c') === 'future', 'newer than view is future');
  check(historyRole(events, 'b', 'b') === 'viewing', 'checked-out card is viewing');
  check(historyRole(events, 'b', 'a') === 'past', 'older than view is past');
  const cut = discardFutureEvents(events, 'b');
  check(cut.truncated, 'discard drops later cards');
  check(cut.events.map((event) => event.id).join(',') === 'b,a', 'stem remains from the checkout');
  check(cut.droppedIds.join(',') === 'c', 'future id is dropped');
  const idle = discardFutureEvents(events, null);
  check(!idle.truncated, 'discard at head is a no-op');
}

console.log('\nWebMCP activity list/get\n');

{
  clearAgentActivity();
  const started = beginAgentActivity('lectern_upsert_section', { title: 'Light' });
  finishAgentActivity(started.id, 'done', undefined, 'lectern_upsert_section');
  const listed = listActivityForAgent(10);
  check(listed.returned >= 1, 'list returns at least one card');
  check(listed.events[0]?.id === started.id, 'newest card is first');
  const got = getActivityForAgent(started.id);
  check(got.ok === true && got.ok && got.event.id === started.id, 'get returns the same card');
  const missing = getActivityForAgent('evt_missing');
  check(missing.ok === false, 'unknown id is an error');
  const before = listed.total;
  await wrapToolExecute('lectern_list_activity', {}, () => ({ ok: true }));
  await wrapToolExecute('lectern_get_activity', { eventId: started.id }, () => ({ ok: true }));
  check(listActivityForAgent(100).total === before, 'list/get do not add cards');
  clearAgentActivity();
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll agent-activity fold checks passed.');
