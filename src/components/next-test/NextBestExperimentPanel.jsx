import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNextBestExperiment } from '@/lib/next-best-experiment';
import { recordOverride, recordAcceptance } from '@/lib/recommendation-overrides';
import RecommendedNextTest from '@/components/next-test/RecommendedNextTest';
import HumanRealityNextTest from '@/components/next-test/HumanRealityNextTest';
import { Sk } from '@/components/PageSkeleton';
import { Reveal } from '@/components/motion';
import EvidenceMethodLadder from '@/components/next-test/EvidenceMethodLadder';
import TestContainerPicker from '@/components/next-test/TestContainerPicker';

/**
 * Loads the recommendation and renders it. Stays silent when there is nothing
 * worth recommending — a student with no live hypotheses, or one whose open
 * questions have all been answered — rather than showing an empty prompt.
 *
 * An override recomputes the recommendation with that question set aside. The
 * uncertainty itself is never deleted: it is only held back, and the choice is
 * recorded as product-learning data.
 */
export default function NextBestExperimentPanel({ pathId = null, preferVariable = null, gap = null, gapId = gap?.id || null }) {
  const [state, setState] = useState({ loading: true, recommendation: null, unsupported: false });
  const [skip, setSkip] = useState([]);
  const [busy, setBusy] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  /* Which method on the evidence ladder the student wants. Null means the
     engine's own recommendation stands. */
  const [method, setMethod] = useState(null);
  const unsupportedRef = useRef(false);

  const load = useCallback(async (skipList, methodId = method) => {
    const res = await loadNextBestExperiment({ skip: skipList, pathId, preferVariable, gapId, method: methodId })
      .catch(() => ({ recommendation: null }));
    unsupportedRef.current = Boolean(res.unsupportedPath);
    return res.recommendation;
  }, [pathId, preferVariable, gapId, method]);

  useEffect(() => {
    let alive = true;
    load([]).then(r => {
      if (!alive) return;
      setState({ loading: false, recommendation: r, unsupported: unsupportedRef.current });
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

  /* A different method regenerates the same recommendation at that method. */
  const onSelectMethod = async (methodId) => {
    if (busy || methodId === (state.recommendation?.method || null)) return;
    setBusy(true);
    setMethod(methodId);
    const next = await load(skip, methodId);
    setState(s => ({ ...s, loading: false, recommendation: next || s.recommendation }));
    setBusy(false);
  };

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
    if (!current) return;
    recordAcceptance({ candidate: current.candidate, recommendation: current });
    /* A test started from a Conviction Gap opens the chain that later answers
       which tests actually resolve which gaps. Fire-and-forget. */
    if (gap?.id) {
      import('@/lib/gap-outcomes')
        .then(m => m.targetGap({ gap, recommendation: current }))
        .catch(() => {});
    }
  };

  if (state.loading) return <Sk h={268} r={16} />;
  /* A direction the library cannot carry a cycle on gets an honest sentence, not
     a recommendation and not silence. */
  if (state.unsupported) {
    return (
      <section className="app-card p-5 sm:p-6">
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>No test to recommend here yet</h2>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          We do not have a validated experiment for this direction, so there is nothing we can
          honestly recommend as your next test on it. Nothing you have recorded is affected.
        </p>
      </section>
    );
  }
  if (!state.recommendation) return null;
  /* The reveal lives here rather than around this component on the page: it
     renders nothing at all for a student with no open questions left, and a
     wrapper out there would space out an empty box. */
  // A question no task can answer gets the conversation card in the same slot.
  const ladder = (
    <>
      <EvidenceMethodLadder
        selected={state.recommendation.method}
        onSelect={onSelectMethod}
        recommendation={state.recommendation}
        disabled={busy}
      />
      <TestContainerPicker
        selectedMethod={state.recommendation.method}
        onSelect={onSelectMethod}
        recommendation={state.recommendation}
        disabled={busy}
      />
    </>
  );

  if (state.recommendation.human_reality) {
    return (
      <Reveal y={20}>
        {ladder}
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
      {ladder}
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