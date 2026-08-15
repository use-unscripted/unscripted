import { useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { libraryCareersNotOwned, filterCareers, careerSummary, addLibraryPath } from '@/lib/library-paths';

/**
 * Every other path in the validated career library, searchable. Closed until
 * asked for, so the student's own paths stay the first thing in the panel.
 * Adding one creates a real path row and hands it straight to the caller, which
 * selects it and opens Test — the same transition as choosing an existing path.
 */
export default function OtherPathsBrowser({ ownedPaths = [], onAdded, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [failedKey, setFailedKey] = useState(null);

  const available = useMemo(() => libraryCareersNotOwned(ownedPaths), [ownedPaths]);
  const shown = useMemo(() => filterCareers(available, query), [available, query]);
  if (!available.length) return null;

  const add = async (career) => {
    setFailedKey(null);
    setBusyKey(career.key);
    try {
      const path = await addLibraryPath(career);
      await onAdded(path);
    } catch {
      setFailedKey(career.key);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mt-5 border-t pt-5" style={{ borderColor: 'var(--border-light)' }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="touch-reach tp-body font-bold underline"
          style={{ color: 'var(--brand-navy-700)' }}
        >
          Browse {available.length} other paths you could explore
        </button>
      ) : (
        <>
          <p className="tp-card" style={{ color: 'var(--text-primary)' }}>
            Other paths you could explore
          </p>
          <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
            You are not limited to your first three. Add any of these and test it the same way.
          </p>

          <div
            className="mt-3 flex items-center gap-2 rounded-[var(--r-control)] px-3"
            style={{ border: '1px solid var(--border-light)', minHeight: '44px' }}
          >
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search paths, for example nursing or product"
              aria-label="Search all paths"
              className="tp-body w-full bg-transparent outline-none"
              style={{ color: 'var(--text-primary)', minHeight: '42px' }}
            />
          </div>

          {shown.length === 0 && (
            <p className="tp-body mt-4" style={{ color: 'var(--text-secondary)' }}>
              No path matches that yet. Try a broader word.
            </p>
          )}

          <div className="mt-3 space-y-2">
            {shown.map(career => (
              <div
                key={career.key}
                className="rounded-[var(--r-control)] p-4"
                style={{ background: 'var(--background-primary)', border: '1px solid var(--border-light)' }}
              >
                <p className="tp-card" style={{ color: 'var(--text-primary)' }}>{career.title}</p>
                <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>{career.family}</p>
                {careerSummary(career) && (
                  <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {careerSummary(career)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => add(career)}
                  disabled={disabled || Boolean(busyKey)}
                  className="ui-press tp-body mt-3 inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-5 font-bold disabled:opacity-60"
                  style={{ border: '1px solid var(--brand-navy-900)', color: 'var(--brand-navy-900)', minHeight: '44px' }}
                >
                  {busyKey === career.key && <Loader2 size={14} className="animate-spin" />}
                  Add this path and test it
                </button>
                {failedKey === career.key && (
                  <p className="tp-meta mt-2" style={{ color: 'var(--danger-700)' }}>
                    That did not go through. Try again.
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}