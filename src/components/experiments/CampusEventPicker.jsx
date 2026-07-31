import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { fetchCampusEvents, recommendCampusEvents } from '@/lib/campus-events';
import CampusEventCard from './CampusEventCard';

/**
 * Offers real, dated events on the student's own campus to anchor a guide to.
 *
 * The point is the deadline. Every experiment in this product asks a student to
 * pick their own start date, and none of them ever have. An event happens at a
 * time somebody else chose, which is the one thing a self-set goal cannot do.
 *
 * Entirely optional and never blocking: no calendar, no matches, or a failed
 * lookup all fall through to a normal guide.
 */
export default function CampusEventPicker({ profile, pathName, selected, onSelect, disabled }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [college, setCollege] = useState('');
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const feed = await fetchCampusEvents({ days: 45, limit: 20 });
      if (cancelled) return;

      setCollege(feed.college || '');

      if (!feed.events.length) {
        setStatus(feed.status || 'no_matches');
        setLoading(false);
        return;
      }

      const recommended = await recommendCampusEvents(feed.events, profile, { pathName });
      if (cancelled) return;

      setPicks(recommended);
      setStatus(recommended.length ? 'ok' : 'no_matches');
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [profile, pathName]);

  if (loading) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        Checking your campus calendar...
      </div>
    );
  }

  // Nothing to offer. Say so in one quiet line and get out of the way — this is
  // an optional enhancement, not a failure the student has to resolve.
  if (status !== 'ok') {
    const message = {
      no_college: 'Add your college in Settings to get campus events in your guides.',
      no_feed: `We couldn't find a public events calendar for ${college || 'your school'}.`,
      no_matches: 'Nothing on your campus calendar matches this experiment in the next 6 weeks.',
      feed_error: "Your campus calendar didn't respond just now.",
    }[status] || '';

    if (!message) return null;
    return (
      <p className="mb-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#64748B]">
        {message}
      </p>
    );
  }

  return (
    <div className="mb-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[#334155]">
        <Sparkles size={14} style={{ color: 'var(--brand-gold-500, #D6B66A)' }} aria-hidden="true" />
        Anchor this to something real
      </p>
      <p className="mb-3 mt-0.5 text-xs text-[#64748B]">
        Happening at {college}. Pick one and it becomes your first step — with a date you
        didn&apos;t have to invent.
      </p>

      <div className="space-y-2" role="group" aria-label="Campus events">
        {picks.map(event => {
          const isSelected = selected?.id === event.id;
          return (
            <div key={event.id}>
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : event)}
                disabled={disabled}
                aria-pressed={isSelected}
                className="w-full rounded-xl border-2 p-2 text-left transition disabled:opacity-60"
                style={{
                  borderColor: isSelected ? 'var(--brand-navy-700)' : 'transparent',
                  background: isSelected ? 'var(--background-tertiary, #EEF2F6)' : 'transparent',
                }}
              >
                <CampusEventCard event={event} compact />
                {event.guidance?.fit_reason && (
                  <p className="px-1 pb-0.5 pt-2 text-xs leading-relaxed text-[#334155]">
                    {event.guidance.fit_reason}
                  </p>
                )}
                <span
                  className="mt-1.5 flex items-center gap-1.5 px-1 pb-1 text-xs font-bold"
                  style={{ color: isSelected ? 'var(--brand-navy-700)' : '#64748B' }}
                >
                  {isSelected ? <><Check size={13} aria-hidden="true" /> Anchoring your guide to this</> : 'Use this event'}
                </span>
              </button>

              {isSelected && event.guidance?.what_to_do?.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                    What to do there
                  </p>
                  <ol className="space-y-1.5">
                    {event.guidance.what_to_do.map((action, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-[#334155]">
                        <span className="shrink-0 pt-px font-bold tabular-nums text-[#64748B]">{i + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                  {event.guidance.questions_to_ask?.length > 0 && (
                    <p className="mt-2 border-t border-dashed border-[#E2E8F0] pt-2 text-xs text-[#64748B]">
                      Your questions get written into the guide.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        disabled={disabled}
        aria-pressed={!selected}
        className="mt-2 w-full rounded-xl border px-4 py-2.5 text-left text-xs font-semibold transition disabled:opacity-60"
        style={{
          borderColor: !selected ? 'var(--brand-navy-700)' : '#E2E8F0',
          color: !selected ? 'var(--brand-navy-700)' : '#64748B',
        }}
      >
        Skip — build the guide without an event
      </button>
    </div>
  );
}
