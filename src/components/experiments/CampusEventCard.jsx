import { Calendar, MapPin, ExternalLink, CalendarPlus, Ticket } from 'lucide-react';
import { formatEventWhen, formatEventPlace, daysUntil } from '@/lib/campus-events';

/**
 * The authoritative record of a real campus event.
 *
 * Every field rendered here comes from the school's own calendar feed — never
 * from generated text. That is why the link out is always shown: the student
 * can check us against the source in one click, and should be able to.
 */
export default function CampusEventCard({ event, compact = false }) {
  if (!event) return null;

  const when = formatEventWhen(event);
  const place = formatEventPlace(event);
  const countdown = daysUntil(event);

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white"
      style={{ borderColor: 'rgba(31,58,95,0.22)' }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-3 py-2"
        style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
          <Calendar size={12} /> On your campus calendar
        </span>
        {countdown && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: 'rgba(214,182,106,0.22)', color: '#7A5B12' }}
          >
            {countdown}
          </span>
        )}
      </div>

      <div className={compact ? 'px-3 py-2.5' : 'px-3 py-3'}>
        <p className="text-sm font-semibold leading-snug text-[#050816]">{event.title}</p>

        <dl className="mt-2 space-y-1 text-xs text-[#64748B]">
          {when && (
            <div className="flex items-start gap-1.5">
              <dt className="sr-only">When</dt>
              <Calendar size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <dd className="font-semibold text-[#334155]">{when}</dd>
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

        {(event.has_register || !event.is_free) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#7A5B12' }}>
            <Ticket size={12} aria-hidden="true" />
            {event.has_register ? 'Registration required' : 'Ticketed event'}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap gap-2">
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-[#F8FAFC]"
              style={{ borderColor: '#E2E8F0', color: 'var(--brand-navy-700)' }}
            >
              <ExternalLink size={12} aria-hidden="true" />
              {event.has_register ? 'Register' : 'View listing'}
            </a>
          )}
          {event.ics_url && (
            <a
              href={event.ics_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
              style={{ borderColor: '#E2E8F0' }}
            >
              <CalendarPlus size={12} aria-hidden="true" />
              Add to calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
