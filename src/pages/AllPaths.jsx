/**
 * All paths available to me — every path this student owns, the rest of the
 * validated library, and the look-alike merge tool that used to sit on My
 * Journey. Its own screen so My Journey keeps one instruction.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadOwnedPaths, authoritativeSet } from '@/lib/path-set';
import { getActiveCycle } from '@/lib/career-cycle';
import { selectPathAndBeginExperiment } from '@/lib/path-selection';
import { queryClientInstance } from '@/lib/query-client';
import { CycleLimitError } from '@/lib/pilot-access';
import PageHeader from '@/components/PageHeader';
import MergeLookalikePaths from '@/components/journey/MergeLookalikePaths';
import AllPathsPanel from '@/components/journey/AllPathsPanel';
import { Sk } from '@/components/PageSkeleton';

export default function AllPaths() {
  const navigate = useNavigate();
  const [paths, setPaths] = useState(null);
  const [currentPathId, setCurrentPathId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [owned, cycle] = await Promise.all([
      loadOwnedPaths().catch(() => ({ paths: [] })),
      getActiveCycle().catch(() => null),
    ]);
    const rows = owned?.paths || [];
    const live = rows.filter(p => p.status !== 'archived');
    setPaths(live.length ? live : (authoritativeSet(rows)?.paths || rows));
    setCurrentPathId(cycle?.selected_path_id || rows.find(p => p.is_primary_focus)?.id || null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChoose = useCallback(async (path) => {
    setError(null);
    setBusyId(path.id);
    try {
      await selectPathAndBeginExperiment(path, paths || []);
      await queryClientInstance.invalidateQueries({ queryKey: ['cycle-rail'] });
      await queryClientInstance.invalidateQueries({ queryKey: ['journey-focus'] });
      navigate('/test');
    } catch (err) {
      if (err instanceof CycleLimitError) {
        navigate('/journey');
        return;
      }
      setError(path.id);
    } finally {
      setBusyId(null);
    }
  }, [paths, navigate]);

  return (
    <main className="app-page">
      <PageHeader
        showBack
        backLabel="Back to My Journey"
        title="All paths available to me"
        description="Every path of your own, the ones that look like the same career, and the rest of the library you could explore."
      />
      <div className="app-stack">
        {/* Silent when there is nothing that looks duplicated. */}
        <MergeLookalikePaths onMerged={load} />

        {paths === null ? (
          <Sk h={280} r={16} />
        ) : (
          <AllPathsPanel
            paths={paths}
            currentPathId={currentPathId}
            onChoose={handleChoose}
            busyId={busyId}
            error={error}
            embedded
          />
        )}

        <button
          type="button"
          onClick={() => navigate('/journey')}
          className="app-cta-secondary tp-body self-start font-bold"
        >
          Back to My Journey
        </button>
      </div>
    </main>
  );
}