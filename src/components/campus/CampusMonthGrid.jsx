import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  monthMatrix,
  monthLabel,
  addMonths,
  isSameMonth,
  WEEKDAY_LABELS,
} from '@/lib/calendar-grid';

/**
 * A month of real campus events.
 *
 * Presentational only — it is handed the month to draw and the events already
 * bucketed by day, so every width gets the same grid at one of two densities
 * rather than two grids that drift apart.
 *
 * ## The two densities
 *
 * Full squares carry event titles, which is what makes a day worth tapping.
 * They need about 72px of width to say anything useful; below that a title
 * clamps to "Fall Wel…" and the square is telling the student nothing they
 * could act on while taking up the room of something that could.
 *
 * So under that width the square drops the titles and keeps the one thing a
 * month grid is uniquely good at: which days have something on them. A number,
 * a dot per event, gold if one of them is recommended. The titles are still one
 * tap away in the panel, and the list view is still one press away for a
 * student who wants to read rather than scan.
 *
 * The caller decides which, by measuring the space it actually has. A media
 * query would be guessing: the same 900px browser window gives this grid a
 * different width depending on whether the day panel is beside it.
 *
 * ## Why the arrows get disabled
 *
 * We hold a fixed window of events, not a live calendar. Letting a student page
 * into March when the feed ends in November would show five identical empty
 * grids, and nothing on screen would distinguish "your campus has nothing on"
 * from "we haven't looked that far ahead." Bounding the arrows to the months we
 * actually have data for makes an empty square mean one thing.
 */
export default function CampusMonthGrid({
  month,
  eventsByDay,
  selectedKey,
  onSelectDay,
  onChangeMonth,
  range,
  /** Ids the model picked out, so a day holding one reads differently at a glance. */
  pickIds,
  compact = false,
  today = new Date(),
}) {
  const weeks = monthMatrix(month, { today });

  const canGoBack = !range || !isSameMonth(month, range.first);
  const canGoForward = !range || !isSameMonth(month, range.last);

  return (
    <div>
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3
          className={`font-heading font-bold ${compact ? 'text-sm' : 'text-base'}`}
          style={{ color: 'var(--text-primary)' }}
          aria-live="polite"
        >
          {monthLabel(month)}
        </h3>

        <div className="flex items-center gap-1">
          <MonthArrow
            direction="back"
            disabled={!canGoBack}
            label={`Previous month, ${monthLabel(addMonths(month, -1))}`}
            onClick={() => onChangeMonth(addMonths(month, -1))}
          />
          <MonthArrow
            direction="forward"
            disabled={!canGoForward}
            label={`Next month, ${monthLabel(addMonths(month, 1))}`}
            onClick={() => onChangeMonth(addMonths(month, 1))}
          />
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map(label => (
          <div
            key={label}
            aria-hidden="true"
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            {/*
              The full short name at both densities.

              This used to drop to one letter whenever the grid was compact,
              which was right for the 36px cell on the dashboard it was built
              for and is wrong now: the narrowest compact square is 44px, and
              "SUN" fits in that with room to spare. "S T T S" down the top of a
              calendar is a puzzle nobody should have to solve.
            */}
            {label}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map(day => (
          <DayCell
            key={day.key}
            day={day}
            events={eventsByDay.get(day.key) || []}
            pickIds={pickIds}
            selected={day.key === selectedKey}
            onSelect={onSelectDay}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

function MonthArrow({ direction, disabled, label, onClick }) {
  const Icon = direction === 'back' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:bg-[var(--background-tertiary)]"
      style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)' }}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  );
}

/**
 * One square.
 *
 * A day with nothing on it is not a button. Roughly nine squares in ten are
 * empty on a real campus feed, and making every one of them focusable turns
 * keyboard navigation of this grid into thirty-five tab stops to reach the four
 * days that matter.
 */
function DayCell({ day, events, pickIds, selected, onSelect, compact }) {
  const { key, dayOfMonth, inMonth, isToday } = day;
  const count = events.length;
  const hasPick = Boolean(pickIds) && events.some(e => pickIds.has(e.id));

  /*
    Chronological, always — the ranking must never reorder a square.

    Recommendations arrive a beat after the events do, because ranking them is a
    model call. Sorting picks to the front meant the two visible titles in a
    cell swapped out from under the student a second after the page settled.
    A calendar square that rewrites itself is worse than one that buries a good
    event two lines down, so the ranking only ever changes emphasis here, never
    order. If a pick is out of sight, the "+N more" below goes gold to say so.
  */
  const shown = events.slice(0, 2);
  // Any pick past the cut, not just a day where none is visible — Aug 12 shows
  // the 9am pick and hides the 4pm one, and the count is the only place left
  // to say that something worth going to is down there.
  const hiddenPick = Boolean(pickIds) && events.slice(2).some(e => pickIds.has(e.id));

  // 44px, not the 36 this started at. A compact square is a touch target on a
  // phone, and it is the only way into a day when the titles are not on it.
  const base = compact ? 'h-11 text-xs' : 'min-h-[86px] text-sm';
  const numberTone = !inMonth
    ? 'var(--text-muted)'
    : isToday
      ? 'var(--brand-navy-900)'
      : 'var(--text-primary)';

  if (!count) {
    return (
      <div
        className={`${base} rounded-lg ${compact ? 'grid place-items-center' : 'px-1 py-1'}`}
        style={{
          opacity: inMonth ? 1 : 0.35,
          background: isToday ? 'rgba(214,182,106,0.14)' : 'transparent',
        }}
      >
        <DayNumber value={dayOfMonth} tone={numberTone} isToday={isToday} compact={compact} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? '' : key)}
      aria-pressed={selected}
      aria-label={`${new Date(day.date).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      })}, ${count} event${count === 1 ? '' : 's'}`}
      className={`${base} overflow-hidden rounded-lg border text-left transition hover:border-[var(--brand-navy-700)] ${
        compact ? 'grid place-items-center' : 'px-1 py-1'
      }`}
      style={{
        opacity: inMonth ? 1 : 0.45,
        borderColor: selected ? 'var(--brand-navy-700)' : 'var(--border-light)',
        borderWidth: selected ? 2 : 1,
        background: selected
          ? 'var(--background-tertiary)'
          : isToday
            ? 'rgba(214,182,106,0.14)'
            : 'var(--background-primary)',
      }}
    >
      {compact ? (
        <span className="grid place-items-center gap-0.5">
          <DayNumber value={dayOfMonth} tone={numberTone} isToday={isToday} compact />
          {/*
            A dot per event, capped at three.

            One dot for every day with anything on it made a Tuesday with one
            club meeting look identical to a Thursday with a career fair, three
            info sessions and a game — and "which days are busy" is most of what
            a month grid is for once the titles are gone. Three is where they
            stop fitting; the count in the panel is exact anyway.
          */}
          <span className="flex items-center gap-[2px]" aria-hidden="true">
            {Array.from({ length: Math.min(count, 3) }, (_, i) => (
              <span
                key={i}
                className="block rounded-full"
                style={{
                  height: hasPick ? 4 : 3,
                  width: hasPick ? 4 : 3,
                  background: hasPick ? 'var(--brand-gold-600)' : 'var(--border-light)',
                }}
              />
            ))}
          </span>
        </span>
      ) : (
        <>
          <DayNumber value={dayOfMonth} tone={numberTone} isToday={isToday} />
          {/*
            Two lines each, and no pill.

            A square is about 86px wide. Inside a padded pill that is roughly
            nine characters, which turned every title into "Resume L…" — enough
            to know something is on, not enough to know whether it is worth
            crossing campus for. Dropping the pill and letting the title wrap
            twice roughly triples that, and the leading rule below still reads
            as a list of separate events.
          */}
          <span className="mt-1 block space-y-1">
            {shown.map(event => {
              const picked = Boolean(pickIds) && pickIds.has(event.id);
              return (
                <span
                  key={event.id}
                  // No `block` here: line-clamp needs display:-webkit-box, and a
                  // display utility alongside it silently wins, which un-clamps
                  // the title and lets a long one grow the row to six lines.
                  className="border-l-2 pl-1 text-[10px] leading-[1.25] line-clamp-2"
                  style={{
                    borderColor: picked ? 'var(--brand-gold-500)' : 'var(--border-light)',
                    color: picked ? 'var(--brand-navy-900)' : 'var(--text-secondary)',
                    fontWeight: picked ? 700 : 500,
                  }}
                  title={event.title}
                >
                  {event.title}
                </span>
              );
            })}
            {count > 2 && (
              <span
                className="block text-[10px] font-bold"
                style={{ color: hiddenPick ? 'var(--brand-gold-700)' : 'var(--text-muted)' }}
              >
                +{count - 2} more
              </span>
            )}
          </span>
        </>
      )}
    </button>
  );
}

/** Today's number gets the gold disc — the one square a student looks for first. */
function DayNumber({ value, tone, isToday, compact }) {
  if (isToday) {
    return (
      <span
        className={`grid place-items-center rounded-full font-bold tabular-nums ${
          compact ? 'h-4 w-4 text-[10px]' : 'h-5 w-5 text-xs'
        }`}
        style={{ background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }}
      >
        {value}
      </span>
    );
  }

  return (
    <span
      className={`block font-semibold tabular-nums ${compact ? 'text-[11px]' : 'text-xs'}`}
      style={{ color: tone }}
    >
      {value}
    </span>
  );
}
