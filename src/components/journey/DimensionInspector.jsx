import { X, FlaskConical, MessageSquare, User } from 'lucide-react';
import { EVIDENCE_LEVEL_LABELS } from '@/lib/career-dimensions';

/** Which experiences produced a conclusion, so nothing has to be taken on trust. */
export default function DimensionInspector({ dimension, onClose }) {
  if (!dimension) return null;
  const d = dimension;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 anim-overlay sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="anim-modal max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--r-surface)] bg-white p-6 sm:rounded-[var(--r-surface)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{EVIDENCE_LEVEL_LABELS[d.current_evidence_level]}</p>
            <h3 className="tp-section mt-1" style={{ color: 'var(--surface-dark-900)' }}>{d.dimension_label}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="touch-target-square rounded-[var(--r-control)] text-[color:var(--ink-500)] hover:bg-[color:var(--ink-100)]">
            <X size={18} />
          </button>
        </div>

        <p className="tp-body" style={{ color: 'var(--ink-700)' }}>{d.statement}</p>

        {d.self_reported_preference && (
          <div className="mt-5">
            <p className="tp-eyebrow mb-2 text-[color:var(--ink-500)]">What you told us</p>
            <p className="tp-body flex items-start gap-2 text-[color:var(--ink-700)]">
              <User size={13} className="mt-1 shrink-0 text-[color:var(--ink-400)]" /> {d.self_reported_preference}
            </p>
          </div>
        )}

        {d.behavioral_evidence?.length > 0 && (
          <div className="mt-5">
            <p className="tp-eyebrow mb-2 text-[color:var(--ink-500)]">From what you did</p>
            <ul className="space-y-1.5">
              {d.behavioral_evidence.map((e, i) => (
                <li key={i} className="tp-body flex items-start gap-2 text-[color:var(--ink-700)]">
                  <FlaskConical size={13} className="mt-1 shrink-0 text-[color:var(--brand-navy-700)]" /> {e.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {d.contradictory_evidence?.length > 0 && (
          <div className="mt-5 rounded-[var(--r-control)] p-3" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.2)' }}>
            <p className="tp-eyebrow mb-2 text-[color:var(--warning-700)]">Pointing the other way</p>
            <ul className="space-y-1.5">
              {d.contradictory_evidence.map((e, i) => (
                <li key={i} className="tp-body flex items-start gap-2 text-[color:var(--ink-700)]">
                  <MessageSquare size={13} className="mt-1 shrink-0 text-[color:var(--warning-700)]" /> {e.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {d.careers_observed_in?.length > 0 && (
          <p className="tp-meta mt-5 text-[color:var(--ink-400)]">
            Observed while testing {d.careers_observed_in.join(', ')}. A preference can read differently in another setting.
          </p>
        )}

        {d.current_evidence_level === 'unknown' && (
          <p className="tp-meta mt-5 text-[color:var(--ink-400)]">Nothing you have done yet speaks to this, so we are not guessing.</p>
        )}
      </div>
    </div>
  );
}