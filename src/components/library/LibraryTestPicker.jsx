/**
 * Choosing a validated test for the career you are testing.
 *
 * Careers with a role blueprint in the library get real options with real
 * strength and learning-value readings. Careers without one say so plainly and
 * point at the custom setup route, rather than pretending to have a library
 * experiment for them.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { loadLibraryOptions, startExperimentFromTemplate } from '@/lib/experiment-library';
import { getActiveCycle, attachExperimentToCycle } from '@/lib/career-cycle';
import { queryClientInstance } from '@/lib/query-client';
import LibraryExperimentCard from '@/components/library/LibraryExperimentCard';
import { Sk } from '@/components/PageSkeleton';

export default function LibraryTestPicker({ path }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    if (!path?.path_name) return () => { live = false; };
    loadLibraryOptions({ pathName: path.path_name })
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setData({ supported: false, rows: [] }); });
    return () => { live = false; };
  }, [path?.path_name]);

  const start = useCallback(async (row) => {
    setError(false);
    setBusyId(row.id);
    try {
      const cycle = await getActiveCycle().catch(() => null);
      const experiment = await startExperimentFromTemplate(row.template, { path, cycle });
      if (cycle) await attachExperimentToCycle(experiment).catch(() => null);
      await queryClientInstance.invalidateQueries({ queryKey: ['journey-focus'] });
      await queryClientInstance.invalidateQueries({ queryKey: ['cycle-rail'] });
      navigate(`/experiment?experimentId=${experiment.id}`);
    } catch (err) {
      setError(true);
    } finally {
      setBusyId(null);
    }
  }, [navigate, path]);

  if (!path?.path_name) return null;
  if (!data) return <Sk h={220} r={16} />;

  if (!data.supported) {
    return (
      <section className="app-card p-5 sm:p-6">
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>No validated tests for this direction yet</h2>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          Our validated library does not cover {path.path_name} yet, so there is nothing here with verified source grounding behind it.
          You can still design your own test, and it will be treated as an unvalidated experiment rather than shown with a strength score it has not earned.
        </p>
        <Link
          to={`/experiments/new?pathName=${encodeURIComponent(path.path_name)}`}
          className="ui-press app-cta-secondary tp-control mt-4"
        >
          Design my own test
        </Link>
      </section>
    );
  }

  const bestNextId = data.best?.confident ? data.best.best_next_test_id : null;
  const bestValidatedId = data.best?.best_validated_id || null;

  return (
    <section className="app-stack">
      <div>
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
          Validated tests for {data.careerTitle}
        </h2>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          Each one answers a different question. Strength says how well validated the test is; value for you says how much it would teach you now, given what your evidence already covers.
        </p>
        {data.early && (
          <div className="app-inset mt-3 p-3" style={{ background: 'var(--ink-100)' }}>
            <p className="tp-meta flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ink-700)' }}>
              <Info size={13} /> {data.early.label}
            </p>
            <p className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>{data.early.note}</p>
          </div>
        )}
        {data.best && !data.best.confident && (
          <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>{data.best.explanation}</p>
        )}
        {data.best?.confident && data.best.differ && (
          <p className="tp-body mt-3" style={{ color: 'var(--text-secondary)' }}>{data.best.explanation}</p>
        )}
      </div>

      {error && (
        <p className="tp-body" style={{ color: 'var(--danger-700)' }}>
          That did not save. Try again.
        </p>
      )}

      {data.rows.map(row => (
        <LibraryExperimentCard
          key={row.id}
          row={row}
          bestNext={row.id === bestNextId}
          bestValidated={row.id === bestValidatedId}
          onStart={start}
          busy={busyId === row.id}
        />
      ))}

      <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
        None of these fit? <Link to={`/experiments/new?pathName=${encodeURIComponent(path.path_name)}`} className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Design your own test</Link>
      </p>
    </section>
  );
}