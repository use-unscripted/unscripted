/**
 * Reflection as the step that UPDATES THE CAREER HYPOTHESIS.
 *
 * Same reflection system as before — one row per experiment in
 * WeeklyReflections, the same recalculation engine, the same cycle close — with
 * its purpose made explicit and its order fixed:
 *
 *   context loaded automatically → post-experiment check-in → six sections of
 *   reflection → the recalculation → the suggested hypothesis synthesis, which
 *   the student can correct → continue / modify / eliminate → the update is
 *   appended to this hypothesis's history, and the cycle closes.
 *
 * No prior hypothesis state is overwritten anywhere in this flow.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, RotateCcw } from 'lucide-react';
import {
  loadConclusionContext, conclusionAvailability, endExperimentEarly,
  saveConclusion,
} from '@/lib/experiment-conclusion';
import { clearConclusionDraft } from '@/lib/student-drafts';
import ReflectionContextCard from '@/components/reflection/ReflectionContextCard';
import HumanEvidenceContext from '@/components/reflection/HumanEvidenceContext';
import ConclusionGate from '@/components/reflection/ConclusionGate';
import ReflectionForm from '@/components/reflection/ReflectionForm';
import EvidenceUpdatePanel from '@/components/reflection/EvidenceUpdatePanel';
import HypothesisSynthesisPanel from '@/components/reflection/HypothesisSynthesisPanel';
import HypothesisDecision from '@/components/reflection/HypothesisDecision';
import HypothesisTimeline from '@/components/reflection/HypothesisTimeline';
import CycleSummary from '@/components/reflection/CycleSummary';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import PageHeader from '@/components/PageHeader';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import PathHistoryPanel from '@/components/paths/PathHistoryPanel';
import MeasurementGate from '@/components/measurement/MeasurementGate';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { dimensionsFromActivity, dimensionsForExperiment } from '@/lib/career-dimensions';
import { buildSynthesis } from '@/lib/hypothesis-synthesis';
import { decisionMeta, ELIMINATION_NOTE } from '@/lib/hypothesis-updates';
import { loadNextBestExperiment } from '@/lib/next-best-experiment';
import { Sk } from '@/components/PageSkeleton';
import ReflectionStep from '@/components/reflection/ReflectionStep';
import FeedbackSurveyPanel from '@/components/reflection/FeedbackSurveyPanel';

/* The flow, named. Four steps from "the experiment is finished" to "the cycle is
   closed", so the student can see how much is left at every point. */
const TOTAL_STEPS = 4;

function Shell({ children }) {
  return <main className="app-page"><div className="space-y-5">{children}</div></main>;
}

function Notice({ title, body, to, cta }) {
  return (
    <section className="rounded-[var(--r-surface)] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-body flex items-center gap-2 font-bold" style={{ color: 'var(--text-primary)' }}>
        <AlertCircle size={15} style={{ color: 'var(--brand-navy-700)' }} /> {title}
      </p>
      <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      <Link to={to} className="ui-press tp-body mt-4 inline-flex items-center rounded-[var(--r-control)] px-5 py-3 font-bold text-white"
        style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
        {cta}
      </Link>
    </section>
  );
}

export default function ExperimentReflection() {
  const { search } = useLocation();
  const experimentIdParam = new URLSearchParams(search).get('experimentId') || '';
  const [ctx, setCtx] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reflection, setReflection] = useState(null);
  const [decision, setDecision] = useState(null);
  const [closedCycle, setClosedCycle] = useState(null);
  const [measurement, setMeasurement] = useState(null);
  const [dimensions, setDimensions] = useState([]);
  // The recalculation result for the tested career, the suggested synthesis
  // built from it, and the version the student approved.
  const [changes, setChanges] = useState(null);
  const [nextBest, setNextBest] = useState(null);
  const [approved, setApproved] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const next = await loadConclusionContext(experimentIdParam);
      setCtx(next);
      if (next.experiment?.id) {
        const ms = await loadMeasurements().catch(() => ({}));
        setMeasurement(ms[next.experiment.id] || null);
        // Which decision dimensions this experiment actually tested, and what we
        // already knew about each before it.
        const all = dimensionsFromActivity({
          experiments: [next.experiment, ...(next.completedExperiments || [])],
          measurements: ms,
          reflections: next.reflections || [],
        });
        setDimensions(dimensionsForExperiment({ experiment: next.experiment, dimensions: all }));
      }
      setReflection(next.existing || null);
    } catch (err) {
      console.error('[reflection] load failed:', err?.message || err);
      setLoadError("We couldn't load your experiment just now.");
      setCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentIdParam]);

  /* Opening the reflection is its own stage: a student can reach this screen and
     never finish it, and that is exactly the distinction records cannot make. */
  useEffect(() => {
    const expId = ctx?.experiment?.id;
    if (!expId) return;
    import('@/lib/analytics/decision-funnel-events')
      .then(m => m.reflectionStarted({ experimentId: expId, pathId: ctx?.path?.id }))
      .catch(() => {});
  }, [ctx?.experiment?.id, ctx?.path?.id]);

  useEffect(() => {
    setCtx(null);
    setReflection(null);
    setDecision(null);
    setClosedCycle(null);
    setMeasurement(null);
    setChanges(null);
    setApproved(null);
    setNextBest(null);
    load();
  }, [experimentIdParam, load]);

  // The next best test, so the synthesis can name it rather than invent one.
  useEffect(() => {
    if (!reflection) return;
    let live = true;
    loadNextBestExperiment()
      .then(({ recommendation }) => { if (live) setNextBest(recommendation || null); })
      .catch(() => { if (live) setNextBest(null); });
    return () => { live = false; };
  }, [reflection?.id]);

  const synthesis = useMemo(() => {
    if (!changes || !ctx) return null;
    const forPath = changes.find(c => c.path?.id === ctx.path?.id) || changes[0] || null;
    return buildSynthesis({ change: forPath, dimensions, nextBest });
  }, [changes, ctx, dimensions, nextBest]);

  if (loadError) {
    return (
      <Shell>
        <section className="rounded-[var(--r-surface)] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{loadError}</p>
          <button onClick={load} className="ui-press tp-body mt-4 inline-flex items-center gap-2 rounded-[var(--r-control)] px-5 font-bold text-white"
            style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
            <RotateCcw size={15} /> Try again
          </button>
        </section>
      </Shell>
    );
  }

  if (!ctx) {
    return (
      <Shell>
        <Sk h={132} r={20} />
        <Sk h={368} r={20} />
        <div className="flex justify-center pt-1"><Sk h={12} w={286} r={4} /></div>
      </Shell>
    );
  }

  if (ctx.forbidden) {
    return (
      <Shell>
        <Notice
          title="That experiment isn't yours"
          body="Open the one you're testing from My Journey."
          to="/journey"
          cta="Back to My Journey"
        />
      </Shell>
    );
  }

  if (!ctx.experiment) return <Shell><JourneyEmptyState variant="experiment" /></Shell>;

  const availability = conclusionAvailability(ctx);

  const handleEndEarly = async (reason) => {
    await endExperimentEarly(ctx.experiment, reason);
    await load();
  };

  const handleSubmit = (answers, dims) => saveConclusion(ctx, answers, dims);

  const handleSaved = (saved) => {
    setReflection(saved);
    clearConclusionDraft(ctx.user?.id, ctx.experiment.id);
    setCtx(c => ({ ...c, existing: saved }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDecided = (choice, result) => {
    setDecision(choice);
    setClosedCycle(result?.closed || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Shell>
      <PageHeader showBack backLabel="Go back" title="Update your hypothesis" />
      <ReflectionContextCard ctx={ctx} measurement={measurement} />
      {/* Anything a person actually doing this work told the student, carried in
          so the reflection is against everything they know, not half of it. */}
      <HumanEvidenceContext pathId={ctx.path?.id} cycleId={ctx.experiment?.cycle_id} />

      {decision ? (
        <>
          {decision === 'eliminate_hypothesis' && (
            <section className="rounded-[var(--r-surface)] p-5 sm:p-6" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
              <p className="tp-card" style={{ color: 'var(--text-primary)' }}>Recorded as tested and set aside</p>
              <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{ELIMINATION_NOTE}</p>
            </section>
          )}
          {/* First thing to act on after the decision, ahead of the history.
              Pinned to the hypothesis this experiment tested. */}
          <NextBestExperimentPanel pathId={ctx.path?.id} />
          <HypothesisTimeline pathId={ctx.path?.id} pathName={ctx.path?.path_name} refreshKey={decision} />
          {/* The path as it now stands, across every test run on it, so a student
              finishing their second or third test can see it accumulating. */}
          <PathHistoryPanel pathId={ctx.path?.id} />
          <CycleSummary
            ctx={ctx}
            reflection={reflection}
            decision={decisionMeta(decision)?.cycle_decision}
            closedCycle={closedCycle}
          />
        </>
      ) : !availability.ready ? (
        <ConclusionGate availability={availability} experiment={ctx.experiment} onEndEarly={handleEndEarly} />
      ) : !measurement?.post_completed_at ? (
        <ReflectionStep index={1} total={TOTAL_STEPS} title="How it actually went"
          purpose="A short check-in against what you predicted.">
          <MeasurementGate phase="post" exp={ctx.experiment} measurement={measurement} autoOpen onSaved={setMeasurement} />
        </ReflectionStep>
      ) : reflection ? (
        <>
          {/* The recalculation runs once per saved reflection and hands its
              before/after to the synthesis below. */}
          <ReflectionStep index={3} total={TOTAL_STEPS} title="What the evidence changed"
            purpose="What got stronger, what got weaker, what is still unsettled."
            done={!!approved}>
            <div className="space-y-5">
              <EvidenceUpdatePanel reflection={reflection} experiment={ctx.experiment} onResults={setChanges} />

              {!approved ? (
                changes && (
                  synthesis
                    ? <HypothesisSynthesisPanel synthesis={synthesis} onConfirm={setApproved} />
                    : <div className="rounded-[var(--r-control)] p-5" style={{ background: 'var(--background-secondary)' }}>
                      <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>No hypothesis is attached to this experiment</p>
                      <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
                        Your reflection is saved as evidence. Choose what happens next below.
                      </p>
                    </div>
                )
              ) : (
                <HypothesisTimeline pathId={ctx.path?.id} pathName={ctx.path?.path_name} />
              )}
            </div>
          </ReflectionStep>

          {/* Alongside the hypothesis update, never in front of it: this rates
              the experiment, and skipping it must not strand the cycle. */}
          <ReflectionStep index={3} total={TOTAL_STEPS} title="Rate the quality of this experience" delay={40}
            purpose="How realistic and useful the experience was. This changes none of your scores.">
            <FeedbackSurveyPanel experiment={ctx.experiment} />
          </ReflectionStep>

          {(approved || (changes && !synthesis)) && (
            <ReflectionStep index={4} total={TOTAL_STEPS} title="Decide what comes next" delay={80}
              purpose="Keep testing, change what you are claiming, or set it aside.">
              <HypothesisDecision
                ctx={ctx}
                reflection={reflection}
                synthesis={approved}
                dimensions={dimensions}
                onDecided={handleDecided}
              />
            </ReflectionStep>
          )}

          <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
            Reflection saved.{' '}
            <button onClick={() => { setReflection(null); setApproved(null); }} className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
              Edit my answers
            </button>
          </p>
        </>
      ) : (
        <ReflectionStep index={2} total={TOTAL_STEPS} title="What you learned"
          purpose="In your own words: what you did, what surprised you.">
          <ReflectionForm
            ctx={ctx}
            measurement={measurement}
            dimensions={dimensions}
            onSaved={handleSaved}
            onSubmit={handleSubmit}
          />
        </ReflectionStep>
      )}

      <p className="touch-reach-line tp-meta justify-center pt-1 text-center" style={{ color: 'var(--text-muted)' }}>
        <Link to="/journey" className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>My Journey</Link>
        {' · '}
        <Link to={`/experiment?experimentId=${ctx.experiment.id}`} className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          The experiment
        </Link>
        {' · '}
        <Link to="/evidence?tab=reflect" className="touch-reach font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Reflection history</Link>
      </p>
    </Shell>
  );
}