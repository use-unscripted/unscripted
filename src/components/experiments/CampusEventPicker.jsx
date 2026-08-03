import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2, Sparkles, Check, CalendarSearch, Link2, Search,
  RotateCw, School, ArrowRight, AlertCircle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  fetchCampusEvents,
  recommendCampusEvents,
  submitCalendarUrl,
  schoolEventsSearchUrl,
  SUBMISSION_REJECTIONS,
} from '@/lib/campus-events';
import CampusEventCard from './CampusEventCard';

/** How many real events to show when the model ranked none of them. */
const BROWSE_LIMIT = 6;

/**
 * Offers real, dated events on the student's own campus to anchor a guide to.
 *
 * The point is the deadline. Every experiment in this product asks a student to
 * pick their own start date, and none of them ever have. An event happens at a
 * time somebody else chose, which is the one thing a self-set goal cannot do.
 *
 * Entirely optional and never blocking: no calendar, no matches, or a failed
 * lookup all fall through to a normal guide.
 *
 * ## The empty states are most of this file, on purpose
 *
 * About one student in four attends a school whose calendar we cannot read, and
 * every one of them used to get the same grey sentence. That sentence was
 * accurate and completely useless — it named a dead end and offered no way out
 * of it, in a modal the student opened wanting to start something.
 *
 * So each way this comes up empty now ends in something the student can do, and
 * they are different things because the situations are:
 *
 *   no college     they never told us their school — so ask, right here, rather
 *                  than sending them to Settings and losing the guide they came
 *                  to make
 *   no feed        we cannot find their school's calendar — so let them tell us
 *                  where it is, which is knowledge they have and we don't
 *   nothing ranked the calendar works and is full of real events, the model just
 *                  judged none of them relevant — so show the events. We are
 *                  holding twenty real dated things happening on their campus,
 *                  and saying "nothing matches" while sitting on those is the
 *                  worst version of this screen
 *   empty feed     the calendar is real but has nothing upcoming at all
 *   feed error     the school's server didn't answer — so offer to try again
 *
 * None of them is a failure the student has to resolve, and every one keeps the
 * skip button in reach.
 */
export default function CampusEventPicker({ profile, pathName, selected, onSelect, disabled }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [college, setCollege] = useState('');
  const [picks, setPicks] = useState([]);
  // Kept whenever the feed answered, so "nothing matched" can still show the
  // student what is genuinely happening rather than describing an absence.
  const [feedEvents, setFeedEvents] = useState([]);

  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey(k => k + 1), []);

  // A profile object is rebuilt on every parent render, so depending on it
  // directly would re-run this effect forever — and each run costs a feed fetch
  // and a model call. The fields the lookup actually reads are what matter.
  const profileKey = [
    profile?.id, profile?.college, profile?.major,
    profile?.career_interests, profile?.favorite_topics, profile?.desired_skills,
  ].join('|');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const feed = await fetchCampusEvents({ days: 45, limit: 20 });
      if (cancelled) return;

      setCollege(feed.college || '');
      setFeedEvents(feed.events || []);

      if (!feed.events?.length) {
        setPicks([]);
        setStatus(feed.status || 'no_matches');
        setLoading(false);
        return;
      }

      const recommended = await recommendCampusEvents(feed.events, profile, { pathName });
      if (cancelled) return;

      setPicks(recommended);
      // A real feed full of real events that the model declined to rank is not
      // the same outcome as an empty calendar, and must not render as one.
      setStatus(recommended.length ? 'ok' : 'unranked');
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [profileKey, pathName, reloadKey]);

  /** A feed the student found for us: same shape, same rendering path. */
  const adoptSubmission = useCallback((result) => {
    setCollege(result.college || '');
    setFeedEvents(result.events || []);
    setPicks([]);
    setStatus(result.events?.length ? 'unranked' : 'no_feed');
  }, []);

  if (loading) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        Checking your campus calendar...
      </div>
    );
  }

  if (status === 'no_college') {
    return <NoCollegeState profile={profile} disabled={disabled} onSaved={retry} />;
  }
  if (status === 'no_feed') {
    return <NoFeedState college={college} disabled={disabled} onResolved={adoptSubmission} />;
  }
  if (status === 'feed_error') {
    return <FeedErrorState college={college} disabled={disabled} onRetry={retry} />;
  }
  if (status === 'no_matches') {
    return <EmptyCalendarState college={college} />;
  }

  const unranked = status === 'unranked';
  const events = unranked ? feedEvents.slice(0, BROWSE_LIMIT) : picks;

  return (
    <div className="mb-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[#334155]">
        <Sparkles size={14} style={{ color: 'var(--brand-gold-500, #D6B66A)' }} aria-hidden="true" />
        {unranked ? 'Nothing matched — but these are real' : 'Anchor this to something real'}
      </p>
      <p className="mb-3 mt-0.5 text-xs text-[#64748B]">
        {unranked
          ? <>Nothing on {college || 'your campus'}&apos;s calendar lines up with this experiment.
              These are happening anyway, and a date you didn&apos;t set still beats one you did.</>
          : <>Happening at {college}. Pick one and it becomes your first step — with a date you
              didn&apos;t have to invent.</>}
      </p>

      <div className="space-y-2" role="group" aria-label="Campus events">
        {events.map(event => {
          const isSelected = selected?.id === event.id;
          return (
            <div key={event.id}>
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : event)}
                disabled={disabled}
                aria-pressed={isSelected}
                className="w-full rounded-xl border-2 p-2 text-left transition disabled:opacity-60"
                style={{
                  borderColor: isSelected ? 'var(--brand-navy-700)' : 'transparent',
                  background: isSelected ? 'var(--background-tertiary, #EEF2F6)' : 'transparent',
                }}
              >
                <CampusEventCard event={event} college={college} compact />
                {event.guidance?.fit_reason && (
                  <p className="px-1 pb-0.5 pt-2 text-xs leading-relaxed text-[#334155]">
                    {event.guidance.fit_reason}
                  </p>
                )}
                <span
                  className="mt-1.5 flex items-center gap-1.5 px-1 pb-1 text-xs font-bold"
                  style={{ color: isSelected ? 'var(--brand-navy-700)' : '#64748B' }}
                >
                  {isSelected ? <><Check size={13} aria-hidden="true" /> Anchoring your guide to this</> : 'Use this event'}
                </span>
              </button>

              {isSelected && event.guidance?.what_to_do?.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                    What to do there
                  </p>
                  <ol className="space-y-1.5">
                    {event.guidance.what_to_do.map((action, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-[#334155]">
                        <span className="shrink-0 pt-px font-bold tabular-nums text-[#64748B]">{i + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                  {event.guidance.questions_to_ask?.length > 0 && (
                    <p className="mt-2 border-t border-dashed border-[#E2E8F0] pt-2 text-xs text-[#64748B]">
                      Your questions get written into the guide.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        disabled={disabled}
        aria-pressed={!selected}
        className="mt-2 w-full rounded-xl border px-4 py-2.5 text-left text-xs font-semibold transition disabled:opacity-60"
        style={{
          borderColor: !selected ? 'var(--brand-navy-700)' : '#E2E8F0',
          color: !selected ? 'var(--brand-navy-700)' : '#64748B',
        }}
      >
        Skip — build the guide without an event
      </button>
    </div>
  );
}

// ── Empty states ────────────────────────────────────────────────────────────

/**
 * The shared frame.
 *
 * Every one of these is a panel with a heading, one honest sentence, and
 * something to do. Keeping the shape identical is what stops an empty state
 * reading as an error — it is the same slot the events would have filled.
 */
function EmptyPanel({ icon: Icon, title, children }) {
  return (
    <div
      className="mb-5 overflow-hidden rounded-xl border px-4 py-3.5"
      style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[#334155]">
        <Icon size={14} className="shrink-0" style={{ color: 'var(--brand-gold-500, #D6B66A)' }} aria-hidden="true" />
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * The always-available way out, in every state where we have no calendar.
 *
 * Aligned to the top rather than the centre because these labels carry a
 * school's full name and wrap to two lines on a phone — centring leaves the
 * icon floating in the gap beside nothing.
 */
function SearchYourSchoolLink({ college, label, looking }) {
  const href = schoolEventsSearchUrl(college, looking);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2.5 inline-flex items-start gap-1.5 text-xs font-semibold transition hover:underline"
      style={{ color: 'var(--brand-navy-700)' }}
    >
      <Search size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{label || `Find ${college}'s events page`}</span>
    </a>
  );
}

/**
 * They never told us their school.
 *
 * Sending them to Settings would cost them this modal and the guide they came
 * here to generate, and most would not come back. One field, saved in place.
 */
function NoCollegeState({ profile, disabled, onSaved }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    const college = value.trim();
    if (!college || saving) return;

    setSaving(true);
    setError('');
    try {
      if (profile?.id) {
        await base44.entities.StudentProfile.update(profile.id, { college });
      } else {
        await base44.entities.StudentProfile.create({ college });
      }
      onSaved();
    } catch (err) {
      setSaving(false);
      setError(err?.message || "That didn't save. Try once more.");
    }
  }

  return (
    <EmptyPanel icon={School} title="Which school do you go to?">
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
        Tell us and we&apos;ll pull real events off your campus calendar — so the first step of
        your guide has a date somebody else already set.
      </p>

      {/*
        Stacked on a phone, side by side once there is room. Wrapping a fixed-
        width button under a full-width input strands it at half the panel's
        width, which reads as an afterthought rather than the thing to press.
      */}
      <form onSubmit={save} className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="campus-college">Your school</label>
        <input
          id="campus-college"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={disabled || saving}
          placeholder="Fairfield University"
          autoComplete="organization"
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1F3A5F] disabled:opacity-60"
          style={{ borderColor: '#E2E8F0' }}
        />
        <button
          type="submit"
          disabled={disabled || saving || !value.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition disabled:opacity-50"
          style={{ background: 'var(--brand-navy-700)' }}
        >
          {saving
            ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            : <ArrowRight size={13} aria-hidden="true" />}
          {saving ? 'Checking' : 'Find my events'}
        </button>
      </form>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#B91C1C]" role="alert">
          <AlertCircle size={12} aria-hidden="true" /> {error}
        </p>
      )}
      <p className="mt-2 text-xs text-[#94A3B8]">
        Saves to your profile. You can skip this and build the guide without an event.
      </p>
    </EmptyPanel>
  );
}

/**
 * Their school has no calendar we can find.
 *
 * This is the big one — roughly a quarter of our students — and the only state
 * where the student knows something we don't.
 *
 * ## Ask for the club portal, not the events page
 *
 * Measured, on the twelve US schools our own students typed that resolve to
 * nothing (`paste-check.ts` in the sweep harness, 2026-08-03):
 *
 *   the school's main events page   0 / 12
 *   the student-life / club portal  4 / 4 of the ones that run a readable one
 *
 * Every hit came from the portal and every miss from the calendar page. WPI's
 * 163 events are on myWPI, James Madison's 221 on BeInvolved, South Florida's
 * 947 on BullsConnect — and Columbia, which blocks our requests at Cloudflare
 * outright, still answers on its schools' CampusGroups portals.
 *
 * So the wording here is load-bearing, not decoration. "Paste your school's
 * events page" is the question that gets a 0% answer. Naming the portal is
 * what makes this feature work at all.
 *
 * The promise is kept honestly. If the link resolves, their events appear on
 * this screen immediately. It does not silently become the feed for everyone
 * else at their school — that is a review, not a side effect of one paste.
 */
function NoFeedState({ college, disabled, onResolved }) {
  const [value, setValue] = useState('');
  const [trying, setTrying] = useState(false);
  const [problem, setProblem] = useState('');
  const inputRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    const url = value.trim();
    if (!url || trying) return;

    setTrying(true);
    setProblem('');

    const result = await submitCalendarUrl(url, { days: 45, limit: 20 });

    if (result.status === 'ok' && result.events?.length) {
      onResolved(result);
      return;
    }

    setTrying(false);
    setProblem(
      result.status === 'submission_rejected'
        ? SUBMISSION_REJECTIONS[result.reason] || SUBMISSION_REJECTIONS.bad_url
        : result.reason || "We couldn't read a calendar at that address.",
    );
    inputRef.current?.focus();
  }

  return (
    <EmptyPanel icon={CalendarSearch} title={`No calendar we can read for ${college || 'your school'}`}>
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
        Your school&apos;s main events page usually isn&apos;t one we can read — but your{' '}
        <strong className="font-semibold text-[#334155]">club portal</strong> normally is. It&apos;s
        where clubs post their own events, and it&apos;s where the career ones actually live.
      </p>

      <form onSubmit={submit} className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="campus-feed-url">Your school&apos;s club portal</label>
        <input
          id="campus-feed-url"
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={disabled || trying}
          inputMode="url"
          placeholder="yourschool.campusgroups.com"
          aria-invalid={problem ? 'true' : undefined}
          aria-describedby={problem ? 'campus-feed-problem' : 'campus-feed-hint'}
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1F3A5F] disabled:opacity-60"
          style={{ borderColor: problem ? '#B91C1C' : '#E2E8F0' }}
        />
        <button
          type="submit"
          disabled={disabled || trying || !value.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition disabled:opacity-50"
          style={{ background: 'var(--brand-navy-700)' }}
        >
          {trying
            ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            : <Link2 size={13} aria-hidden="true" />}
          {trying ? 'Reading' : 'Try this link'}
        </button>
      </form>

      {problem ? (
        <p id="campus-feed-problem" role="alert" className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-[#B91C1C]">
          <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {problem}
        </p>
      ) : (
        <p id="campus-feed-hint" className="mt-2 text-xs text-[#94A3B8]">
          Engage, CampusGroups, Presence, BeInvolved — whatever yours calls &ldquo;get
          involved.&rdquo; Log in there and copy the address.
        </p>
      )}

      <SearchYourSchoolLink
        college={college}
        looking="student club portal get involved"
        label={`Find ${college || 'your school'}'s club portal`}
      />

      {/*
        Said plainly because it is true, and because it is the reason to bother.
        A student who finds this link fixes it for everyone behind them, and
        that is a better reason to spend thirty seconds than helping us.
      */}
      <p
        className="mt-2.5 border-t border-dashed pt-2.5 text-xs leading-relaxed text-[#64748B]"
        style={{ borderColor: '#E2E8F0' }}
      >
        If it works you&apos;ll see your events here straight away. We check it ourselves before
        turning it on for everyone else at {college || 'your school'}.
      </p>
    </EmptyPanel>
  );
}

/** The calendar is real and reachable — there is just nothing on it. */
function EmptyCalendarState({ college }) {
  return (
    <EmptyPanel icon={CalendarSearch} title="Nothing on your campus calendar right now">
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
        We can read {college || 'your school'}&apos;s calendar and it has nothing posted for the
        next six weeks. That usually means a break — worth checking again in a week.
      </p>
      <SearchYourSchoolLink college={college} label="Check the school's page yourself" />
    </EmptyPanel>
  );
}

/** Their school's server didn't answer. Ours to retry, not theirs to solve. */
function FeedErrorState({ college, disabled, onRetry }) {
  return (
    <EmptyPanel icon={RotateCw} title="Your campus calendar didn't answer">
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
        {college || 'Your school'}&apos;s calendar didn&apos;t respond just now. That&apos;s on their
        end and it usually passes.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:bg-white disabled:opacity-50"
          style={{ borderColor: 'rgba(31,58,95,0.3)', color: 'var(--brand-navy-700)' }}
        >
          <RotateCw size={12} aria-hidden="true" /> Try again
        </button>
        <SearchYourSchoolLink college={college} />
      </div>
    </EmptyPanel>
  );
}
