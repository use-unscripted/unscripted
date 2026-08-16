import { useState } from 'react';
import { Check, X, FlaskConical, Wrench } from 'lucide-react';

/**
 * What a student sees about a direction's infrastructure: two words, and the
 * detail only if they ask for it. Validation levels and scores stay behind the
 * disclosure; the badge itself says only whether this can be tested now.
 */
export default function PathSupportBadge({ support, showDetail = true }) {
  const [open, setOpen] = useState(false);
  if (!support) return null;

  const ready = support.testable;
  const Icon = ready ? FlaskConical : Wrench;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className="tp-meta inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold"
        style={ready
          ? { background: 'var(--success-50)', color: 'var(--success-700)' }
          : { background: 'var(--warning-50)', color: 'var(--warning-700)' }}
      >
        <Icon size={11} /> {support.state.badge}
      </span>

      {showDetail && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="tp-meta font-semibold underline"
          style={{ color: 'var(--brand-navy-700)' }}
        >
          {open ? 'Hide what this means' : 'What this means'}
        </button>
      )}

      {open && (
        <span
          className="tp-meta block rounded-[var(--r-control)] p-3"
          style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}
        >
          <span className="block">{support.state.detail}</span>
          <span className="mt-2 block space-y-1">
            {support.requirements.map(r => (
              <span key={r.id} className="flex items-start gap-1.5">
                {r.met
                  ? <Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--success-700)' }} />
                  : <X size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--ink-400)' }} />}
                <span>{r.label}{typeof r.count === 'number' ? ` (${r.count})` : ''}</span>
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}