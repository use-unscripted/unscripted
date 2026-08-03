import { useEffect, useRef, useState } from 'react';
import { recommendCampusEvents } from '@/lib/campus-events';
import { readCampusRanking, writeCampusRanking } from '@/lib/campus-store';

/**
 * The two or three events on this student's campus actually worth their time,
 * each with a sentence saying why.
 *
 * ## This is the product, and it was only ever shown in one place
 *
 * The ranking and the "why you should go" copy already existed — the Mission
 * Guide generator has written them since campus events shipped. But they were
 * only ever rendered inside guide generation, which has run eleven times ever.
 * The calendar was showing the same student the same events with no opinion
 * about any of them, which is a listings page, not a recommendation.
 *
 * ## Ranked once, reused everywhere, and remembered between visits
 *
 * A model call per surface per visit would put seconds and a cost on the
 * dashboard, which has to render immediately. The cache below is keyed on what
 * the answer actually depends on — who the student is and which events they
 * were handed — so the calendar page and the dashboard section share one call,
 * and navigating between them costs nothing.
 *
 * It is written to the device as well as held in memory. The stored feed comes
 * back on the next visit with the same event ids in it, which means the same
 * key, which means the recommendation the student read yesterday is on screen
 * before the network is touched. Only a genuinely different set of events costs
 * another model call.
 *
 * ## The previous answer stays up while a new one is worked out
 *
 * When the background refresh changes the feed, the key changes with it. The
 * last ranking keeps rendering until the new one lands, because it describes
 * events that are still on the calendar and blanking it would take the only
 * opinion on the page away for a few seconds. Picks for events that dropped off
 * the feed fall out on their own: every surface renders picks by matching them
 * against the events it is showing.
 */
const cache = new Map();

/** Keys we have already looked for on disk, hit or miss. */
const hydrated = new Set();

/** What the ranking depends on. Anything else changing must not re-run it. */
function cacheKey(events, profile, pathName) {
  return [
    profile?.id || '',
    profile?.major || '',
    profile?.career_interests || '',
    profile?.favorite_topics || '',
    profile?.desired_skills || '',
    pathName || '',
    events.map(e => e.id).join(','),
  ].join('|');
}

/** The answer for this key, from memory or from the last visit. */
function lookup(key) {
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  if (!hydrated.has(key)) {
    hydrated.add(key);
    const stored = readCampusRanking(key);
    if (stored) {
      cache.set(key, stored);
      return stored;
    }
  }
  return null;
}

/**
 * `ready` is the caller saying the profile has been looked for.
 *
 * It is not optional plumbing. The key below is built out of profile fields, so
 * asking before the profile has arrived ranks against an empty student, under a
 * key nothing will ever match again, and pays for a model call to do it. Stored
 * events render on the first frame now, which is well before any profile read
 * can finish, so this happened on every single visit until it was passed.
 */
export default function useCampusPicks(events, profile, { pathName = '', ready = true } = {}) {
  const havePool = Array.isArray(events) && events.length > 0;
  const key = havePool && ready ? cacheKey(events, profile, pathName) : '';

  const [resolved, setResolved] = useState({ key: '', picks: [] });

  /*
    `loading` is derived during render, not set from inside the effect.

    Effects run after paint. Starting this hook at "not loading, no picks" and
    flipping it in the effect left exactly one frame where the events existed
    and the ranking had not been asked for yet — long enough to paint an
    unranked list before the skeleton replaced it, which is the flicker this
    was supposed to prevent. Deriving it means the very first render that has
    events already knows a ranking is owed.
  */
  const cached = lookup(key);
  const answered = key ? (cached || (resolved.key === key ? resolved.picks : null)) : null;
  // Events with no ranking yet is a ranking owed, whether the wait is the model
  // or the profile read in front of it.
  const loading = havePool && !answered;

  // What was on screen a moment ago, kept so a re-rank never empties the page.
  const previous = useRef([]);
  if (answered) previous.current = answered;

  const picks = answered || previous.current;

  useEffect(() => {
    if (!key || cache.has(key)) return;

    let cancelled = false;

    (async () => {
      // Never throws — an unranked calendar is a worse calendar, not a broken
      // one, and every caller falls back to plain chronological order.
      const ranked = await recommendCampusEvents(events, profile, { pathName });
      if (cancelled) return;
      cache.set(key, ranked);
      // Only a real answer is worth keeping for a fortnight. An empty ranking
      // is either "none of these fit" or a model call that failed, and those
      // two are indistinguishable from here — storing the second would leave a
      // student with no recommendations for two weeks over one bad request.
      if (ranked.length) writeCampusRanking(key, ranked);
      setResolved({ key, picks: ranked });
    })();

    return () => { cancelled = true; };
    // Deliberately keyed on the signature rather than the objects: `events` and
    // `profile` are rebuilt on every parent render, and depending on them
    // directly would re-run a model call forever.
  }, [key]);

  return { loading, picks };
}
