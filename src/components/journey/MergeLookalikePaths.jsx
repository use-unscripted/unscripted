import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Merge, Loader2 } from 'lucide-react';
import MergePairCard from '@/components/journey/MergePairCard';

/**
 * Two of your paths describing the same career, and a way to fold one into the
 * other. Silent when there is nothing to resolve, so it never adds noise to
 * My Journey.
 *
 * The student picks which path survives; everything attached to the other one
 * (tests, evidence, reflections, hypothesis updates, and the cycle itself) moves
 * across, and the folded path is archived rather than deleted.
 */
export default function MergeLookalikePaths({ onMerged }) {
  const [pairs, setPairs] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    const res = await base44.functions.invoke('mergePaths', { action: 'find' }).catch(() => null);
    setPairs(res?.data?.pairs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const merge = async (keepId, duplicateId, key) => {
    setError(null);
    setBusy(key);
    try {
      const res = await base44.functions.invoke('mergePaths', {
        action: 'merge', keep_id: keepId, duplicate_id: duplicateId,
      });
      if (!res?.data?.merged) throw new Error(res?.data?.error || 'Merge failed');
      setDone(res.data);
      await load();
      if (onMerged) await onMerged();
    } catch (err) {
      setError(key);
    } finally {
      setBusy(null);
    }
  };

  if (!pairs || (!pairs.length && !done)) return null;

  return (
    <section className="app-card-flat p-5">
      <div className="flex items-start gap-2.5">
        <Merge size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
        <div>
          <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Paths that look like the same career</h2>
          <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>
            Keep the one you are working in. Everything attached to the other one moves across, and nothing is deleted.
          </p>
        </div>
      </div>

      {done && (
        <p
          className="tp-body mt-4 rounded-[var(--r-control)] p-3"
          style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}
        >
          Moved {done.moved_total} record{done.moved_total === 1 ? '' : 's'} from
          {' '}&ldquo;{done.duplicate_name}&rdquo; onto &ldquo;{done.keep_name}&rdquo;.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {pairs.map(pair => {
          const key = pair.options.map(o => o.id).join(':');
          return (
            <MergePairCard
              key={key}
              pair={pair}
              busy={busy === key}
              disabled={Boolean(busy)}
              failed={error === key}
              onMerge={(keepId, dupId) => merge(keepId, dupId, key)}
            />
          );
        })}
      </div>

      {busy && (
        <p className="tp-meta mt-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={13} className="animate-spin" /> Moving your progress across.
        </p>
      )}
    </section>
  );
}