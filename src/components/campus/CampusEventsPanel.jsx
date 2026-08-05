import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import useCampusEvents from './useCampusEvents';
import { NoFeedState, EmptyCalendarState, NothingRelevantState } from './CampusEmptyStates';
import { RecommendedEvent } from './CampusEventRow';
import useCampusPicks from './useCampusPicks';
import { upcomingEvents, eventDayKey, dayKey } from '@/lib/calendar-grid';

/**
 * Real dated events on the dashboard.
 *
 * ## Why this is on the dashboard at all
 *
 * Campus events used to exist only inside Mission Guide generation, which has
 * run eleven times in the product's life. The feature with the best claim on
 * the number that actually matters — no student has ever come back on a later
 * day — was sitting behind the narrowest gate in the funnel. This is the same
 * data on the screen every student lands on.
 *
 * ## Why no month grid here
 *
 * There was one, at 236px, beside the event rows. It was a miniature of the
 * grid on the full campus page, which has the width to render a month properly
 * and is one link away. My Journey answers "what do I do next", and the answer
 * to that is a dated thing with a reason attached, not a month to read. A
 * smaller, worse copy of a screen that already exists is the same redundancy
 * the rest of this page had removed from it.
 *
 * What stays is the part the dashboard is uniquely good for: the dashboard is
 * otherwise undated — progress, counts and statuses all describe a state, and
 * none of them says "Thursday" — so one real dated line is the only thing here
 * that gives a student a reason to come back on a particular day.
 *
 * ## Quiet when it has nothing
 *
 * Only three of the empty states earn a slot on a dashboard: a school whose
 * calendar we cannot read (fixable by the student, and a quarter of them), a
 * working calendar with nothing on it, and a full calendar with nothing on it
 * for this student. That last one is the common case, and it is worth saying
 * out loud so an empty section is not mistaken for a broken feature. No
 * college, or a feed that timed out, renders nothing at all — the dashboard is
 * not where that conversation belongs, and a grey apology among live content is
 * worse than one less section.
 *
 * ## Only ranked events reach this page
 *
 * Every row here is one the model picked out and can say something specific
 * about. The section used to top up its slots from the front of the feed, which
 * is how a student testing operations management ended up looking at a staff
 * vendor training and a children's storytime. A recommendation surface that
 * fills its slots when it has no recommendation teaches a student that the
 * slots are furniture.
 */
export default function CampusEventsPanel({ delay = 0 }) {
  const { loading, status, college, events, profile, pathName, rankingReady, adopt } = useCampusEvents({ days: 60, limit: 40 });
  const { picks, loading: ranking } = useCampusPicks(events, profile, { pathName, ready: rankingReady });

  // Everything still to come, soonest first.
  const upcoming = useMemo(() => upcomingEvents(events, { limit: 40 }), [events]);
  const upcomingIds = useMemo(() => new Set(upcoming.map(e => e.id)), [upcoming]);

  /*
    An experiment is a 30-day test, so that is the window a recommendation can
    still be acted on inside. Day keys are `YYYY-MM-DD`, which compare correctly
    as strings.
  */
  const withinCycle = useMemo(() => {
    const edge = new Date();
    edge.setDate(edge.getDate() + 30);
    const cutoff = dayKey(edge);
    return new Set(
      upcoming.filter(e => { const k = eventDayKey(e); return k && k <= cutoff; }).map(e => e.id)
    );
  }, [upcoming]);

  /*
    The lead is the best-ranked event a student could actually still go to
    during this experiment, and only failing that the best-ranked one at all.

    It used to be the best pick among the soonest four events, which meant that
    whenever the model's recommendations sat further out than a few days, the
    section fell back to a bare list of whatever the feed had next. The reason
    sentence is the only thing here a student cannot get from their school's own
    calendar, so dropping it drops the section's whole argument. Ranking with no
    horizon at all has the opposite failure — it leads with something five weeks
    out, which is a save-the-date, not a thing to do this week.
  */
  const lead = picks.find(p => withinCycle.has(p.id))
    || picks.find(p => upcomingIds.has(p.id))
    || null;

  // Ranking is part of loading here, not a second phase after it. Rendering a
  // flat list and then rearranging it into a recommendation a second later is
  // the flicker this section exists to avoid.
  //
  // Both only count on a cold start. A student who has opened the calendar
  // before has their events already, and a background refresh must never pull
  // them back off the dashboard to show a spinner where a real dated event was.
  // With events in hand, the only thing still worth waiting for is a first
  // ranking, because that is the sentence this section exists to carry.
  //
  // The wait is measured on the lead rather than on `picks`, and the difference
  // is a returning student. A re-rank keeps yesterday's picks on screen while
  // the new answer is worked out, so `picks` is non-empty during it. If
  // yesterday's event has since happened there is no lead in it, and keying on
  // `picks` would let the section announce that nothing fits while it was still
  // deciding. Saying that wrongly is worse than the old bare list, because a
  // list was never a claim.
  const cold = upcoming.length === 0 ? (loading || ranking) : (ranking && !lead);
  if (cold) {
    return (
      <Section delay={delay}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          {loading ? 'Reading your school’s calendar. The first load takes a while.' : 'Checking your campus calendar…'}
        </div>
      </Section>
    );
  }

  if (status === 'no_feed') {
    return (
      <Section delay={delay} college={college}>
        <NoFeedState college={college} onResolved={adopt} className="" />
      </Section>
    );
  }

  if (status === 'no_matches') {
    return (
      <Section delay={delay} college={college}>
        <EmptyCalendarState college={college} className="" />
      </Section>
    );
  }

  // no_college and feed_error: say nothing, take no space.
  if (status !== 'ok') return null;

  /*
    Nothing cleared the relevance floor, so the section says that and stops.

    This is the common outcome rather than the rare one, and it is the whole
    point of the change: the calendar is full, and almost none of a campus
    calendar is for any one student. Printing the next three events under an
    apology was the old answer, and it put a bookstore storytime in front of a
    student testing operations management. The events are still one link away
    on the full calendar, which is the screen whose job is showing what exists.
  */
  // The section header's own "Full calendar" link is dropped here, because the
  // panel below carries one to the same place a few pixels lower.
  if (!lead) {
    return (
      <Section delay={delay} college={college}>
        <NothingRelevantState college={college} pathName={pathName} className="" />
      </Section>
    );
  }

  /*
    One recommendation, with its reason, and nothing under it.

    The dashboard gets a single pick rather than three: it is a glance on the
    way to something else, and a student who reads one sentence and goes is the
    entire point of this section. The model's other picks are on the full
    calendar, which the header links to.

    A tail was tried and taken out again. The reason sentence is rendered in
    one place in this app, on the recommendation card, so a second and third
    pick underneath arrive as bare titles: rows that say "worth your time" over
    nothing that says why. That is the same undifferentiated list this change
    removed, with a better filter on it.
  */
  return (
    <Section delay={delay} college={college} linkToAll>
      <RecommendedEvent event={lead} college={college} />
    </Section>
  );
}

/**
 * Same section language as the rest of My Journey: a quiet label, content on
 * the page surface. The page has exactly one filled panel — the instruction at
 * the top — and boxing this in a white card would have made it compete.
 */
function Section({ delay, college, linkToAll, children }) {
  return (
    <ScrollReveal as="section" delay={delay} aria-label="Events on your campus" className="max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-xs font-bold uppercase tracking-[.16em]" style={{ color: 'var(--text-muted)' }}>
            On your campus
          </h2>
          {college && (
            <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
              {college}
            </p>
          )}
        </div>
        {linkToAll && (
          <Link to="/campus" className="touch-target inline-flex shrink-0 items-center text-xs font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
            Full calendar →
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </ScrollReveal>
  );
}
