import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import useCampusEvents from './useCampusEvents';
import { NoFeedState, EmptyCalendarState } from './CampusEmptyStates';
import { RecommendedEvent, CompactEvent } from './CampusEventRow';
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
 * Only two of the five empty states earn a slot on a dashboard: a school whose
 * calendar we cannot read (fixable by the student, and a quarter of them) and a
 * working calendar with nothing on it (worth saying, so an empty section is not
 * mistaken for a broken feature). No college, or a feed that timed out, renders
 * nothing at all — the dashboard is not where that conversation belongs, and a
 * grey apology among live content is worse than one less section.
 */
export default function CampusEventsPanel({ delay = 0 }) {
  const { loading, status, college, events, profile, adopt } = useCampusEvents({ days: 60, limit: 40 });
  const { picks, loading: ranking } = useCampusPicks(events, profile);

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
  const rest = upcoming.filter(e => e.id !== lead?.id).slice(0, lead ? 2 : 3);

  // Ranking is part of loading here, not a second phase after it. Rendering a
  // flat list and then rearranging it into a recommendation a second later is
  // the flicker this section exists to avoid.
  if (loading || ranking) {
    return (
      <Section delay={delay}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          Checking your campus calendar…
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

  return (
    <Section delay={delay} college={college} linkToAll>
      {/*
        One recommendation with its reason, then what's simply next.

        The dashboard gets a single pick rather than three: it is a glance on
        the way to something else, and a student who reads one sentence and
        goes is the entire point of this section.
      */}
      <div className="space-y-2">
        {lead && <RecommendedEvent event={lead} college={college} />}

        {rest.length > 0 && (
          <>
            <p className="pt-1 text-xs font-bold uppercase tracking-[.12em]" style={{ color: 'var(--text-muted)' }}>
              {lead ? 'Also on' : 'Next up'}
            </p>
            {rest.map(event => (
              <CompactEvent key={event.id} event={event} college={college} showCountdown />
            ))}
          </>
        )}
      </div>
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
          <Link to="/campus" className="shrink-0 text-xs font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
            Full calendar →
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </ScrollReveal>
  );
}
