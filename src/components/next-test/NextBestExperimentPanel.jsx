import { useEffect, useState } from 'react';
import { loadNextBestExperiment } from '@/lib/next-best-experiment';
import RecommendedNextTest from '@/components/next-test/RecommendedNextTest';
import { Sk } from '@/components/PageSkeleton';

/**
 * Loads the recommendation and renders it. Stays silent when there is nothing
 * worth recommending — a student with no live hypotheses, or one whose open
 * questions have all been answered — rather than showing an empty prompt.
 */
export default function NextBestExperimentPanel() {
  const [state, setState] = useState({ loading: true, recommendation: null });

  useEffect(() => {
    let alive = true;
    loadNextBestExperiment()
      .then(({ recommendation }) => { if (alive) setState({ loading: false, recommendation }); })
      .catch(() => { if (alive) setState({ loading: false, recommendation: null }); });
    return () => { alive = false; };
  }, []);

  if (state.loading) return <Sk h={268} r={22} />;
  if (!state.recommendation) return null;
  return (
    <div className="content-in">
      <RecommendedNextTest recommendation={state.recommendation} />
    </div>
  );
}