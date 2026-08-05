import { Calendar, MapPin, ExternalLink, CalendarPlus, Ticket, ShieldCheck, Search } from 'lucide-react';
import {
  formatEventWhen,
  formatEventPlace,
  daysUntil,
  eventSearchUrl,
  eventSourceHost,
} from '@/lib/campus-events';

/**
 * The authoritative record of a real campus event.
 *
 * Every field rendered here comes from the school's own calendar feed, never
 * from generated text. That is why the link out is always shown: the student
 * can check us against the source in one click, and should be able to.
 */
export default function CampusEventCard({ event, college = '', compact = false }) {
  if (!event) return null;

  const when = formatEventWhen(event);
  const place = formatEventPlace(event);
  const countdown = daysUntil(event);
  const sourceHost = eventSourceHost(event);
  const searchUrl = eventSearchUrl(event, college);

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: 'rgba(31,58,95,0.22)' }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-3 py-2"
        style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}
      >
        <span className="tp-eyebrow flex items-center gap-1.5 text-[color:var(--ink-500)]">
          <Calendar size={12} /> On your campus calendar
        </span>
        {countdown && (
          <span
            className="tp-meta rounded-full px-2 py-0.5 font-bold"
            style={{ background: 'rgba(214,182,106,0.22)', color: '#7A5B12' }}
          >
            {countdown}
          </span>
        )}
      </div>

      <div className={compact ? 'px-3 py-2.5' : 'px-3 py-3'}>
        <p className="tp-card text-[color:var(--surface-dark-900)]">{event.title}</p>

        <dl className="tp-meta mt-2 space-y-1 text-[color:var(--ink-500)]">
          {when && (
            <div className="flex items-start gap-1.5">
              <dt className="sr-only">When</dt>
              <Calendar size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <dd className="font-semibold text-[color:var(--ink-700)]">{when}</dd>
            </div>
          )}
          {place && (
            <div className="flex items-start gap-1.5">
              <dt className="sr-only">Where</dt>
              <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <dd>{place}</dd>
            </div>
          )}
        </dl>

        {/*
          Only on positive evidence. `is_free` is null whenever the school's
          calendar carried no price (which is most of them) and saying
          "Ticketed event" off the back of that tells a student a free ice
          cream social costs money.
        */}
        {(event.has_register || event.is_free === false) && (
          <p className="tp-meta mt-2 flex items-center gap-1.5 font-semibold" style={{ color: '#7A5B12' }}>
            <Ticket size={12} aria-hidden="true" />
            {event.has_register ? 'Registration required' : 'Ticketed event'}
          </p>
        )}

        {event.ics_url && (
          <div className="mt-2.5">
            <a
              href={event.ics_url}
              target="_blank"
              rel="noopener noreferrer"
              className="tp-meta inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 font-semibold text-[color:var(--ink-700)] transition hover:bg-[color:var(--ink-50)]"
              style={{ borderColor: 'var(--ink-200)' }}
            >
              <CalendarPlus size={12} aria-hidden="true" />
              Add to calendar
            </a>
          </div>
        )}
      </div>

      {/*
        Confirm-before-you-go.

        We read this event off the school's calendar at some point in the past.
        Times move, rooms change, things get cancelled, and we would not know.
        Sending a student across campus on our copy of the truth without telling
        them to check the school's is the one way this feature can waste their
        afternoon, so the check is a permanent part of the card, not an error
        state, and it always offers a route that survives a dead permalink.
      */}
      <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--ink-200)', background: '#FCFBF7' }}>
        <p className="tp-meta flex items-start gap-1.5 font-semibold text-[color:var(--ink-700)]">
          <ShieldCheck size={13} className="mt-px shrink-0" style={{ color: '#7A5B12' }} aria-hidden="true" />
          Confirm the date and place before you go
        </p>
        <p className="tp-meta mt-1 text-[color:var(--ink-500)]">
          {sourceHost
            ? <>We took this from {sourceHost}. Check the school&apos;s listing for the final time and room.</>
            : <>Check the school&apos;s own listing for the final time and room.</>}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tp-meta flex items-center gap-1.5 rounded-lg border px-2.5 py-2 font-semibold transition hover:bg-white"
              style={{ borderColor: 'rgba(31,58,95,0.3)', color: 'var(--brand-navy-700)' }}
            >
              <ExternalLink size={12} aria-hidden="true" />
              {event.has_register ? 'Register on the school site' : 'Open the school listing'}
            </a>
          )}
          {searchUrl && (
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tp-meta flex items-center gap-1.5 rounded-lg border px-2.5 py-2 font-semibold text-[color:var(--ink-700)] transition hover:bg-white"
              style={{ borderColor: 'var(--ink-200)' }}
            >
              <Search size={12} aria-hidden="true" />
              {event.url ? 'Search for it' : 'Search for this event'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
