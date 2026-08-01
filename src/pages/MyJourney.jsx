/**
 * My Journey — one screen for the first half of the workflow:
 * Onboarding → Compare Three Paths → Choose One Path → Begin One Experiment,
 * and then the running state of that cycle.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { resolveJourney } from '@/lib/journey';
import { loadOwnedPaths, authoritativeSet, loadOnboardingSubmission } from '@/lib/path-set';
import { getActiveCycle } from '@/lib/career-cycle';
import { selectPathAndBeginExperiment } from '@/lib/path-selection';
import CycleStageSync from '@/components/journey/CycleStageSync';
import JourneyStages from '@/components/journey/JourneyStages';
import JourneyStatusHeader from '@/components/journey/JourneyStatusHeader';
import ContinueCard from '@/components/journey/ContinueCard';
import JourneySnapshot from '@/components/journey/JourneySnapshot';
import PathComparisonWorkspace from '@/components/journey/PathComparisonWorkspace';
import PathSelectedConfirm from '@/components/journey/PathSelectedConfirm';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import ContinuationGate from '@/components/journey/ContinuationGate';
import { loadPilotAccess, CycleLimitError } from '@/lib/pilot-access';
import { trackPilotEvent } from '@/lib/pilot-metrics';

function effortLabel(experiment, missions) {
  if (!experiment) return null;
  const open = missions.filter(
    m => m.experiment_id === experiment.id && m.deletion_status !== 'deleted' && !['completed', 'skipped'].includes(m.status)
  ).length;
  const parts = [];
  if (open) parts.push(`${open} mission${open === 1 ? '' : 's'} left`);
  if (experiment.estimated_hours) parts.push(`~${experiment.estimated_hours}h`);
  return parts.length ? parts.join(' · ') : null;
}

export default function MyJourney() {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selectError, setSelectError] = useState(null);
  const [confirmed, setConfirmed] = useState(null);

  const load = useCallback(async () => {
    const [access, owned, profile, cycle, exps, missions, prf, refs] = await Promise.all([
      loadPilotAccess().catch(() => null),
      loadOwnedPaths().catch(() => ({ paths: [] })),
      loadOnboardingSubmission().catch(() => null),
      getActiveCycle().catch(() => null),
      base44.entities.Experiments.list('-created_date', 100).catch(() => []),
      base44.entities.Missions.list('-created_date', 200).catch(() => []),
      base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []),
      base44.entities.WeeklyReflections.list('-created_date', 50).catch(() => []),
    ]);
    setData({
      access,
      paths: owned?.paths || [],
      profile,
      cycle,
      experiments: Array.isArray(exps) ? exps : [],
      missions: Array.isArray(missions) ? missions : [],
      proof: Array.isArray(prf) ? prf : [],
      reflections: Array.isArray(refs) ? refs : [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = useCallback(async (path) => {
    setSelectError(null);
    setBusyId(path.id);
    try {
      const result = await selectPathAndBeginExperiment(path, data?.paths || []);
      setConfirmed({ pathName: path.path_name, experiment: result.experiment });
      await load();
    } catch (err) {
      if (err instanceof CycleLimitError) {
        // Independent beta, one cycle used: show the continuation step instead.
        await load();
        return;
      }
      // Stage only — never the student's answers.
      console.error('[journey] path selection failed at stage: begin_experiment', err?.message);
      setSelectError(path.id);
    } finally {
      setBusyId(null);
    }
  }, [data, load]);

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton mt-4 h-48 w-full" />
      </main>
    );
  }

  const { stage, currentPath, nextExperiment, counts, action, livePaths } = resolveJourney(data);
  const set = authoritativeSet(data.paths);
  const comparisonPaths = set?.paths || livePaths;
  const scrollToDecision = () =>
    document.getElementById('decision')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const shell = (children, sub) => (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          My Journey
        </h1>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
      </header>
      <div className="space-y-5">{children}</div>
    </main>
  );

  // 1 — onboarding not completed
  if (!data.profile && data.paths.length === 0) {
    trackPilotEvent('onboarding_started', { dedupe_key: data.access?.user?.id || 'anon' });
    return shell(<JourneyEmptyState variant="onboarding" />, 'Four steps: answer a few questions, compare three paths, choose one, run one experiment.');
  }
  trackPilotEvent('onboarding_completed', { dedupe_key: data.access?.user?.id || 'anon' });

  // Independent beta includes one full cycle. Once it is used, choosing another
  // path is replaced by the continuation-interest step — no credits, no prices,
  // no payment.
  if (!currentPath && !confirmed && data.access && !data.access.canStartNewCycle) {
    trackPilotEvent('second_cycle_attempted', {
      value: data.access.cyclesCompleted + 1,
      dedupe_key: `${data.access.user?.id}:${data.access.cyclesCompleted + 1}`,
    });
    return shell(
      <>
        <JourneyStages stage={stage} />
        <ContinuationGate />
      </>,
      'Your first cycle is complete. Everything you produced stays in your Evidence Library.'
    );
  }

  // 2 — paths not generated
  if (data.paths.length === 0) {
    return shell(<JourneyEmptyState variant="paths" />, 'Your answers are saved. Next: your three paths.');
  }

  // 3 — no path selected yet → the comparison workspace, right here
  if (!currentPath && !confirmed) {
    return shell(
      <>
        <JourneyStages stage={stage} />
        <PathComparisonWorkspace
          paths={comparisonPaths}
          onSelect={handleSelect}
          busyId={busyId}
          error={selectError}
          onRetry={() => setSelectError(null)}
        />
      </>,
      'Compare your three paths below, then choose the one you will test first.'
    );
  }

  const experimentDone = nextExperiment == null && counts.experimentsDone > 0;
  const effort = effortLabel(nextExperiment, data.missions);

  return shell(
    <>
      <CycleStageSync stage={stage} />

      {confirmed && (
        <PathSelectedConfirm
          pathName={confirmed.pathName}
          experiment={confirmed.experiment}
          onDismiss={() => setConfirmed(null)}
        />
      )}

      <JourneyStatusHeader
        stage={stage}
        path={currentPath}
        experiment={nextExperiment}
        action={action}
        effort={effort}
      />

      <ContinueCard action={action} pathName={currentPath?.path_name} onAnchorClick={scrollToDecision} />

      <JourneyStages stage={stage} />

      {!nextExperiment && !experimentDone && <JourneyEmptyState variant="experiment" ctaTo={action.to} />}
      {experimentDone && counts.proof === 0 && <JourneyEmptyState variant="experiment_done" />}
      {data.cycle?.legacy_review && <JourneyEmptyState variant="legacy" />}

      <JourneySnapshot counts={counts} />

      <p className="pt-2 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        Working on something else? <Link to="/paths" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Compare all paths</Link>
        {' · '}
        <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All missions</Link>
        {' · '}
        <Link to="/calendar" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Your week</Link>
      </p>
    </>,
    currentPath
      ? `You're currently testing ${currentPath.path_name}.`
      : 'One direction at a time. This page tells you what comes next.'
  );
}