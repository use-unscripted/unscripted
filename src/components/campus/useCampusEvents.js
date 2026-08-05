import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchCampusEvents } from '@/lib/campus-events';
import { readCampusFeed, writeCampusFeed, clearCampusStore } from '@/lib/campus-store';
import { loadOwnedPaths } from '@/lib/path-set';
import { resolveJourney } from '@/lib/journey';

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

  /**
   * The path this student is currently testing.
   *
   * Ranking without it was the gap that made the relevance floor weaker here
   * than in the Mission Guide picker. The picker is handed a path because it is
   * building a guide around one; the dashboard and the calendar page were
   * ranking against the profile alone, so a student four weeks into testing
   * investment banking was judged on whatever they typed at signup. The path is
   * the strongest signal we have about what is worth their time and it was the
   * one thing these two surfaces never sent.
   */
  const [pathName, setPathName] = useState('');

  // "We have not looked yet" and "this student has no profile" are the same
  // `null`, and they must not be. The ranking is keyed on profile fields, so
  // ranking against a profile that is merely late produces a different key,
  // a second model call, and a recommendation written for nobody in
  // particular. Stored events arrive on the first frame now, well before the
  // profile does, so this race is live on every visit rather than theoretical.
  //
  // The path is read in the same pass and gates the same flag, for the same
  // reason: ranking against "no path yet" and then again once it lands is two
  // model calls and two different answers for one student on one visit.
  const [rankingReady, setRankingReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const userId = useRef('');

  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  /**
   * The student's own profile and the path they are testing, for ranking.
   *
   * The backend already reads the profile to filter the feed, but it does not
   * send it back, and the "why you should go" prompt needs the major and
   * interests to say anything specific. A missing profile just means a generic
   * ranking rather than none.
   *
   * It is also where a different student signing in on the same browser gets
   * caught. Stored events are public listings, not private data, but they are
   * the wrong school's, so the moment we know who is here they go.
   *
   * The path comes from the same two calls My Journey uses for its own "you're
   * currently testing X" line, rather than from the cycle entity. The cycle
   * looks like the right source and is not: Drew's account renders that line
   * correctly today with zero active cycle rows, so reading the cycle here
   * produced an empty path on the one screen that had a path on it. Sharing
   * the page's resolver is also what stops the two drifting apart later.
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

        const [rows, owned] = await Promise.all([
          base44.entities.StudentProfile.filter({ user_id: user.id }, '-created_date', 1),
          loadOwnedPaths().catch(() => ({ paths: [] })),
        ]);
        if (cancelled) return;
        setProfile(rows?.[0] || null);
        setPathName(resolveJourney({ paths: owned?.paths || [] }).currentPath?.path_name || '');
      } catch {
        if (!cancelled) { setProfile(null); setPathName(''); }
      } finally {
        // Ready either way. A student with no profile and no chosen path still
        // gets a ranking, just a generic one, and waiting forever for rows that
        // do not exist would hold the recommendation off the page permanently.
        if (!cancelled) setRankingReady(true);
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

    (async () => {
      const feed = await fetchCampusEvents({ days, limit });
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

  return { ...state, profile, pathName, rankingReady, retry, adopt };
}
