/**
 * Reflection as the conclusion of the active experiment.
 *
 * Everything is resolved automatically (user, cycle, path, experiment, completed
 * missions, outreach, proof, baseline clarity) so arriving from My Journey never
 * asks the student to pick an experiment again. Reflection, decision and cycle
 * summary happen in this one place.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, RotateCcw } from 'lucide-react';
import {
  loadConclusionContext, conclusionAvailability, endExperimentEarly,
  saveConclusion, clearDraft,
} from '@/lib/experiment-conclusion';
import ReflectionContextCard from '@/components/reflection/ReflectionContextCard';
import ConclusionGate from '@/components/reflection/ConclusionGate';
import ReflectionForm from '@/components/reflection/ReflectionForm';
import DecisionStep from '@/components/reflection/DecisionStep';
import CycleSummary from '@/components/reflection/CycleSummary';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import { Sk } from '@/components/PageSkeleton';

function Shell({ children }) {
  return <main className="app-page"><div className="space-y-5">{children}</div></main>;
}

function Notice({ title, body, to, cta }) {
  return (
    <section className="rounded-[20px] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-body flex items-center gap-2 font-bold" style={{ color: 'var(--text-primary)' }}>
        <AlertCircle size={15} style={{ color: 'var(--brand-navy-700)' }} /> {title}
      </p>
      <p className="tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      <Link to={to} className="ui-press tp-body mt-4 inline-flex items-center rounded-[10px] px-5 py-3 font-bold text-white"
        style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
        {cta}
      </Link>
    </section>
  );
}

export default function ExperimentReflection() {
  // Read from the router, not window.location: navigating to another experiment
  // while already on this page changes only the query string, and a page that
  // read the URL once on mount would keep showing the previous experiment.
  const { search } = useLocation();
  const experimentIdParam = new URLSearchParams(search).get('experimentId') || '';
  const [ctx, setCtx] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reflection, setReflection] = useState(null);
  const [decision, setDecision] = useState(null);
  const [closedCycle, setClosedCycle] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const next = await loadConclusionContext(experimentIdParam);
      setCtx(next);
      // An already-written conclusion means the decision is what is left.
      if (next.existing && !reflection) setReflection(next.existing);
    } catch (err) {
      console.error('[reflection] load failed:', err?.message || err);
      // Never leave the page spinning: say what happened and offer a retry.
      setLoadError("We couldn't load your experiment just now.");
      setCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentIdParam]);

  // A different experiment means a different conclusion: clear the reflection and
  // decision this page was holding, so no stale summary survives the switch.
  useEffect(() => {
    setCtx(null);
    setReflection(null);
    setDecision(null);
    setClosedCycle(null);
    load();
  }, [experimentIdParam, load]);

  if (loadError) {
    return (
      <Shell>
        <section className="rounded-[20px] bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{loadError}</p>
          <button onClick={load} className="ui-press tp-body mt-4 inline-flex items-center gap-2 rounded-[10px] px-5 font-bold text-white"
            style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
            <RotateCcw size={15} /> Try again
          </button>
        </section>
      </Shell>
    );
  }

  if (!ctx) {
    // The context card, then the form or gate that follows it, then the
    // footer links, at the sizes they actually occupy. Two arbitrary grey
    // blocks used to stand here and neither matched what replaced it.
    return (
      <Shell>
        <Sk h={132} r={20} />
        <Sk h={368} r={20} />
        <div className="flex justify-center pt-1">
          <Sk h={12} w={286} r={4} />
        </div>
      </Shell>
    );
  }

  if (ctx.forbidden) {
    return (
      <Shell>
        <Notice
          title="That experiment isn't yours"
          body="We only load experiments on your own account. Open the one you're testing from My Journey."
          to="/journey"
          cta="Back to My Journey"
        />
      </Shell>
    );
  }

  if (!ctx.experiment) {
    return <Shell><JourneyEmptyState variant="experiment" /></Shell>;
  }

  const availability = conclusionAvailability(ctx);

  const handleEndEarly = async (reason) => {
    await endExperimentEarly(ctx.experiment, reason);
    await load();
  };

  const handleSubmit = (answers) => saveConclusion(ctx, answers);

  const handleSaved = (saved) => {
    setReflection(saved);
    clearDraft(ctx.experiment.id);
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
      <ReflectionContextCard ctx={ctx} />

      {decision ? (
        <CycleSummary ctx={ctx} reflection={reflection} decision={decision} closedCycle={closedCycle} />
      ) : !availability.ready ? (
        <ConclusionGate availability={availability} experiment={ctx.experiment} onEndEarly={handleEndEarly} />
      ) : reflection ? (
        <>
          <DecisionStep ctx={ctx} reflection={reflection} onDecided={handleDecided} />
          <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
            Reflection saved.{' '}
            <button onClick={() => setReflection(null)} className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
              Edit my answers
            </button>
          </p>
        </>
      ) : (
        <ReflectionForm ctx={ctx} onSaved={handleSaved} onSubmit={handleSubmit} />
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