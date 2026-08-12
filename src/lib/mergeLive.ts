/**
 * Merges a REST snapshot (authoritative for *which* items currently exist —
 * always fresh after create/delete via refetch()) with live WS telemetry
 * (authoritative for *real-time fields* on items that have an active feed).
 *
 * This replaces the naive `live ?? snapshot` pattern, which breaks in two
 * ways once a station has no active edge-service feed (true for every
 * station except the demo one):
 *   1. The WS payload is only pushed once, at connect time, then goes stale
 *      forever — but `live ?? snapshot` still prefers it over a freshly
 *      `refetch()`-ed snapshot, so newly created items never appear until
 *      the page is hard-reloaded (which reopens the WS and re-syncs it).
 *   2. If that one-time snapshot was an empty array (a station with zero
 *      equipment), `[] ?? snapshot` evaluates to `[]` — not the snapshot —
 *      because `??` only falls through on null/undefined, not on an empty
 *      array. So the page stays stuck on "empty" even after equipment is
 *      added and the snapshot refetch confirms it exists.
 *
 * By iterating the snapshot (always correct and current) and only pulling
 * matching live data in where it exists, both problems disappear: newly
 * created items show up immediately from the snapshot, live telemetry still
 * overlays wherever an active feed is actually updating it, and deleted
 * items disappear as soon as the snapshot no longer contains them.
 */
export function mergeLive<T extends { id: string | number }>(
  snapshot: T[],
  live: T[] | null | undefined
): T[] {
  if (!live || live.length === 0) return snapshot;
  const liveById = new Map(live.map((item) => [item.id, item]));
  return snapshot.map((item) => liveById.get(item.id) ?? item);
}