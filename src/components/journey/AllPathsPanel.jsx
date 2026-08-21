import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Check, Loader2, FlaskConical } from 'lucide-react';
import OtherPathsBrowser from '@/components/journey/OtherPathsBrowser';

/**
 * Every path this student has, at the bottom of My Journey. Closed by default so
 * the page keeps its one instruction; opened, it is a list, and choosing one
 * hands off to the Test stage with that path selected.
 */
export default function AllPathsPanel({ paths = [], currentPathId, onChoose, busyId, error, embedded = false }) {
  const [open, setOpen] = useState(embedded);
  if (!paths.length) return null;

  return (
    <section className="app-card-flat p-5">
      {!embedded && <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="touch-target flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="tp-card block" style={{ color: 'var(--text-primary)' }}>
            See all paths available to me
          </span>
          <span className="tp-meta mt-0.5 block" style={{ color: 'var(--text-muted)' }}>
            {paths.length} path{paths.length === 1 ? '' : 's'} of your own, plus every other path you could explore.
          </span>
        </span>
        {open
          ? <ChevronUp size={18} style={{ color: 'var(--brand-navy-700)' }} />
          : <ChevronDown size={18} style={{ color: 'var(--brand-navy-700)' }} />}
      </button>}

      {open && (
        <div className={embedded ? '' : 'mt-4'}>
        <p className="tp-meta mb-2 font-bold uppercase" style={{ color: 'var(--brand-navy-700)' }}>
          Your paths
        </p>
        <div className="space-y-3">
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
                {/* Every path gets its Lab, whether or not it is the one being
                    tested right now. */}
                {/* One row, so the quiet link and the primary button sit beside
                    each other with real space between them instead of two
                    inline-level boxes landing on the same text line. */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <Link
                    to={`/conviction-lab?pathId=${path.id}`}
                    className="tp-meta inline-flex items-center gap-1 font-bold"
                    style={{ color: 'var(--brand-navy-700)', minHeight: '44px' }}
                  >
                    <FlaskConical size={12} /> Conviction Lab
                  </Link>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => onChoose(path)}
                      disabled={Boolean(busyId)}
                      className="ui-press tp-body inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-5 font-bold text-white disabled:opacity-60"
                      style={{ background: 'var(--brand-navy-900)', minHeight: '44px' }}
                    >
                      {busyId === path.id && <Loader2 size={14} className="animate-spin" />}
                      Choose this path and test it
                    </button>
                  )}
                </div>
                {error === path.id && (
                  <p className="tp-meta mt-2" style={{ color: 'var(--danger-700)' }}>
                    That did not go through. Try again.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {/* The rest of the validated library, so three is a starting point
            rather than a limit. */}
        <OtherPathsBrowser ownedPaths={paths} onAdded={onChoose} disabled={Boolean(busyId)} />
        </div>
      )}
    </section>
  );
}