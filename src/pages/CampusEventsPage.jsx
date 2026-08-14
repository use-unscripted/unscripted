import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, List, LayoutGrid, ChevronDown, RefreshCw } from 'lucide-react';
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
import { describeAge } from '@/lib/campus-store';

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
 *
 * The default keeps tracking the width as it changes, right up until the
 * student presses the toggle. A window dragged narrower is the same situation
 * as a narrow window, and it used to be handled differently only because the
 * width was read once at mount and never again. Once they have chosen, the
 * choice stands at every size: it is theirs, not ours.
 *
 * ## The grid measures itself rather than trusting a breakpoint
 *
 * A media query cannot answer this. The same 1100px window gives the calendar
 * roughly 500px with the day panel beside it and roughly 1000px without, and
 * what decides whether a square can hold a title is the square. So the section
 * is measured and the density comes out of the arithmetic: seven columns, six
 * gaps, and 72px as the width below which a title clamps to nothing useful.
 *
 * Under it, squares fall back to a number and a dot per event. That is a real
 * month calendar at a size where the full one is unreadable, and it is why the
 * squeeze between 1024px and about 1180px, where the two-column layout starts
 * but the calendar is still narrow, stopped producing "Fall Wel…" in every box.
 *
 * ## The first visit is slow and says so. No visit after it is.
 *
 * Reading a school's calendar takes as long as it takes: the feed has to be
 * resolved, fetched whole, and expanded. On a first visit there is nothing to
 * put on screen while that runs, so the wait gets named instead of being left
 * as a spinner that reads as broken. Every visit after it opens on the calendar
 * we stored last time, dated to today, with the refresh running behind it.
 * Nothing is ever blanked out to make room for an update.
 */
export default function CampusEventsPage() {
  const {
    loading, refreshing, cachedAt, status, college, events, profile, pathName, rankingReady, retry, adopt,
  } = useCampusEvents({ days: 60, limit: 40 });
  const { picks, loading: ranking } = useCampusPicks(events, profile, { pathName, ready: rankingReady });

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState('');
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches ? 'grid' : 'list',
  );

  // Follow the width until the student says otherwise, then never again.
  const viewChosen = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const wide = window.matchMedia('(min-width: 640px)');
    const follow = e => { if (!viewChosen.current) setView(e.matches ? 'grid' : 'list'); };
    wide.addEventListener('change', follow);
    return () => wide.removeEventListener('change', follow);
  }, []);

  const chooseView = useCallback(next => { viewChosen.current = true; setView(next); }, []);

  // What one day square would actually get: the section's inner width, minus
  // the six 4px gaps between seven columns.
  const [cellWidth, setCellWidth] = useState(0);
  const gridBox = useRef(null);
  const measure = useCallback(node => {
    gridBox.current = node;
    if (node) setCellWidth((node.clientWidth - 24) / 7);
  }, []);

  useEffect(() => {
    const node = gridBox.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setCellWidth((entry.contentRect.width - 24) / 7);
    });
    observer.observe(node);
    return () => observer.disconnect();
    // The section only exists once there are events, so this has to re-run when
    // the calendar appears rather than only on the first render of the page.
  }, [loading, status, view]);

  /** Titles need room. Under this a square can only honestly show that a day is busy. */
  const compactGrid = cellWidth > 0 && cellWidth < 72;

  // Below `lg` the day panel sits under the calendar, off screen. On a compact
  // grid the square itself says nothing but "something is on", so a tap that
  // appears to do nothing is the whole interaction failing.
  const dayPanel = useRef(null);
  useEffect(() => {
    if (!selectedKey || !dayPanel.current) return;
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    dayPanel.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedKey]);

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
    <main className="app-page">
      <PageHeader
        title="On your campus"
        description={
          college
            ? `Real events at ${college}, matched to what you're testing.`
            : 'Real events at your school, matched to what you’re testing.'
        }
        action={
          status === 'ok' ? (
            <ViewToggle view={view} onChange={chooseView} />
          ) : null
        }
      />

      {/*
        The only slow state left, and it happens once.

        Your school's calendar has to be found and read end to end before there
        is anything to put in a square, which takes the better part of a minute
        on some schools. A bare spinner for that long reads as a page that broke,
        so it says what is happening and that it is a one-time cost. After this
        the calendar is stored and the wait never comes back.
      */}
      {loading && (
        <div
          className="rounded-[var(--r-surface)] bg-white px-5 py-6"
          style={{ border: '1px solid var(--border-light)' }}
        >
          <p className="tp-body flex items-center gap-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Reading {college || 'your school'}'s calendar
          </p>
          <p className="tp-prose mt-2.5" style={{ color: 'var(--text-muted)' }}>
            The first load takes a while. We read your school's whole calendar and match it to
            what you're testing. After this it opens straight away.
          </p>
        </div>
      )}

      {/*
        A refresh behind events that are already up.

        Quiet on purpose: the calendar underneath is real and still worth
        reading, and the only thing a student needs to know is that a newer one
        is on the way.
      */}
      {!loading && refreshing && events.length > 0 && (
        <p className="tp-meta mb-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
          <FreshnessNote at={cachedAt} />
        </p>
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
            className="rounded-[var(--r-surface)] bg-white p-5"
            style={{ border: '1px solid var(--border-light)' }}
          >
            {view === 'grid' ? (
              <div ref={measure}>
                <CampusMonthGrid
                  month={month}
                  eventsByDay={eventsByDay}
                  selectedKey={selectedKey}
                  onSelectDay={setSelectedKey}
                  onChangeMonth={next => { setMonth(next); setSelectedKey(''); }}
                  range={range}
                  pickIds={pickIds}
                  compact={compactGrid}
                />
                {/*
                  Only says something when the grid can't. A count and a "tap a
                  day" instruction under a grid full of visible, tappable days
                  is telling the student what they are already looking at.

                  A compact square is the exception: it shows that a day has
                  something on it and cannot show what, so the way through has
                  to be said out loud once.
                */}
                {monthEvents.length === 0 ? (
                  <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
                    Nothing on this month.
                  </p>
                ) : compactGrid ? (
                  <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
                    Tap a day to see what's on, or switch to List to read the whole month.
                  </p>
                ) : null}
              </div>
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
            <div ref={dayPanel} className="scroll-mt-4">
            <DayPanel
              selectedKey={selectedKey}
              selectedEvents={selectedEvents}
              upcoming={upcoming}
              picks={picks}
              ranking={ranking}
              college={college}
              pathName={pathName}
              onClear={() => setSelectedKey('')}
            />
            </div>
          </ScrollReveal>
        </div>
      )}
    </main>
  );
}

/**
 * How old the calendar on screen is, while a newer one is being fetched.
 *
 * Says nothing about age when there is nothing to say. A calendar read a minute
 * ago being called a minute old is noise, and the student is looking at the same
 * events either way.
 */
function FreshnessNote({ at }) {
  const age = describeAge(at);
  if (!age || age === 'just now') return <>Checking for new events.</>;
  return <>Checking for new events. This is what your school had {age}.</>;
}

function ViewToggle({ view, onChange }) {
  const options = [
    ['grid', 'Month', LayoutGrid],
    ['list', 'List', List],
  ];

  return (
    <div
      className="inline-flex shrink-0 rounded-[var(--r-control)] p-0.5"
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
          className="tp-meta touch-target inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-bold transition"
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
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>
          {monthLabel(month)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            disabled={range && month.getTime() <= range.first.getTime()}
            className="tp-meta touch-target rounded-lg border px-3 py-1.5 font-bold transition disabled:opacity-30"
            style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)' }}
          >
            Earlier
          </button>
          <button
            type="button"
            onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            disabled={range && month.getTime() >= range.last.getTime()}
            className="tp-meta touch-target rounded-lg border px-3 py-1.5 font-bold transition disabled:opacity-30"
            style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)' }}
          >
            Later
          </button>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="tp-body tp-empty-note rounded-[var(--r-control)] border border-dashed text-center"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
          Nothing on this month.
        </p>
      ) : (
        <div className="space-y-6">
          {days.map(key => (
            <div key={key}>
              <p className="tp-eyebrow mb-2.5" style={{ color: 'var(--text-muted)' }}>
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
 * The wait while the ranking is worked out, named.
 *
 * This used to be two shimmering blocks and nothing else. The fill was
 * `--background-secondary`, which is #F7F9FB on a white card, so the panel read
 * as an empty box for as long as the model took. A student watching that has no
 * way to tell the difference between "something is being worked out for you"
 * and "this part of the page is broken", and the ranking is the one thing on
 * the page worth waiting for.
 *
 * So it says what is happening and roughly how long, over placeholders in the
 * shape of what is coming, so the panel does not resize around the student when
 * the answer lands.
 */
function PanelSkeleton({ college }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div>
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Picking the ones worth going to
        </p>
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
          We're checking {college ? `${college}'s` : 'your campus'} calendar against what you're
          testing. It takes a few seconds.
        </p>
      </div>

      <div className="space-y-2" aria-hidden="true">
        <div
          className="animate-pulse rounded-[var(--r-control)] border-2"
          style={{ borderColor: 'rgba(214,182,106,0.35)', height: 176, background: 'var(--background-tertiary)' }}
        />
        <div
          className="animate-pulse rounded-[var(--r-control)]"
          style={{ border: '1px solid var(--border-light)', height: 40, background: 'var(--background-tertiary)' }}
        />
      </div>
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
 * about what is on. That is the difference between this panel and the dashboard
 * one, which drops the remainder entirely: this page's job is showing what
 * exists, and the dashboard's job is saying what to do next.
 */
function DayPanel({ selectedKey, selectedEvents, upcoming, picks, ranking, college, pathName, onClear }) {
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
    <div className="rounded-[var(--r-surface)] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
          {heading}
        </h2>
        {selectedKey && (
          <button
            type="button"
            onClick={onClear}
            className="tp-meta shrink-0 font-semibold transition hover:underline"
            style={{ color: 'var(--brand-navy-700)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/*
        Held until the first ranking lands, and only the first.

        The feed answers in a few hundred milliseconds and the ranking is a
        model call behind it, so rendering as soon as the events arrive meant
        the panel drew a flat list and then rearranged itself into
        recommendations a second later. Waiting costs a moment on one column;
        the calendar beside it is already up and usable. Showing the wrong
        answer first and correcting it is the worse trade.

        Once there is a ranking, a later one never takes it off the screen.
        The background refresh changes the event list, which asks for a fresh
        ranking, and going back to a skeleton for that would mean the student
        loses the one piece of advice on the page every time we check the
        calendar. Yesterday's recommendation describes an event that is still
        on the calendar, so it stands until it is replaced.
      */}
      {/*
        Coming up waits on the recommendation, not on the ranking having any
        answer at all.

        A re-rank keeps yesterday's picks on screen while the new one is worked
        out, so `picks` is non-empty during it. When yesterday's event has
        already happened there is nothing recommended in it, and keying the wait
        on `picks` would let the panel announce that nothing lines up while it
        was still deciding. A selected day is left on the original rule: the
        student asked about that day, and covering its real events with a
        skeleton during a background refresh answers nothing.
      */}
      {ranking && pool.length > 0 && (selectedKey ? picks.length === 0 : recommended.length === 0) ? (
        <PanelSkeleton college={college} />
      ) : pool.length === 0 ? (
        <p className="tp-body" style={{ color: 'var(--text-muted)' }}>Nothing on this day.</p>
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
            Nothing cleared the relevance floor, and the student is owed the
            reason before a list of things that are not for them.

            This page is a calendar, so the events stay reachable: the month
            grid beside it shows every one, and the fold below opens them. What
            changed is that they are no longer the panel's answer. A student
            testing operations management was being shown a staff vendor
            training and a children's storytime as though we meant it.
          */}
          {recommended.length === 0 && !selectedKey && restShown.length > 0 && (
            <p className="pb-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {pathName
                ? `Nothing coming up lines up with ${pathName}.`
                : 'Nothing coming up matches your interests.'}
            </p>
          )}

          {/*
            The fold needs something above it to be "more" than. On a selected
            day with nothing recommended that is still the bare list, because
            the student asked about that day and hiding its events behind a
            click answers a different question. In Coming up it is the sentence
            above, which is why that view now folds either way.
          */}
          {restShown.length > 0 && (recommended.length > 0 || !selectedKey) && !showRest ? (
            <button
              type="button"
              onClick={() => setShowRest(true)}
              className="tp-meta flex w-full items-center justify-center gap-1.5 rounded-[var(--r-control)] border border-dashed py-2.5 font-semibold transition hover:bg-[var(--background-secondary)]"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
            >
              <ChevronDown size={13} aria-hidden="true" />
              {recommended.length > 0
                ? `${restShown.length} more ${selectedKey ? 'on this day' : 'coming up'}`
                : 'See what’s on anyway'}
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
