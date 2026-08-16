import { useCallback, useEffect, useState } from 'react';
import { loadNextBestExperiment } from '@/lib/next-best-experiment';
import { recordOverride, recordAcceptance } from '@/lib/recommendation-overrides';
import RecommendedNextTest from '@/components/next-test/RecommendedNextTest';
import HumanRealityNextTest from '@/components/next-test/HumanRealityNextTest';
import { Sk } from '@/components/PageSkeleton';
import { Reveal } from '@/components/motion';

/**
 * Loads the recommendation and renders it. Stays silent when there is nothing
 * worth recommending — a student with no live hypotheses, or one whose open
 * questions have all been answered — rather than showing an empty prompt.
 *
 * An override recomputes the recommendation with that question set aside. The
 * uncertainty itself is never deleted: it is only held back, and the choice is
 * recorded as product-learning data.
 */
export default function NextBestExperimentPanel({ pathId = null }) {
  const [state, setState] = useState({ loading: true, recommendation: null });
  const [skip, setSkip] = useState([]);
  const [busy, setBusy] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const load = useCallback(async (skipList) => {
    const { recommendation } = await loadNextBestExperiment({ skip: skipList, pathId }).catch(() => ({ recommendation: null }));
    return recommendation;
  }, [pathId]);

  useEffect(() => {
    let alive = true;
    load([]).then(r => {
      if (!alive) return;
      setState({ loading: false, recommendation: r });
      /* A recommendation that reached the screen. Recorded here rather than
         where it is computed, because a recommendation nobody saw is not a
         funnel stage. Repeat: after a finished cycle this same panel is the
         "what comes next" step, which the reflection page renders. */
      if (r) {
        import('@/lib/analytics/decision-funnel-events')
          .then(m => m.recommendationShown({
            pathId: pathId || r.candidate?.path_id,
            stage: r.candidate?.variable,
            repeat: Boolean(pathId),
          }))
          .catch(() => {});
      }
    });
    return () => { alive = false; };
  }, [load, pathId]);

  const onOverride = async (action, note) => {
    const current = state.recommendation;
    if (!current || busy) return;
    setBusy(true);
    await recordOverride({ action, note, candidate: current.candidate, recommendation: current });
    // "Another test" keeps the same question and asks for a different task, so
    // only the other three set the question aside.
    const nextSkip = action === 'another_test' ? skip : [...skip, current.candidate.variable];
    setSkip(nextSkip);
    const next = await load(nextSkip);
    if (!next) setExhausted(true);
    setState({ loading: false, recommendation: next || current });
    setBusy(false);
  };

  /* Accepting is recorded too, not just refusing. Without it the log only ever
     shows the recommendations students rejected, which would make every rule
     look bad. Fire-and-forget: the student navigates immediately either way. */
  const onAccept = () => {
    const current = state.recommendation;
    if (current) recordAcceptance({ candidate: current.candidate, recommendation: current });
  };

  if (state.loading) return <Sk h={268} r={16} />;
  if (!state.recommendation) return null;
  /* The reveal lives here rather than around this component on the page: it
     renders nothing at all for a student with no open questions left, and a
     wrapper out there would space out an empty box. */
  // A question no task can answer gets the conversation card in the same slot.
  if (state.recommendation.human_reality) {
    return (
      <Reveal y={20}>
        <HumanRealityNextTest
          recommendation={state.recommendation}
          onAccept={onAccept}
          onOverride={onOverride}
          busy={busy}
          exhausted={exhausted}
        />
      </Reveal>
    );
  }

  return (
    <Reveal y={20}>
      <RecommendedNextTest
        recommendation={state.recommendation}
        onAccept={onAccept}
        onOverride={onOverride}
        busy={busy}
        exhausted={exhausted}
      />
    </Reveal>
  );
}