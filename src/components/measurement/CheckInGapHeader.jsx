import { Target } from 'lucide-react';

/**
 * What this test is for, at the top of the pre-experiment check-in. The gap
 * comes off the experiment record itself, so nothing new is stored; when an
 * experiment was not started from a gap there is nothing to name and this
 * renders nothing rather than inventing a purpose.
 */
export default function CheckInGapHeader({ exp }) {
  const gap = exp?.uncertainty_label || exp?.unresolved_question || exp?.test_question;
  if (!gap) return null;

  return (
    <div className="app-inset mb-5 flex items-start gap-2.5 p-3" style={{ background: 'var(--background-tertiary)' }}>
      <Target size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
      <div className="min-w-0">
        <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>The gap you are testing</p>
        <p className="tp-body mt-0.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{gap}</p>
      </div>
    </div>
  );
}