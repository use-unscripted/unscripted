/**
 * Point this reflection at experiments you already finished, grouped by the path
 * they belong to. Completed experiments only: an unfinished one has nothing to
 * compare against yet.
 */
import { Check, FlaskConical } from 'lucide-react';

export default function ReferencedExperiments({ experiments, selected, onToggle }) {
  if (!experiments.length) return null;

  const byPath = experiments.reduce((acc, e) => {
    const key = e.path_name || 'Other experiments';
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {});

  return (
    <div>
      <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
        Reference an experiment you finished
        <span className="font-normal" style={{ color: 'var(--text-muted)' }}> · optional</span>
      </p>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        Pick any completed experiment this conclusion builds on or contradicts.
      </p>

      <div className="mt-2.5 space-y-4">
        {Object.entries(byPath).map(([pathName, rows]) => (
          <div key={pathName}>
            <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{pathName}</p>
            <div className="mt-2 space-y-2">
              {rows.map(e => {
                const on = selected.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onToggle(e.id)}
                    aria-pressed={on}
                    className="ui-press flex w-full items-start gap-2.5 rounded-[var(--r-control)] p-3 text-left"
                    style={on
                      ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)', minHeight: '48px' }
                      : { background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}
                  >
                    {on ? <Check size={15} className="mt-0.5 shrink-0" /> : <FlaskConical size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />}
                    <span className="min-w-0">
                      <span className="tp-card block">{e.title}</span>
                      {e.objective && (
                        <span className="tp-meta mt-0.5 block" style={{ color: on ? 'rgba(255,255,255,.75)' : 'var(--text-muted)' }}>
                          {e.objective}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}