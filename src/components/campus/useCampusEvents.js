import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchCampusEvents } from '@/lib/campus-events';

/**
 * The student's campus feed, for surfaces that show the calendar itself.
 *
 * Shared by the dashboard panel and the campus calendar page so the two never
 * disagree about what is happening this month.
 *
 * ## No model call
 *
 * The Mission Guide picker ranks these events with the LLM, because there it is
 * choosing one event to build a guide around and the ranking is the product.
 * A calendar is not choosing — it is showing the student what exists, and every
 * event here is already keyword-matched to their interests server-side.
 *
 * That distinction is worth keeping: the dashboard loads on every visit, and
 * putting a model call on it would add seconds and a per-visit cost to a
 * surface whose whole job is to render immediately.
 *
 * ## Never throws
 *
 * `fetchCampusEvents` resolves with a status instead of rejecting, because a
 * campus calendar is an optional enhancement. Callers render an empty state,
 * not an error boundary.
 */
export default function useCampusEvents({ days = 60, limit = 40 } = {}) {
  const [state, setState] = useState({ loading: true, status: '', college: '', events: [] });
  const [profile, setProfile] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  /**
   * The student's own profile, for ranking.
   *
   * The backend already reads this to filter the feed, but it does not send it
   * back, and the "why you should go" prompt needs the major and interests to
   * say anything specific. A missing profile just means unranked events.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        const rows = await base44.entities.StudentProfile.filter({ user_id: user.id }, '-created_date', 1);
        if (!cancelled) setProfile(rows?.[0] || null);
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  /**
   * Adopt a feed the student pointed us at themselves.
   *
   * Same shape as a feed we found, so it flows into the same rendering path —
   * their events appear on this request rather than after a review.
   */
  const adopt = useCallback(result => {
    setState({
      loading: false,
      status: result?.events?.length ? 'ok' : 'no_feed',
      college: result?.college || '',
      events: result?.events || [],
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true }));

    (async () => {
      const feed = await fetchCampusEvents({ days, limit });
      if (cancelled) return;

      setState({
        loading: false,
        // An empty list from a working feed is 'no_matches', which reads very
        // differently to a school we cannot reach at all.
        status: feed.events?.length ? 'ok' : feed.status || 'no_matches',
        college: feed.college || '',
        events: feed.events || [],
      });
    })();

    return () => { cancelled = true; };
  }, [days, limit, reloadKey]);

  return { ...state, profile, retry, adopt };
}
