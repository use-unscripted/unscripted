import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchCampusEvents } from '@/lib/campus-events';
import { readCampusFeed, writeCampusFeed, clearCampusStore } from '@/lib/campus-store';

/**
 * The student's campus feed, for surfaces that show the calendar itself.
 *
 * Shared by the dashboard panel and the campus calendar page so the two never
 * disagree about what is happening this month.
 *
 * ## Stored, then refreshed behind what is already on screen
 *
 * Reading a school's calendar is slow and cannot be made fast: the backend has
 * to resolve the feed, fetch the whole thing, and expand repeating events. The
 * first visit pays that in full and says so.
 *
 * Every visit after it starts from the calendar we stored last time, rendered
 * on the first frame, while a fresh read runs behind it. Nothing is hidden and
 * nothing is blanked out mid-update: the student reads real events the whole
 * time, and the list swaps for the new one when it arrives. `refreshing` is
 * there so a surface can say so quietly, not so it can put up a spinner.
 *
 * ## No model call
 *
 * The Mission Guide picker ranks these events with the LLM, because there it is
 * choosing one event to build a guide around and the ranking is the product.
 * A calendar is not choosing — it is showing the student what exists, and every
 * event here is already keyword-matched to their interests server-side.
 *
 * ## Never throws
 *
 * `fetchCampusEvents` resolves with a status instead of rejecting, because a
 * campus calendar is an optional enhancement. Callers render an empty state,
 * not an error boundary.
 */
export default function useCampusEvents({ days = 60, limit = 40 } = {}) {
  const storeKey = `feed:${days}:${limit}`;

  const [state, setState] = useState(() => {
    // Read during the initial render, not in an effect, so a returning student
    // never sees a frame of loading state before their own calendar appears.
    const stored = readCampusFeed(storeKey);
    if (!stored) {
      return { loading: true, refreshing: true, cachedAt: 0, status: '', college: '', events: [] };
    }
    return {
      loading: false,
      refreshing: true,
      cachedAt: stored.at,
      status: 'ok',
      college: stored.data.college || '',
      events: stored.data.events,
    };
  });

  const [profile, setProfile] = useState(null);
  // "We have not looked yet" and "this student has no profile" are the same
  // `null`, and they must not be. The ranking is keyed on profile fields, so
  // ranking against a profile that is merely late produces a different key,
  // a second model call, and a recommendation written for nobody in
  // particular. Stored events arrive on the first frame now, well before the
  // profile does, so this race is live on every visit rather than theoretical.
  const [profileReady, setProfileReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const userId = useRef('');
  // Which reload the feed effect below has already served. Anything past the
  // first is the student pressing "try again", and that has to reach the server
  // as a real refresh. See the effect.
  const servedReload = useRef(0);

  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  /**
   * The student's own profile, for ranking.
   *
   * The backend already reads this to filter the feed, but it does not send it
   * back, and the "why you should go" prompt needs the major and interests to
   * say anything specific. A missing profile just means unranked events.
   *
   * It is also where a different student signing in on the same browser gets
   * caught. Stored events are public listings, not private data, but they are
   * the wrong school's, so the moment we know who is here they go.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (cancelled) return;
        userId.current = user?.id || '';

        const stored = readCampusFeed(storeKey);
        if (stored && stored.userId && stored.userId !== userId.current) {
          clearCampusStore();
          setState(prev => (prev.cachedAt ? { ...prev, events: [], status: '', loading: true } : prev));
        }

        const rows = await base44.entities.StudentProfile.filter({ user_id: user.id }, '-created_date', 1);
        if (!cancelled) setProfile(rows?.[0] || null);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        // Ready either way. A student with no profile still gets a ranking,
        // just a generic one, and waiting forever for a row that does not
        // exist would hold the recommendation off the page permanently.
        if (!cancelled) setProfileReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey, storeKey]);

  /**
   * Adopt a feed the student pointed us at themselves.
   *
   * Same shape as a feed we found, so it flows into the same rendering path —
   * their events appear on this request rather than after a review.
   */
  const adopt = useCallback(result => {
    const events = result?.events || [];
    if (events.length) {
      writeCampusFeed(storeKey, { college: result?.college || '', events }, { userId: userId.current });
    }
    setState({
      loading: false,
      refreshing: false,
      cachedAt: events.length ? Date.now() : 0,
      status: events.length ? 'ok' : 'no_feed',
      college: result?.college || '',
      events,
    });
  }, [storeKey]);

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, refreshing: true }));

    // The server keeps its own copy of the school's calendar for a day, shared
    // by everyone there, so clearing what this browser remembers is no longer
    // the whole of a retry. A student pressing "try again" is telling us they
    // think what they are looking at is wrong, and handing them back the same
    // stored list is the one thing that button must not do. Ordinary renders
    // stay off it, or every visit would make the school fetch its own calendar
    // again and the shared copy would never be worth having.
    const isRetry = reloadKey !== servedReload.current;
    servedReload.current = reloadKey;

    (async () => {
      const feed = await fetchCampusEvents({ days, limit, refresh: isRetry });
      if (cancelled) return;

      const events = feed.events || [];
      if (events.length) {
        writeCampusFeed(storeKey, { college: feed.college || '', events }, { userId: userId.current });
      }

      setState(prev => {
        // A school that failed to answer, when we are already showing that
        // school's calendar, is a refresh that did not land. Replacing real
        // events with an error would be telling the student their calendar
        // broke, when what actually happened is that it did not change.
        if (feed.status === 'feed_error' && prev.events.length) {
          return { ...prev, loading: false, refreshing: false };
        }

        return {
          loading: false,
          refreshing: false,
          cachedAt: events.length ? Date.now() : 0,
          // An empty list from a working feed is 'no_matches', which reads very
          // differently to a school we cannot reach at all.
          status: events.length ? 'ok' : feed.status || 'no_matches',
          college: feed.college || prev.college || '',
          events,
        };
      });
    })();

    return () => { cancelled = true; };
  }, [days, limit, reloadKey, storeKey]);

  return { ...state, profile, profileReady, retry, adopt };
}
