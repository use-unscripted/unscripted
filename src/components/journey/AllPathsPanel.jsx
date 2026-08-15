import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react';

/**
 * Every path this student has, at the bottom of My Journey. Closed by default so
 * the page keeps its one instruction; opened, it is a list, and choosing one
 * hands off to the Test stage with that path selected.
 */
export default function AllPathsPanel({ paths = [], currentPathId, onChoose, busyId, error }) {
  const [open, setOpen] = useState(false);
  if (!paths.length) return null;

  return (
    <section className="app-card-flat p-5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="touch-target flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="tp-card block" style={{ color: 'var(--text-primary)' }}>
            See all paths available to me
          </span>
          <span className="tp-meta mt-0.5 block" style={{ color: 'var(--text-muted)' }}>
            {paths.length} path{paths.length === 1 ? '' : 's'}. You can switch the one you are testing.
          </span>
        </span>
        {open
          ? <ChevronUp size={18} style={{ color: 'var(--brand-navy-700)' }} />
          : <ChevronDown size={18} style={{ color: 'var(--brand-navy-700)' }} />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {paths.map(path => {
            const isCurrent = path.id === currentPathId;
            return (
              <div
                key={path.id}
                className="rounded-[var(--r-control)] p-4"
                style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{path.path_name}</p>
                  {isCurrent && (
                    <span
                      className="tp-meta inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase"
                      style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}
                    >
                      <Check size={11} /> Testing now
                    </span>
                  )}
                </div>
                {(path.fit_reason || path.why_it_fits) && (
                  <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {path.fit_reason || path.why_it_fits}
                  </p>
                )}
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => onChoose(path)}
                    disabled={Boolean(busyId)}
                    className="ui-press tp-body mt-3 inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-5 font-bold text-white disabled:opacity-60"
                    style={{ background: 'var(--brand-navy-900)', minHeight: '44px' }}
                  >
                    {busyId === path.id && <Loader2 size={14} className="animate-spin" />}
                    Choose this path and test it
                  </button>
                )}
                {error === path.id && (
                  <p className="tp-meta mt-2" style={{ color: 'var(--danger-700)' }}>
                    That did not go through. Try again.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}