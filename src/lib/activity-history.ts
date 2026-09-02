/** Linear co-pilot history cursor: checkout a card, keep later cards until the next edit. */

export type HistoryRole = 'head' | 'viewing' | 'future' | 'past';

export function isActivityAtHead(events: { id: string }[], viewId: string | null): boolean {
  if (!viewId || events.length === 0) return true;
  return events[0]?.id === viewId;
}

export function historyViewIndex(events: { id: string }[], viewId: string | null): number {
  if (!viewId || events.length === 0) return 0;
  const index = events.findIndex((event) => event.id === viewId);
  return index < 0 ? 0 : index;
}

export function historyRole(
  events: { id: string }[],
  viewId: string | null,
  eventId: string,
): HistoryRole {
  if (events.length === 0) return 'head';
  const viewIndex = historyViewIndex(events, viewId);
  const index = events.findIndex((event) => event.id === eventId);
  if (index < 0) return 'past';
  if (index === viewIndex) return viewIndex === 0 ? 'head' : 'viewing';
  if (index < viewIndex) return 'future';
  return 'past';
}

/** Newest-first list: drop cards newer than the checked-out card. */
export function discardFutureEvents<T extends { id: string }>(
  events: T[],
  viewId: string | null,
): { events: T[]; droppedIds: string[]; truncated: boolean } {
  if (isActivityAtHead(events, viewId)) {
    return { events, droppedIds: [], truncated: false };
  }
  const index = historyViewIndex(events, viewId);
  if (index <= 0) {
    return { events, droppedIds: [], truncated: false };
  }
  const droppedIds = events.slice(0, index).map((event) => event.id);
  return {
    events: events.slice(index),
    droppedIds,
    truncated: droppedIds.length > 0,
  };
}
