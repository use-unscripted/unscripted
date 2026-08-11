import { useEffect, useState } from 'react';
import { loadNextBestExperiment } from '@/lib/next-best-experiment';
import RecommendedNextTest from '@/components/next-test/RecommendedNextTest';
import { Sk } from '@/components/PageSkeleton';
import { Reveal } from '@/components/motion';

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

  if (state.loading) return <Sk h={268} r={16} />;
  if (!state.recommendation) return null;
  /* The reveal lives here rather than around this component on the page: it
     renders nothing at all for a student with no open questions left, and a
     wrapper out there would space out an empty box. */
  return (
    <Reveal y={20}>
      <RecommendedNextTest recommendation={state.recommendation} />
    </Reveal>
  );
}