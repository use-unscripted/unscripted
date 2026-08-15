import { useCallback, useEffect, useState } from 'react';
import { loadOwnedPaths, authoritativeSet } from '@/lib/path-set';
import { selectPathAndBeginExperiment } from '@/lib/path-selection';
import { CycleLimitError } from '@/lib/pilot-access';
import PathComparisonWorkspace from '@/components/journey/PathComparisonWorkspace';
import PathSelectedConfirm from '@/components/journey/PathSelectedConfirm';
import { Sk } from '@/components/PageSkeleton';

/**
 * Choosing the one path to test, on its own.
 *
 * `mode="compare"` shows the same workspace without committing to anything: the
 * button hands the student to the Choose stage instead of starting an experiment,
 * so comparing and committing are two different screens rather than one page
 * that does both at once.
 */
export default function ChoosePath({ mode = 'choose', onCompareSelect }) {
  const [paths, setPaths] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(null);

  const load = useCallback(async () => {
    const owned = await loadOwnedPaths().catch(() => ({ paths: [] }));
    const all = owned?.paths || [];
    const set = authoritativeSet(all);
    setPaths({ all, comparison: set?.paths || all.filter(p => p.status !== 'archived') });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = useCallback(async (path) => {
    if (mode === 'compare') { onCompareSelect?.(path); return; }
    setError(null);
    setBusyId(path.id);
    try {
      const result = await selectPathAndBeginExperiment(path, paths?.all || []);
      setConfirmed({ pathName: path.path_name, experiment: result.experiment });
      await load();
    } catch (err) {
      if (!(err instanceof CycleLimitError)) setError(path.id);
    } finally {
      setBusyId(null);
    }
  }, [mode, onCompareSelect, paths, load]);

  if (!paths) return <Sk h={320} r={16} />;

  return (
    <>
      {confirmed && (
        <PathSelectedConfirm
          pathName={confirmed.pathName}
          experiment={confirmed.experiment}
          onDismiss={() => setConfirmed(null)}
        />
      )}
      <PathComparisonWorkspace
        paths={paths.comparison}
        onSelect={handleSelect}
        busyId={busyId}
        error={error}
        onRetry={() => setError(null)}
        ctaLabel={mode === 'compare' ? 'Consider this path' : 'Test this path'}
      />
    </>
  );
}