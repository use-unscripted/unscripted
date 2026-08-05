import { useEffect, useRef, useState } from 'react';
import {
  Loader2, Sparkles, Check, CalendarSearch, Link2, Search,
  RotateCw, School, ArrowRight, AlertCircle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  submitCalendarUrl,
  reportFeedWrong,
  schoolEventsSearchUrl,
  SUBMISSION_REJECTIONS,
} from '@/lib/campus-events';
import useCampusEvents from '@/components/campus/useCampusEvents';
import useCampusPicks from '@/components/campus/useCampusPicks';
import CampusEventCard from './CampusEventCard';
import { Sk } from '@/components/PageSkeleton';

/** How many real events to show when the model ranked none of them. */
const BROWSE_LIMIT = 6;

/**
 * How many to show while the ranking is still running.
 *
 * Three, because three is what a ranking comes back with. Six here and three a
 * moment later would shrink the dialog under the reader's cursor, which is the
 * same jump the reserved skeleton was built to avoid.
 */
const RANKING_PREVIEW = 3;

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
 * accurate and completely useless. It named a dead end and offered no way out
 * of it, in a modal the student opened wanting to start something.
 *
 * So each way this comes up empty now ends in something the student can do, and
 * they are different things because the situations are:
 *
 *   no college     they never told us their school, so ask, right here, rather
 *                  than sending them to Settings and losing the guide they came
 *                  to make
 *   no feed        we cannot find their school's calendar, so let them tell us
 *                  where it is, which is knowledge they have and we don't
 *   nothing ranked the calendar works and is full of real events, the model just
 *                  judged none of them relevant, so show the events. We are
 *                  holding twenty real dated things happening on their campus,
 *                  and saying "nothing matches" while sitting on those is the
 *                  worst version of this screen
 *   empty feed     the calendar is real but has nothing upcoming at all
 *   feed error     the school's server didn't answer, so offer to try again
 *
 * None of them is a failure the student has to resolve, and every one keeps the
 * skip button in reach.
 *
 * ## It reads the calendar the app already has
 *
 * This used to run its own fetch on its own window: 45 days, 20 events, which
 * matched nothing else in the product. The dashboard and the campus page share
 * a feed on a different window, kept on the device and rendered on the first
 * frame, so a student who had already seen their own calendar somewhere else
 * opened this and watched it get read from scratch, in a modal they opened
 * wanting to start something.
 *
 * Same hook now, same window, same stored answer. For almost everyone the
 * events are simply on screen when this opens. The ranking comes back for free
 * too whenever the student is testing the path this experiment belongs to,
 * because that is the key the dashboard already paid for.
 *
 * ## Nothing waits on the ranking
 *
 * The ranking is a model call measured at ~22s, and it used to hold a full
 * panel over real events we already had in hand, with a full-width Generate
 * button sitting underneath giving no reason on earth to wait for it. The
 * events render immediately and stay pickable the whole time; the ranking
 * arrives on top of them and cuts the list to the ones worth the walk, with a
 * sentence saying why. `onBusy` is how the generator knows to stop calling its
 * own button ready.
 */
export default function CampusEventPicker({ pathName, selected, onSelect, disabled, onBusy }) {
  const {
    loading, status, college, events: feedEvents, profile, pathName: journeyPath, rankingReady, retry, adopt,
  } = useCampusEvents({ days: 60, limit: 40 });

  // The experiment's own path is the sharper question: this is choosing an
  // event to build THIS guide around. Falling back to the path the student is
  // testing keeps the key identical to the dashboard's in the ordinary case,
  // where those are the same path and the ranking has already been paid for.
  const { loading: ranking, picks } = useCampusPicks(feedEvents, profile, {
    pathName: pathName || journeyPath,
    ready: rankingReady,
  });

  const hasEvents = feedEvents.length > 0;
  // Anything still to come that would change what is on this screen. The
  // generator relabels its own button off this, so it must not stay true once
  // there is nothing left to arrive.
  const busy = loading || (hasEvents && ranking);
  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);

  // Only until the calendar itself lands. Past that there are real events to
  // read, so this is never a shimmer over content we are already holding.
  if (loading && !hasEvents) {
    // This sits inside an open modal, and the old single-line "Checking your
    // campus calendar…" bar meant the dialog grew by ~300px under the reader's
    // cursor when the events landed. So trace what it becomes: heading, two
    // lines of explanation, then event cards at the height a real one occupies
    // once its date, venue and confirm-before-you-go panel are on it.
    return (
      <div className="mb-5" style={{ minHeight: 564 }}>
        <div className="flex h-5 items-center gap-1.5">
          <Sk h={14} w={14} r={4} />
          <Sk h={13} w={196} r={4} />
        </div>
        <div className="mb-3 mt-1">
          <div className="flex h-4 items-center"><Sk h={11} w="94%" r={4} /></div>
          <div className="flex h-4 items-center"><Sk h={11} w="62%" r={4} /></div>
        </div>
        <div className="space-y-2">
          {[0, 1].map(i => <Sk key={i} h={244} r={12} />)}
        </div>
      </div>
    );
  }

  if (!hasEvents) {
    if (status === 'no_college') {
      return <NoCollegeState profile={profile} disabled={disabled} onSaved={retry} />;
    }
    if (status === 'no_feed') {
      return <NoFeedState college={college} disabled={disabled} onResolved={adopt} />;
    }
    if (status === 'feed_error') {
      return <FeedErrorState college={college} disabled={disabled} onRetry={retry} />;
    }
    return <EmptyCalendarState college={college} />;
  }

  // A real feed full of real events that the model declined to rank is not the
  // same outcome as an empty calendar, and must not render as one.
  const unranked = !ranking && picks.length === 0;
  const events = ranking
    ? feedEvents.slice(0, RANKING_PREVIEW)
    : unranked ? feedEvents.slice(0, BROWSE_LIMIT) : picks;

  return (
    <div className="mb-5">
      <p className="tp-body flex items-center gap-1.5 font-semibold text-[color:var(--ink-700)]">
        <Sparkles size={14} style={{ color: 'var(--brand-gold-500, var(--brand-gold-500))' }} aria-hidden="true" />
        {ranking
          ? 'Finding the ones worth your time'
          : unranked ? 'Nothing matched, but these are real' : 'Anchor this to something real'}
      </p>
      <p className="tp-meta mb-3 mt-0.5 text-[color:var(--ink-500)]">
        {ranking
          ? <>These are happening at {college || 'your school'}. Working out which ones fit this
              experiment takes about twenty seconds, and you can pick one now if you already
              see it.</>
          : unranked
            ? <>Nothing on {college || 'your campus'}&apos;s calendar lines up with this experiment.
                These are happening anyway.</>
            : <>Happening at {college}. Pick one and it becomes your first step, with a date you
                didn&apos;t have to invent.</>}
      </p>

      {ranking && (
        <div
          className="mb-3 h-1 w-40 overflow-hidden rounded-full"
          style={{ background: 'var(--ink-200)' }}
          role="status"
          aria-live="polite"
          aria-label={`Picking the events that fit this experiment at ${college || 'your school'}`}
        >
          <div className="picker-progress h-full rounded-full" style={{ background: 'var(--brand-navy-700)' }} />
        </div>
      )}

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
                  background: isSelected ? 'var(--background-tertiary, var(--ink-100))' : 'transparent',
                }}
              >
                <CampusEventCard event={event} college={college} compact />
                {event.guidance?.fit_reason && (
                  <p className="tp-meta px-1 pb-0.5 pt-2 text-[color:var(--ink-700)]">
                    {event.guidance.fit_reason}
                  </p>
                )}
                <span
                  className="tp-meta mt-1.5 flex items-center gap-1.5 px-1 pb-1 font-bold"
                  style={{ color: isSelected ? 'var(--brand-navy-700)' : 'var(--ink-500)' }}
                >
                  {isSelected ? <><Check size={13} aria-hidden="true" /> Anchoring your guide to this</> : 'Use this event'}
                </span>
              </button>

              {isSelected && event.guidance?.what_to_do?.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-2.5">
                  <p className="tp-eyebrow mb-1.5 text-[color:var(--ink-500)]">
                    What to do there
                  </p>
                  <ol className="space-y-1.5">
                    {event.guidance.what_to_do.map((action, i) => (
                      <li key={i} className="tp-body flex gap-2 text-[color:var(--ink-700)]">
                        <span className="shrink-0 pt-px font-bold tabular-nums text-[color:var(--ink-500)]">{i + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                  {event.guidance.questions_to_ask?.length > 0 && (
                    <p className="tp-meta mt-2 border-t border-dashed border-[color:var(--ink-200)] pt-2 text-[color:var(--ink-500)]">
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
        className="tp-meta mt-2 w-full rounded-xl border px-4 py-3 text-left font-semibold transition disabled:opacity-60"
        style={{
          borderColor: !selected ? 'var(--brand-navy-700)' : 'var(--ink-200)',
          color: !selected ? 'var(--brand-navy-700)' : 'var(--ink-500)',
        }}
      >
        Skip and build the guide without an event
      </button>

      <WrongCalendarButton college={college} />
    </div>
  );
}

// ── Empty states ────────────────────────────────────────────────────────────

/**
 * The shared frame.
 *
 * Every one of these is a panel with a heading, one honest sentence, and
 * something to do. Keeping the shape identical is what stops an empty state
 * reading as an error. It is the same slot the events would have filled.
 */
function EmptyPanel({ icon: Icon, title, children }) {
  return (
    <div
      className="mb-5 overflow-hidden rounded-xl border px-4 py-3.5"
      style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}
    >
      <p className="tp-body flex items-center gap-1.5 font-semibold text-[color:var(--ink-700)]">
        <Icon size={14} className="shrink-0" style={{ color: 'var(--brand-gold-500, var(--brand-gold-500))' }} aria-hidden="true" />
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
 * school's full name and wrap to two lines on a phone, and centring leaves the
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
      className="tp-meta mt-2.5 inline-flex items-start gap-1.5 font-semibold transition hover:underline"
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
      // The account record is the one that always counts: the backend reads
      // the profile first and falls back to this, and a student who has no
      // profile row yet would otherwise save a college nothing ever reads.
      // Creating a profile row from this screen is not the fix: that just
      // makes a second one.
      await base44.auth.updateMe({ college });
      if (profile?.id) {
        await base44.entities.StudentProfile.update(profile.id, { college });
      }
      onSaved();
    } catch (err) {
      setSaving(false);
      setError(err?.message || "That didn't save. Try once more.");
    }
  }

  return (
    <EmptyPanel icon={School} title="Which school do you go to?">
      <p className="tp-meta mt-1 text-[color:var(--ink-500)]">
        Tell us and we&apos;ll pull real events off your campus calendar, so the first step of
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
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base md:text-sm outline-none transition focus:border-[color:var(--brand-navy-900)] disabled:opacity-60"
          style={{ borderColor: 'var(--ink-200)' }}
        />
        <button
          type="submit"
          disabled={disabled || saving || !value.trim()}
          className="tp-meta inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 font-bold text-white transition disabled:opacity-50"
          style={{ background: 'var(--brand-navy-700)' }}
        >
          {saving
            ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            : <ArrowRight size={13} aria-hidden="true" />}
          {saving ? 'Checking' : 'Find my events'}
        </button>
      </form>

      {error && (
        <p className="tp-meta mt-2 flex items-center gap-1.5 text-[color:var(--danger-700)]" role="alert">
          <AlertCircle size={12} aria-hidden="true" /> {error}
        </p>
      )}
      <p className="tp-meta mt-2 text-[color:var(--ink-400)]">
        Saves to your profile. You can skip this and build the guide without an event.
      </p>
    </EmptyPanel>
  );
}

/**
 * Their school has no calendar we can find.
 *
 * This is the big one (roughly a quarter of our students) and the only state
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
 * 947 on BullsConnect. Columbia, which blocks our requests at Cloudflare
 * outright, still answers on its schools' CampusGroups portals.
 *
 * So the wording here is load-bearing, not decoration. "Paste your school's
 * events page" is the question that gets a 0% answer. Naming the portal is
 * what makes this feature work at all.
 *
 * The promise is kept honestly. If the link resolves, their events appear on
 * this screen immediately. It does not silently become the feed for everyone
 * else at their school: that is a review, not a side effect of one paste.
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
      <p className="tp-meta mt-1 text-[color:var(--ink-500)]">
        Your school&apos;s main events page usually isn&apos;t one we can read, but your{' '}
        <strong className="font-semibold text-[color:var(--ink-700)]">club portal</strong> normally is. It&apos;s
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
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base md:text-sm outline-none transition focus:border-[color:var(--brand-navy-900)] disabled:opacity-60"
          style={{ borderColor: problem ? 'var(--danger-700)' : 'var(--ink-200)' }}
        />
        <button
          type="submit"
          disabled={disabled || trying || !value.trim()}
          className="tp-meta inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 font-bold text-white transition disabled:opacity-50"
          style={{ background: 'var(--brand-navy-700)' }}
        >
          {trying
            ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            : <Link2 size={13} aria-hidden="true" />}
          {trying ? 'Reading' : 'Try this link'}
        </button>
      </form>

      {problem ? (
        <p id="campus-feed-problem" role="alert" className="tp-meta mt-2 flex items-start gap-1.5 text-[color:var(--danger-700)]">
          <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {problem}
        </p>
      ) : (
        <p id="campus-feed-hint" className="tp-meta mt-2 text-[color:var(--ink-400)]">
          Engage, CampusGroups, Presence, BeInvolved: whatever yours calls &ldquo;get
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
        className="tp-meta mt-2.5 border-t border-dashed pt-2.5 text-[color:var(--ink-500)]"
        style={{ borderColor: 'var(--ink-200)' }}
      >
        If it works you&apos;ll see your events here straight away. We check it ourselves before
        turning it on for everyone else at {college || 'your school'}.
      </p>
    </EmptyPanel>
  );
}

/**
 * "This isn't my school's calendar."
 *
 * The one failure the backend cannot see. A feed can resolve, read cleanly and
 * return a hundred genuinely real events that belong to the library, the
 * athletics department, or a different campus of the same system. Every check
 * we have passes, and nothing downstream can tell. The student looking at it
 * can tell in a second.
 *
 * Deliberately quiet and deliberately last. It sits under the events rather
 * than beside them, because for almost everyone the calendar is right and a
 * prominent "is this wrong?" invites doubt about events that are fine.
 *
 * Nothing changes for this student when they press it. Acting on one report by
 * pulling a school's calendar would hand any single student a switch over
 * everyone else's, so it goes to the same review queue every other school-wide
 * change goes through, and the copy says so rather than implying a fix.
 */
function WrongCalendarButton({ college }) {
  const [state, setState] = useState('idle');
  const [note, setNote] = useState('');

  if (state === 'sent') {
    return (
      <p className="tp-meta mt-3 text-[color:var(--ink-500)]">
        Thanks. We&apos;ll look at {college || 'your school'}&apos;s calendar.
      </p>
    );
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setState('asking')}
        className="tp-meta mt-3 py-1 font-semibold underline decoration-dotted underline-offset-2 transition hover:no-underline"
        style={{ color: 'var(--ink-500)' }}
      >
        These aren&apos;t {college ? `${college}'s` : 'my school’s'} events
      </button>
    );
  }

  async function send() {
    setState('sending');
    const { status } = await reportFeedWrong(note.trim());
    // "We already have your report" is a success from where the student sits,
    // and telling them otherwise invites them to send it again.
    setState(status === 'report_failed' ? 'failed' : 'sent');
  }

  return (
    <div className="mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--ink-200)' }}>
      <label htmlFor="wrong-calendar-note" className="tp-meta font-semibold text-[color:var(--ink-700)]">
        What&apos;s wrong with it? Optional.
      </label>
      <input
        id="wrong-calendar-note"
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="e.g. this is the law school's calendar"
        maxLength={200}
        className="mt-1.5 w-full rounded-lg border px-2.5 py-2 text-base md:text-sm"
        style={{ borderColor: 'var(--ink-200)' }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={state === 'sending'}
          className="tp-meta inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-bold text-white transition disabled:opacity-50"
          style={{ background: 'var(--brand-navy-700)' }}
        >
          {state === 'sending' && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
          Send it
        </button>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="tp-meta font-semibold text-[color:var(--ink-500)] transition hover:underline"
        >
          Never mind
        </button>
        {state === 'failed' && (
          <span className="tp-meta" style={{ color: 'var(--danger-700)' }}>That didn&apos;t send. Try again in a moment.</span>
        )}
      </div>
    </div>
  );
}

/** The calendar is real and reachable, there is just nothing on it. */
function EmptyCalendarState({ college }) {
  return (
    <EmptyPanel icon={CalendarSearch} title="Nothing on your campus calendar right now">
      <p className="tp-meta mt-1 text-[color:var(--ink-500)]">
        We can read {college || 'your school'}&apos;s calendar and it has nothing posted for the
        next six weeks. That usually means a break. Worth checking again in a week.
      </p>
      <SearchYourSchoolLink college={college} label="Check the school's page yourself" />
      {/* The state where a wrong calendar is most obvious: their campus is busy
          and ours says it is empty. */}
      <WrongCalendarButton college={college} />
    </EmptyPanel>
  );
}

/** Their school's server didn't answer. Ours to retry, not theirs to solve. */
function FeedErrorState({ college, disabled, onRetry }) {
  return (
    <EmptyPanel icon={RotateCw} title="Your campus calendar didn't answer">
      <p className="tp-meta mt-1 text-[color:var(--ink-500)]">
        {college || 'Your school'}&apos;s calendar didn&apos;t respond just now. That&apos;s on their
        end and it usually passes.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="tp-meta inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-bold transition hover:bg-white disabled:opacity-50"
          style={{ borderColor: 'rgba(31,58,95,0.3)', color: 'var(--brand-navy-700)' }}
        >
          <RotateCw size={12} aria-hidden="true" /> Try again
        </button>
        <SearchYourSchoolLink college={college} />
      </div>
    </EmptyPanel>
  );
}
