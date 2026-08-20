import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { loadOwnedPaths, authoritativeSet } from '@/lib/path-set';
import { getActiveCycle } from '@/lib/career-cycle';
import PathFocusPanel from '@/components/journey/PathFocusPanel';
import CurrentPathCard from '@/components/journey/CurrentPathCard';
import { selectPathAndBeginExperiment } from '@/lib/path-selection';
import { CycleLimitError } from '@/lib/pilot-access';
import PathSelectedConfirm from '@/components/journey/PathSelectedConfirm';
import { Sk } from '@/components/PageSkeleton';

/**
 * Reading the paths one at a time, and committing to the one you test first.
 *
 * The path being tested is named first, whether or not it came from the most
 * recent set of three: a student who chose earlier, or added a path from the
 * library, used to see three names on this screen that did not include their own.
 * Switching is then a deliberate second step, and the live path is listed there
 * too so the comparison is honest.
 */
export default function ChoosePath() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paths, setPaths] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const [owned, cycle] = await Promise.all([
      loadOwnedPaths().catch(() => ({ paths: [] })),
      getActiveCycle().catch(() => null),
    ]);
    const all = owned?.paths || [];
    const set = authoritativeSet(all);
    const comparison = set?.paths || all.filter(p => p.status !== 'archived');
    const currentId = cycle?.selected_path_id || all.find(p => p.is_primary_focus)?.id || null;
    const current = all.find(p => p.id === currentId) || null;
    // The live path always appears in the switch list, even when it is not part
        // of the most recent generated set.
    const withCurrent = current && !comparison.some(p => p.id === current.id)
      ? [current, ...comparison]
      : comparison;
    setPaths({ all, comparison: withCurrent, current });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = useCallback(async (path) => {
    setError(null);
    setBusyId(path.id);
    try {
      const result = await selectPathAndBeginExperiment(path, paths?.all || []);
      setConfirmed({ pathName: path.path_name, experiment: result.experiment });
      /* The cycle reading is cached for a minute and it is what every later
         stage means by "the path being tested". Without dropping it here, Test,
         Prove and Decide all carried on naming the previous path until the
         cache aged out, which read as the choice never having been made. */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cycle-rail'] }),
        queryClient.invalidateQueries({ queryKey: ['journey-focus'] }),
      ]);
      await load();
      // Straight to the Test stage, which shows the path now being tested and
      // the unknowns still open on it.
      navigate('/test');
    } catch (err) {
      // A limit used to fail silently, so the button looked broken. It now sends
      // the student to My Journey, where the continuation step explains it.
      if (err instanceof CycleLimitError) navigate('/journey');
      else setError(path.id);
    } finally {
      setBusyId(null);
    }
  }, [paths, load, navigate, queryClient]);

  if (!paths) return <Sk h={320} r={16} />;

  const showList = !paths.current || switching;

  return (
    <>
      {confirmed && (
        <PathSelectedConfirm
          pathName={confirmed.pathName}
          experiment={confirmed.experiment}
          onDismiss={() => setConfirmed(null)}
        />
      )}

      <CurrentPathCard
        path={paths.current}
        switching={switching}
        onToggleSwitch={() => setSwitching(s => !s)}
      />

      {/* One path at a time. The side-by-side comparison put every field of all
          three on screen at once, which is what made this page overwhelming. */}
      {showList && (
        <PathFocusPanel
          paths={paths.comparison}
          currentPathId={paths.current?.id || null}
          title={paths.current ? 'Paths you could test instead' : undefined}
          description={paths.current
            ? 'Open one to read it. Choosing a different path starts a new test on it.'
            : undefined}
          onSelect={handleSelect}
          busyId={busyId}
          error={error}
          onRetry={() => setError(null)}
        />
      )}
    </>
  );
}