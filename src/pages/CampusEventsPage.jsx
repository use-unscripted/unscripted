import { useEffect, useMemo, useState } from 'react';
import { Loader2, List, LayoutGrid, ChevronDown } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ScrollReveal from '@/components/ScrollReveal';
import CampusMonthGrid from '@/components/campus/CampusMonthGrid';
import useCampusEvents from '@/components/campus/useCampusEvents';
import useCampusPicks from '@/components/campus/useCampusPicks';
import { RecommendedEvent, CompactEvent } from '@/components/campus/CampusEventRow';
import {
  NoCollegeState,
  NoFeedState,
  EmptyCalendarState,
  FeedErrorState,
} from '@/components/campus/CampusEmptyStates';
import {
  groupEventsByDay,
  eventMonthRange,
  upcomingEvents,
  monthLabel,
  dayKey,
  eventDayKey,
} from '@/lib/calendar-grid';
import { parseEventStart } from '@/lib/campus-events';

/**
 * Everything real happening on the student's campus, on a calendar.
 *
 * The point is the deadline. Every experiment in this product asks a student to
 * pick their own start date and none of them ever have — 72 profiles, not one
 * updated on a later day than it was created. An event happens at a time
 * somebody else chose, which is the one thing a self-set goal cannot do, and a
 * month grid is what makes that legible: the student sees dates they did not
 * pick, already filled in.
 *
 * ## Two views, and the small screen decides the default
 *
 * A seven-column grid on a 375px phone gives each day about 45px, which fits a
 * number and nothing else — the titles are what make a square worth tapping. So
 * the list is the default below `sm` and the grid above it, and the toggle is
 * always there because the choice is a preference, not a capability.
 */
export default function CampusEventsPage() {
  const { loading, status, college, events, profile, retry, adopt } = useCampusEvents({ days: 60, limit: 40 });
  const { picks, loading: ranking } = useCampusPicks(events, profile);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState('');
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches ? 'grid' : 'list',
  );

  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const pickIds = useMemo(() => new Set(picks.map(p => p.id)), [picks]);
  const range = useMemo(() => eventMonthRange(events), [events]);
  const upcoming = useMemo(() => upcomingEvents(events, { limit: 50 }), [events]);

  /**
   * Open on the month the events are actually in.
   *
   * Landing on "today" is wrong at the end of a semester: a student opening
   * this in late December, when the feed starts again in January, would be
   * shown an empty grid and no reason to press the arrow. Runs only when the
   * feed arrives, so it never fights the student's own navigation afterwards.
   */
  useEffect(() => {
    if (!events.length) return;
    const first = upcomingEvents(events, { limit: 1 })[0];
    if (!first) return;
    const soonest = parseEventStart(first.start);
    if (!soonest) return;
    const today = new Date();
    if (soonest.getFullYear() === today.getFullYear() && soonest.getMonth() === today.getMonth()) return;
    setMonth(new Date(soonest.getFullYear(), soonest.getMonth(), 1));
  }, [events]);

  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) || [] : [];

  /** The list view shows the month you are looking at, not the whole window. */
  const monthEvents = useMemo(
    // Compared as "YYYY-MM" through the shared parser, so an all-day event on
    // the 1st stays in its own month rather than slipping into the previous one.
    () => upcoming.filter(event => eventDayKey(event).slice(0, 7) === dayKey(month).slice(0, 7)),
    [upcoming, month],
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        title="On your campus"
        description={
          college
            ? `Real events at ${college}, matched to what you're testing.`
            : 'Real events at your school, matched to what you’re testing.'
        }
        action={
          status === 'ok' ? (
            <ViewToggle view={view} onChange={setView} />
          ) : null
        }
      />

      {loading && (
        <div
          className="flex items-center gap-2 rounded-[20px] bg-white px-5 py-6 text-sm"
          style={{ border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
        >
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Checking your campus calendar…
        </div>
      )}

      {!loading && status !== 'ok' && (
        <ScrollReveal as="div" className="max-w-2xl">
          {status === 'no_college' && <NoCollegeState onSaved={retry} className="" />}
          {status === 'no_feed' && <NoFeedState college={college} onResolved={adopt} className="" />}
          {status === 'feed_error' && <FeedErrorState college={college} onRetry={retry} className="" />}
          {status === 'no_matches' && <EmptyCalendarState college={college} className="" />}
        </ScrollReveal>
      )}

      {/*
        The calendar gets two thirds. Its squares carry event titles, and at an
        even split those truncated to "Resume…" / "Finance …", which is not
        enough to decide whether a day is worth opening. The side column is
        compact rows now, so it can afford the space.
      */}
      {!loading && status === 'ok' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Calendar / list */}
          <ScrollReveal
            as="section"
            className="rounded-[20px] bg-white p-5"
            style={{ border: '1px solid var(--border-light)' }}
          >
            {view === 'grid' ? (
              <>
                <CampusMonthGrid
                  month={month}
                  eventsByDay={eventsByDay}
                  selectedKey={selectedKey}
                  onSelectDay={setSelectedKey}
                  onChangeMonth={next => { setMonth(next); setSelectedKey(''); }}
                  range={range}
                  pickIds={pickIds}
                />
                {/*
                  Only says something when the grid can't. A count and a "tap a
                  day" instruction under a grid full of visible, tappable days
                  is telling the student what they are already looking at.
                */}
                {monthEvents.length === 0 && (
                  <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Nothing on this month.
                  </p>
                )}
              </>
            ) : (
              <MonthList
                month={month}
                events={monthEvents}
                college={college}
                picks={picks}
                range={range}
                onChangeMonth={next => { setMonth(next); setSelectedKey(''); }}
              />
            )}
          </ScrollReveal>

          {/* The selected day, or what's next */}
          <ScrollReveal as="aside" delay={80} className="min-w-0">
            <DayPanel
              selectedKey={selectedKey}
              selectedEvents={selectedEvents}
              upcoming={upcoming}
              picks={picks}
              ranking={ranking}
              college={college}
              onClear={() => setSelectedKey('')}
            />
          </ScrollReveal>
        </div>
      )}
    </main>
  );
}

function ViewToggle({ view, onChange }) {
  const options = [
    ['grid', 'Month', LayoutGrid],
    ['list', 'List', List],
  ];

  return (
    <div
      className="inline-flex shrink-0 rounded-[10px] p-0.5"
      style={{ background: 'var(--background-tertiary)' }}
      role="group"
      aria-label="Calendar view"
    >
      {options.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={view === value}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
          style={
            view === value
              ? { background: 'var(--background-primary)', color: 'var(--brand-navy-900)', boxShadow: '0 1px 2px rgba(5,8,22,0.08)' }
              : { color: 'var(--text-muted)' }
          }
        >
          <Icon size={13} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** The whole month as a dated list — the phone default, and the grid's escape hatch. */
function MonthList({ month, events, college, picks, range, onChangeMonth }) {
  const byDay = groupEventsByDay(events);
  const pickById = new Map((picks || []).map(p => [p.id, p]));
  const days = [...byDay.keys()].sort();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {monthLabel(month)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            disabled={range && month.getTime() <= range.first.getTime()}
            className="rounded-lg border px-2.5 py-1 text-xs font-bold transition disabled:opacity-30"
            style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)' }}
          >
            Earlier
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            disabled={range && month.getTime() >= range.last.getTime()}
            className="rounded-lg border px-2.5 py-1 text-xs font-bold transition disabled:opacity-30"
            style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)' }}
          >
            Later
          </button>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
          Nothing on this month.
        </p>
      ) : (
        <div className="space-y-5">
          {days.map(key => (
            <div key={key}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long', month: 'long', day: 'numeric',
                })}
              </p>
              {/* Under a day heading, so times only — and picks keep their badge. */}
              <div className="space-y-2">
                {byDay.get(key).map(event => (
                  pickById.has(event.id)
                    ? <RecommendedEvent key={event.id} event={pickById.get(event.id)} college={college} timeOnly />
                    : <CompactEvent key={event.id} event={event} college={college} timeOnly />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Placeholder in the shape of what is coming, so the panel does not resize
 * around the student when the ranking lands.
 */
function PanelSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Working out which events are worth your time">
      <div
        className="animate-pulse rounded-xl border-2"
        style={{ borderColor: 'rgba(214,182,106,0.35)', height: 176, background: 'var(--background-secondary)' }}
      />
      <div
        className="animate-pulse rounded-xl"
        style={{ border: '1px solid var(--border-light)', height: 40, background: 'var(--background-secondary)' }}
      />
    </div>
  );
}

/**
 * The side panel: whichever day is selected, or what is coming up next.
 *
 * ## Recommendations first, the rest folded away
 *
 * A day with five events used to render as five identical rows, which is a
 * listings page with a date on it. Now anything the model picked out comes
 * first, carrying the one sentence that says why this student in particular
 * should go, and the remainder collapses behind a count.
 *
 * The remainder is folded, never dropped. These are real dated things happening
 * on their campus, and hiding them outright to look decisive would be lying
 * about what is on.
 */
function DayPanel({ selectedKey, selectedEvents, upcoming, picks, ranking, college, onClear }) {
  const [showRest, setShowRest] = useState(false);

  const pickIds = useMemo(() => new Set(picks.map(p => p.id)), [picks]);
  // The ranked copy carries the guidance; the plain feed copy does not.
  const pickById = useMemo(() => new Map(picks.map(p => [p.id, p])), [picks]);

  const pool = selectedKey ? selectedEvents : upcoming;
  const ranked = pool.filter(e => pickIds.has(e.id)).map(e => pickById.get(e.id) || e);

  /*
    A selected day shows every pick on it — usually one, occasionally two, and
    the student asked about that day specifically.

    With nothing selected the panel spans six weeks, and all three picks stacked
    put three gold "worth your time" banners down the side of the screen, which
    makes the badge mean nothing. One is the recommendation; the rest fall back
    into the list in date order and keep their place in time.
  */
  const featured = selectedKey ? ranked : ranked.slice(0, 1);
  const featuredIds = new Set(featured.map(e => e.id));

  const recommended = featured;
  const rest = pool.filter(e => !featuredIds.has(e.id));

  // Nothing selected is a glance, not an audit — cap the tail.
  const restShown = selectedKey ? rest : rest.slice(0, 3);

  const heading = selectedKey
    ? new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    })
    : 'Coming up';

  return (
    <div className="rounded-[20px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-heading text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {heading}
        </h2>
        {selectedKey && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs font-semibold transition hover:underline"
            style={{ color: 'var(--brand-navy-700)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/*
        Held until the ranking lands.

        The feed answers in a few hundred milliseconds and the ranking is a
        model call behind it, so rendering as soon as the events arrive meant
        the panel drew a flat list and then rearranged itself into
        recommendations a second later. Waiting costs a moment on one column;
        the calendar beside it is already up and usable. Showing the wrong
        answer first and correcting it is the worse trade.
      */}
      {ranking && pool.length > 0 ? (
        <PanelSkeleton />
      ) : pool.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing on this day.</p>
      ) : (
        <div className="space-y-2">
          {recommended.map(event => (
            <RecommendedEvent
              key={event.id}
              event={event}
              college={college}
              timeOnly={Boolean(selectedKey)}
            />
          ))}

          {/*
            The toggle only appears when there is something recommended above
            it. With nothing picked out, folding the only events we have behind
            a count would hide the entire panel behind a click.
          */}
          {restShown.length > 0 && recommended.length > 0 && !showRest ? (
            <button
              type="button"
              onClick={() => setShowRest(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-xs font-semibold transition hover:bg-[var(--background-secondary)]"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
            >
              <ChevronDown size={13} aria-hidden="true" />
              {restShown.length} more {selectedKey ? 'on this day' : 'coming up'}
            </button>
          ) : (
            restShown.map(event => (
              <CompactEvent
                key={event.id}
                event={event}
                college={college}
                timeOnly={Boolean(selectedKey)}
                showCountdown={!selectedKey}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
