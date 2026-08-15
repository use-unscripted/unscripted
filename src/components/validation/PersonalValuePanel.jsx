import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Personal Learning Value, and why. Deliberately separate from Experiment
 * Strength: a well-validated experiment can still be a poor next test for this
 * particular student.
 */
export default function PersonalValuePanel({ value, pathName }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="app-inset p-4" style={{ background: 'var(--ink-50)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Personal learning value</p>
      <p className="tp-card mt-1" style={{ color: 'var(--text-primary)' }}>{value.level_label}</p>
      <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>{value.headline}</p>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="touch-reach tp-meta mt-3 inline-flex items-center gap-1 font-bold"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        Why this is useful for you
        <ChevronDown size={14} className="transition" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {value.reasons.map((r, i) => (
            <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>{r}</li>
          ))}
          {pathName && (
            <li className="tp-meta" style={{ color: 'var(--text-muted)' }}>
              Judged against the evidence you have gathered so far, including work on {pathName}.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}