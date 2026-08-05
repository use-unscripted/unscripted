import { useState } from 'react';
import { MapPin, ChevronDown, ExternalLink, Search, Star } from 'lucide-react';
import CampusEventCard from '@/components/experiments/CampusEventCard';
import {
  formatEventWhen,
  formatEventPlace,
  daysUntil,
  eventSearchUrl,
  eventSourceHost,
} from '@/lib/campus-events';
import { formatEventTime } from '@/lib/calendar-grid';

/**
 * Two ways to show an event in a list, and the difference is the point.
 *
 * `RecommendedEvent` is one the model picked out of the month and can say
 * something specific about. `CompactEvent` is everything else — real, dated,
 * worth being able to see, but not something we are steering anyone toward.
 *
 * Rendering both identically is what made the panel a directory: five events on
 * a Wednesday, weighted the same, and no answer to "so which one".
 *
 * ## The school's own listing is on the row, not behind a disclosure
 *
 * Every event here is our copy of a listing that can move or be cancelled, so
 * the route to the school's own page is the safety valve. It used to take
 * opening a dropdown first, which put a click between the student and the only
 * thing that can tell them the truth. Now it is a visible action and the
 * disclosure holds the extra detail instead.
 */

/** When a list already sits under a date heading, only the time distinguishes rows. */
function whenLabel(event, timeOnly) {
  return timeOnly ? formatEventTime(event) : formatEventWhen(event);
}

/**
 * The way out to the school's own page.
 *
 * ## Registering is not the same action as reading a listing
 *
 * Where a school requires registration, a student who does not register does
 * not get in — it is the difference between planning to go and going. Rendering
 * it as another quiet outlined link, identical to "school listing", made the
 * one irreversible step on the screen look optional. It is the filled button
 * now, and the only filled button on the card.
 */
function ListingLinks({ event, college, size = 'sm' }) {
  const searchUrl = eventSearchUrl(event, college);
  const registers = Boolean(event.has_register && event.url);

  const pad = size === 'sm' ? 'px-3.5 py-2 tp-meta' : 'px-4 py-2.5 tp-meta';
  const iconSize = size === 'sm' ? 13 : 14;

  const secondary = `inline-flex items-center gap-1.5 rounded-lg border font-bold transition hover:bg-white ${pad}`;
  const primary = `inline-flex items-center gap-1.5 rounded-lg font-bold text-white transition hover:-translate-y-px ${pad}`;

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2">
      {registers && (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={primary}
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 1px 2px rgba(5,8,22,0.18)' }}
        >
          Register <ExternalLink size={iconSize} aria-hidden="true" />
        </a>
      )}

      {event.url && !registers && (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={secondary}
          style={{ borderColor: 'rgba(31,58,95,0.3)', color: 'var(--brand-navy-700)' }}
        >
          <ExternalLink size={iconSize} aria-hidden="true" /> School listing
        </a>
      )}

      {!event.url && searchUrl && (
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={secondary}
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
        >
          <Search size={iconSize} aria-hidden="true" /> Find it
        </a>
      )}
    </div>
  );
}

/**
 * An event we are actively telling the student to go to.
 *
 * The reason line is the whole reason this component exists. It is written per
 * event against the student's own major and interests, and it is the one thing
 * on this screen a listings page cannot produce.
 */
export function RecommendedEvent({ event, college, timeOnly = false }) {
  const place = formatEventPlace(event);
  // Under a date heading the countdown is the third time the panel has said
  // when this is. Only useful when the card is floating on its own.
  const countdown = timeOnly ? null : daysUntil(event);
  const reason = event.guidance?.fit_reason;
  const host = eventSourceHost(event);

  return (
    <div
      className="overflow-hidden rounded-xl border-2"
      style={{ borderColor: 'rgba(214,182,106,0.55)', background: 'var(--background-primary)' }}
    >
      <div
        className="tp-eyebrow flex items-center gap-1.5 px-4 py-2"
        style={{ background: 'rgba(214,182,106,0.16)', color: 'var(--brand-gold-700)' }}
      >
        <Star size={11} aria-hidden="true" /> Worth your time
        {countdown && <span className="tp-meta ml-auto normal-case tracking-normal">{countdown}</span>}
      </div>

      <div className="px-4 py-3.5">
        <p className="tp-card" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </p>
        <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {whenLabel(event, timeOnly)}
          {place && (
            <>
              {' · '}
              <MapPin size={10} className="inline" aria-hidden="true" /> {place}
            </>
          )}
        </p>

        {reason && (
          <p className="tp-prose mt-3" style={{ color: 'var(--text-primary)' }}>
            {reason}
          </p>
        )}

        <ListingLinks event={event} college={college} size="md" />

        {host && (
          <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
            From {host}. Check the time and room before you go.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Everything else on the day.
 *
 * Still real and still dated, so it expands to the full record — including the
 * confirm-before-you-go block — for anyone who wants it.
 */
export function CompactEvent({ event, college, timeOnly = false, showCountdown = false }) {
  const [open, setOpen] = useState(false);

  const place = formatEventPlace(event);
  const countdown = showCountdown ? daysUntil(event) : null;

  return (
    <div>
      <div
        className="rounded-xl p-4"
        style={{
          background: open ? 'var(--background-tertiary)' : 'var(--background-secondary)',
          border: '1px solid var(--border-light)',
        }}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="min-w-0 flex-1 text-left"
          >
            <p className="tp-card" style={{ color: 'var(--text-primary)' }}>
              {event.title}
            </p>
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {whenLabel(event, timeOnly)}
              {place && (
                <>
                  {' · '}
                  <MapPin size={10} className="inline" aria-hidden="true" /> {place}
                </>
              )}
            </p>
          </button>

          <span className="flex shrink-0 items-center gap-1.5">
            {countdown && (
              <span
                className="tp-meta rounded-full px-2.5 py-1 font-semibold"
                style={{ background: 'var(--background-tertiary)', color: 'var(--text-muted)' }}
              >
                {countdown}
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-label={open ? 'Hide details' : 'Show details'}
            >
              <ChevronDown
                size={14}
                aria-hidden="true"
                style={{
                  color: 'var(--text-muted)',
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: 'transform 160ms ease',
                }}
              />
            </button>
          </span>
        </div>

        <ListingLinks event={event} college={college} />
      </div>

      {open && (
        <div className="mt-1.5">
          <CampusEventCard event={event} college={college} compact />
        </div>
      )}
    </div>
  );
}
