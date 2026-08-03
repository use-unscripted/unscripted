import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import CampusMonthGrid from './CampusMonthGrid';
import useCampusEvents from './useCampusEvents';
import { NoFeedState, EmptyCalendarState } from './CampusEmptyStates';
import { RecommendedEvent, CompactEvent } from './CampusEventRow';
import useCampusPicks from './useCampusPicks';
import { groupEventsByDay, eventMonthRange, upcomingEvents } from '@/lib/calendar-grid';

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
 * ## Why a grid and not just a list
 *
 * The dashboard is otherwise undated. Progress bars, counts and statuses all
 * describe a state, and none of them says "Thursday." A month with squares
 * filled in is the only thing here that shows a student time passing and
 * something already scheduled inside it.
 *
 * ## Quiet when it has nothing
 *
 * Only two of the five empty states earn a slot on a dashboard: a school whose
 * calendar we cannot read (fixable by the student, and a quarter of them) and a
 * working calendar with nothing on it (worth saying, so an empty grid is not
 * mistaken for a broken feature). No college, or a feed that timed out, renders
 * nothing at all — the dashboard is not where that conversation belongs, and a
 * grey apology in a grid of live cards is worse than one less card.
 */
export default function CampusEventsPanel({ delay = 0 }) {
  const { loading, status, college, events, profile, adopt } = useCampusEvents({ days: 60, limit: 40 });
  const { picks, loading: ranking } = useCampusPicks(events, profile);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const range = useMemo(() => eventMonthRange(events), [events]);

  // Soonest first, then the one the model rated highest is lifted out of it.
  const next = useMemo(() => upcomingEvents(events, { limit: 4 }), [events]);
  const pickIds = useMemo(() => new Set(picks.map(p => p.id)), [picks]);

  // The ranked copy carries the reason; the plain feed copy does not.
  const lead = picks.find(p => next.some(e => e.id === p.id)) || null;
  const rest = next.filter(e => e.id !== lead?.id).slice(0, lead ? 2 : 3);

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
      <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        {/* The month, small */}
        <div className="sm:w-[236px]">
          <CampusMonthGrid
            month={month}
            eventsByDay={eventsByDay}
            selectedKey=""
            onSelectDay={() => {}}
            onChangeMonth={setMonth}
            range={range}
            pickIds={pickIds}
            compact
          />
        </div>

        {/*
          One recommendation with its reason, then what's simply next.

          The dashboard gets a single pick rather than three: it is a glance on
          the way to something else, and a student who reads one sentence and
          goes is the entire point of this section.
        */}
        <div className="min-w-0 space-y-2">
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
      </div>
    </Section>
  );
}

function Section({ delay, college, linkToAll, children }) {
  return (
    <ScrollReveal
      as="section"
      delay={delay}
      className="mb-6 rounded-[20px] bg-white p-5"
      style={{ border: '1px solid var(--border-light)' }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            On your campus
          </h2>
          {college && (
            <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
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
      {children}
    </ScrollReveal>
  );
}
