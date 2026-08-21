import { MapPin } from 'lucide-react';

/**
 * The "you are here, do this next" line.
 *
 * Every stage screen carries several panels, and which one is the actual task
 * was only ever implied by position. This says it outright, in one sentence, in
 * the same place on every stage.
 */
export default function StageOrientation({ label, instruction }) {
  if (!instruction) return null;

  return (
    <p
      className="tp-body app-inset mt-4 inline-flex items-start gap-2 px-3.5 py-2.5"
      style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}
    >
      <MapPin size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} aria-hidden="true" />
      <span>
        <span className="font-semibold" style={{ color: 'var(--ink-900)' }}>You are here: {label}.</span>{' '}
        {instruction}
      </span>
    </p>
  );
}