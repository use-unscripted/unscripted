import { useEffect, useState } from 'react';
import { recommendCampusEvents } from '@/lib/campus-events';

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
 * ## Ranked once, reused everywhere
 *
 * A model call per surface per visit would put seconds and a cost on the
 * dashboard, which has to render immediately. The cache below is keyed on what
 * the answer actually depends on — who the student is and which events they
 * were handed — so the calendar page and the dashboard section share one call,
 * and navigating between them costs nothing.
 *
 * Module-level, so it lives as long as the tab and dies with it. A stale
 * ranking is not a risk worth persisting against: the feed window moves daily,
 * which changes the key anyway.
 */
const cache = new Map();

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

export default function useCampusPicks(events, profile, { pathName = '' } = {}) {
  const ready = Array.isArray(events) && events.length > 0;
  const key = ready ? cacheKey(events, profile, pathName) : '';

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
  const cached = key && cache.has(key) ? cache.get(key) : null;
  const picks = cached || (resolved.key === key ? resolved.picks : []);
  const loading = Boolean(key) && !cached && resolved.key !== key;

  useEffect(() => {
    if (!key || cache.has(key)) return;

    let cancelled = false;

    (async () => {
      // Never throws — an unranked calendar is a worse calendar, not a broken
      // one, and every caller falls back to plain chronological order.
      const ranked = await recommendCampusEvents(events, profile, { pathName });
      if (cancelled) return;
      cache.set(key, ranked);
      setResolved({ key, picks: ranked });
    })();

    return () => { cancelled = true; };
    // Deliberately keyed on the signature rather than the objects: `events` and
    // `profile` are rebuilt on every parent render, and depending on them
    // directly would re-run a model call forever.
  }, [key]);

  return { loading, picks };
}
