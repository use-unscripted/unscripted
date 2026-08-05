import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, CalendarSearch, Link2, Search,
  RotateCw, School, ArrowRight, AlertCircle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  submitCalendarUrl,
  schoolEventsSearchUrl,
  SUBMISSION_REJECTIONS,
} from '@/lib/campus-events';

/**
 * What a student sees when we have no events for them.
 *
 * Lifted out of the Mission Guide picker so the campus calendar shows the same
 * five states rather than a second, worse set of them. The wording below is
 * measured, not written — see the note on NoFeedState — and a duplicate would
 * have drifted from it within a session.
 *
 * Every one ends in something the student can do. About one in four attends a
 * school whose calendar we cannot read, and none of these is a failure they
 * have to resolve.
 */


/**
 * The shared frame.
 *
 * Every one of these is a panel with a heading, one honest sentence, and
 * something to do. Keeping the shape identical is what stops an empty state
 * reading as an error — it is the same slot the events would have filled.
 */
export function EmptyPanel({ icon: Icon, title, className = 'mb-5', children }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border px-4 py-3.5 ${className}`}
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
export function SearchYourSchoolLink({ college, label, looking }) {
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
export function NoCollegeState({ profile, disabled, onSaved, className }) {
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
      // Creating a profile row from this screen is not the fix — that just
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
    <EmptyPanel icon={School} title="Which school do you go to?" className={className}>
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
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
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base md:text-sm outline-none transition focus:border-[#1F3A5F] disabled:opacity-60"
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
export function NoFeedState({ college, disabled, onResolved, className }) {
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
    <EmptyPanel icon={CalendarSearch} title={`No calendar we can read for ${college || 'your school'}`} className={className}>
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
        Your school&apos;s main events page usually isn&apos;t one we can read, but your{' '}
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
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base md:text-sm outline-none transition focus:border-[#1F3A5F] disabled:opacity-60"
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
export function EmptyCalendarState({ college, className }) {
  return (
    <EmptyPanel icon={CalendarSearch} title="Nothing on your campus calendar right now" className={className}>
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
        We can read {college || 'your school'}&apos;s calendar and it has nothing posted for the
        next six weeks. That usually means a break. Worth checking again in a week.
      </p>
      <SearchYourSchoolLink college={college} label="Check the school's page yourself" />
    </EmptyPanel>
  );
}

/**
 * The calendar is full and none of it is for this student.
 *
 * ## Why this is a state and not a fallback list
 *
 * This is the common outcome, not the rare one. Most of a campus calendar is
 * general to any one student: staff trainings, alumni outings, Mass, a
 * children's storytime at the campus bookstore. The section used to say that
 * nothing lined up and then print those three anyway, under "these are
 * happening anyway", which put a bookstore storytime on the dashboard of a
 * student testing operations management. Drew read his own account and asked
 * why it was there, which is the correct reaction and the reason this exists.
 *
 * A recommendation surface that fills its slots when it has no recommendation
 * teaches a student that the slots are furniture. One honest sentence keeps
 * every future gold card worth reading.
 *
 * Nothing is hidden. The events are one link away on the full calendar, which
 * is the screen whose job is showing what exists.
 */
export function NothingRelevantState({ college, pathName, className }) {
  return (
    <EmptyPanel
      icon={CalendarSearch}
      title={pathName ? `Nothing here fits ${pathName}` : 'Nothing here matches your interests'}
      className={className}
    >
      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
        We read {college || 'your school'}&apos;s calendar for the next two months. Nothing on it
        is worth crossing campus for. When your school posts something that is, it turns up here.
      </p>
      <Link
        to="/campus"
        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold transition hover:underline"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        <CalendarSearch size={12} className="shrink-0" aria-hidden="true" />
        See what&apos;s on anyway
      </Link>
    </EmptyPanel>
  );
}

/** Their school's server didn't answer. Ours to retry, not theirs to solve. */
export function FeedErrorState({ college, disabled, onRetry, className }) {
  return (
    <EmptyPanel icon={RotateCw} title="Your campus calendar didn't answer" className={className}>
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
