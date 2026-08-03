/**
 * The last campus calendar we read, kept on the student's own device.
 *
 * ## Why this exists
 *
 * Reading a campus calendar is slow and there is no way to make it fast. The
 * backend resolves the school's feed, fetches the whole calendar over the
 * network, expands repeating events and filters what is left. Twelve seconds is
 * a normal answer, not a broken one, and none of that work can start until the
 * student is already looking at the page.
 *
 * The in-memory cache in `campus-events.js` covers moving around the app inside
 * one tab. It dies on reload, which is exactly when a student comes back: they
 * open the app tomorrow, and tomorrow is a cold start every time.
 *
 * So the answer is written here as well, and the next visit renders it
 * immediately while a fresh read runs behind it. The student reads real events
 * from the first frame instead of a spinner, and the calendar swaps itself out
 * when the new one lands.
 *
 * ## What is stored, and what is not
 *
 * Public campus events, a school name, and the ranking we already paid for.
 * Nothing about the student beyond which school they are at, no tokens, and no
 * profile fields. The ranking is stored keyed on the events it ranked, so it can
 * never be shown against a different set of events than the one it judged.
 *
 * ## Everything read back is re-dated
 *
 * A stored calendar goes out of date by sitting still. Yesterday's events are
 * dropped on the way out using the same rule the backend applies on the way in,
 * so what a student sees from storage is what a fresh read would have given
 * them, minus whatever the school has added since.
 */

import { parseEventStart } from './campus-events';

const KEY = 'unscripted_campus_v1';

/** Older than this and it is history, not a head start. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Enough for both surfaces and a window size change, not enough to bloat. */
const MAX_FEEDS = 4;
const MAX_RANKS = 6;

// The backend's own staleness rule, mirrored so a stored feed and a fresh one
// answer "is this over" identically. An event that started an hour ago is still
// worth showing; a whole-day one stands until its day is out.
const STARTED_GRACE_MS = 60 * 60 * 1000;
const WHOLE_DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function closesAfterEnd(end) {
  const text = String(end || '').trim();
  if (!text) return -Infinity;
  const at = parseEventStart(text)?.getTime();
  if (!Number.isFinite(at)) return -Infinity;
  return at + (DATE_ONLY.test(text) ? WHOLE_DAY_MS : STARTED_GRACE_MS);
}

/** True while an event is still worth putting in front of a student. */
export function stillUpcoming(event, now = Date.now()) {
  const start = parseEventStart(event?.start);
  if (!start) return false;
  const wholeDay = Boolean(event?.all_day) || DATE_ONLY.test(String(event?.start || '').trim());
  const fromStart = start.getTime() + (wholeDay ? WHOLE_DAY_MS : STARTED_GRACE_MS);
  return Math.max(fromStart, closesAfterEnd(event?.end)) >= now;
}

/** Everything in this list that has not already happened. */
export function pruneStaleEvents(events, now = Date.now()) {
  return (Array.isArray(events) ? events : []).filter(event => stillUpcoming(event, now));
}

function readStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    if (!store || typeof store !== 'object') return null;
    return store;
  } catch {
    return null;
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // A full or unavailable localStorage is not an error a student should ever
    // hear about. Throw the whole thing away and carry on without a head start.
    try { localStorage.removeItem(KEY); } catch { /* nothing left to try */ }
  }
}

/** Keep the newest `max` entries of a bucket and drop the rest. */
function trim(bucket, max) {
  const keys = Object.keys(bucket).sort((a, b) => (bucket[b]?.at || 0) - (bucket[a]?.at || 0));
  const kept = {};
  for (const key of keys.slice(0, max)) kept[key] = bucket[key];
  return kept;
}

/** Forget everything. Used on logout and when the signed-in student changes. */
export function clearCampusStore() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/**
 * The last feed we stored for this window, re-dated to today.
 *
 * Returns null rather than an empty answer when there is nothing usable left,
 * because "we have four events" and "we have a two-week-old file with nothing
 * still to come in it" are different things to put on a screen.
 */
export function readCampusFeed(key, { now = Date.now() } = {}) {
  const store = readStore();
  const entry = store?.feeds?.[key];
  if (!entry || typeof entry !== 'object') return null;
  if (!entry.at || now - entry.at > MAX_AGE_MS) return null;

  const events = pruneStaleEvents(entry.data?.events, now);
  if (!events.length) return null;

  return {
    at: entry.at,
    userId: entry.userId || '',
    data: { ...entry.data, events, status: 'ok' },
  };
}

/** Remember a feed we just read. Only a working one is worth keeping. */
export function writeCampusFeed(key, data, { userId = '', now = Date.now() } = {}) {
  if (!data || !Array.isArray(data.events) || data.events.length === 0) return;

  const store = readStore() || {};
  const feeds = { ...(store.feeds || {}), [key]: { at: now, userId, data } };
  writeStore({ ...store, feeds: trim(feeds, MAX_FEEDS) });
}

/**
 * The ranking we already paid a model for, if it was for exactly these events.
 *
 * The key carries the event ids, so a ranking can never outlive the calendar it
 * described. Anything the model said about an event that has since dropped off
 * the feed simply never matches again.
 */
export function readCampusRanking(key, { now = Date.now() } = {}) {
  const store = readStore();
  const entry = store?.ranks?.[key];
  if (!entry || !Array.isArray(entry.picks)) return null;
  if (!entry.at || now - entry.at > MAX_AGE_MS) return null;
  return entry.picks;
}

/** Remember a ranking, including one that picked nothing: that is an answer too. */
export function writeCampusRanking(key, picks, { now = Date.now() } = {}) {
  if (!key || !Array.isArray(picks)) return;

  const store = readStore() || {};
  const ranks = { ...(store.ranks || {}), [key]: { at: now, picks } };
  writeStore({ ...store, ranks: trim(ranks, MAX_RANKS) });
}

/**
 * "Updated 2 hours ago" — how old what you are looking at is.
 *
 * Only ever said about stored data, and only while a fresh read is running
 * behind it, so a student can tell the difference between a calendar we just
 * read and one we are still checking.
 */
export function describeAge(at, { now = Date.now() } = {}) {
  if (!at) return '';
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'an hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
