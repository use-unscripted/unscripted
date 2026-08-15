import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Sk, SkGrid } from '@/components/PageSkeleton';
import CompareExperimentCard from '@/components/validation/CompareExperimentCard';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import { loadComparableExperiments, loadComparison } from '@/lib/experiment-compare';

/**
 * Compare Experiments: the same experiments side by side, with the one most
 * likely to teach THIS student something marked. Deliberately not the same
 * question as which one is best validated, and it says so when they differ.
 */
export default function CompareExperiments() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let live = true;
    const pathName = new URLSearchParams(window.location.search).get('pathName');
    loadComparableExperiments(pathName)
      .then(loadComparison)
      .then(r => { if (live) setState(r); })
      .catch(() => { if (live) setState({ rows: [], best: null }); });
    return () => { live = false; };
  }, []);

  if (!state) {
    return (
      <main className="app-page">
        <PageHeader title="Compare experiments" description="Which of these is worth your time right now." />
        <div className="mb-6"><Sk h={88} r={16} /></div>
        <SkGrid count={3} h={360} cols={3} />
      </main>
    );
  }

  if (!state.rows.length) {
    return (
      <main className="app-page">
        <PageHeader title="Compare experiments" />
        <JourneyEmptyState variant="experiment" />
      </main>
    );
  }

  const { rows, best } = state;

  return (
    <main className="app-page">
      <PageHeader
        title="Compare experiments"
        description="How well validated each experiment is, and how much it would teach you given what your evidence already says."
      />

      {best && (
        <section
          className="app-card mb-6 p-5"
          style={best.confident ? { borderColor: 'var(--brand-gold-500)' } : undefined}
        >
          <p className="tp-eyebrow" style={{ color: best.confident ? 'var(--brand-gold-700)' : 'var(--text-muted)' }}>
            {best.confident ? 'Best next test for you' : 'No clear best next test'}
          </p>
          <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{best.explanation}</p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(row => (
          <CompareExperimentCard
            key={row.experiment.id}
            row={row}
            isBestNextTest={best?.best_next_test_id === row.experiment.id}
            isBestValidated={best?.best_validated_id === row.experiment.id}
          />
        ))}
      </div>

      <p className="tp-meta mt-8 text-center" style={{ color: 'var(--text-muted)' }}>
        <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
      </p>
    </main>
  );
}