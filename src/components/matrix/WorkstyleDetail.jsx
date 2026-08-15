import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

/** One work characteristic, with the experiences behind it and where they came from. */
export default function WorkstyleDetail({ row, onClose }) {
  if (!row) return null;
  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(5,8,22,0.45)' }} role="dialog" aria-modal="true" onClick={onClose}>
      <div className="anim-modal max-h-[90vh] w-full max-w-xl overflow-y-auto bg-[color:var(--background-primary)] p-6 sm:rounded-[var(--r-surface)] sm:p-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="tp-page" style={{ color: 'var(--text-primary)' }}>{row.label}</h2>
            <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
              {row.levelLabel} · {row.confidence}% confidence
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="touch-target-square ui-press grid place-items-center rounded-[var(--r-control)] p-2 hover:bg-[color:var(--ink-100)]">
            <X size={18} />
          </button>
        </div>

        <p className="app-inset tp-body mt-5 p-3.5" style={{ background: 'var(--ink-50)', color: 'var(--text-secondary)' }}>
          {row.interpretation}
        </p>

        <h3 className="tp-section mt-6" style={{ color: 'var(--text-primary)' }}>What happened</h3>
        {row.behavioral.length ? (
          <ul className="mt-2 space-y-1.5">
            {row.behavioral.map((b, i) => (
              <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
                {b.text} <span style={{ color: 'var(--text-muted)' }}>({b.source})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
            {row.selfReported ? `${row.selfReported} That has not been tested yet.` : 'No experiences recorded for this yet.'}
          </p>
        )}

        {row.contradictory.length > 0 && (
          <>
            <h3 className="tp-section mt-6" style={{ color: 'var(--text-primary)' }}>Pointing the other way</h3>
            <ul className="mt-2 space-y-1.5">
              {row.contradictory.map((b, i) => (
                <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>{b.text}</li>
              ))}
            </ul>
          </>
        )}

        {row.careers.length > 0 && (
          <>
            <h3 className="tp-section mt-6" style={{ color: 'var(--text-primary)' }}>Directions this informs</h3>
            <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{row.careers.join(', ')}</p>
          </>
        )}

        {['unknown', 'mixed'].includes(row.levelKey) && (
          <Link to="/test" className="app-cta tp-control mt-7 inline-flex">Test this further</Link>
        )}
      </div>
    </div>
  );
}