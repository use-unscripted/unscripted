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
import JourneyStages, { buildStageDetail } from '@/components/journey/JourneyStages';
import JourneyNow from '@/components/journey/JourneyNow';
import PathComparisonWorkspace from '@/components/journey/PathComparisonWorkspace';
import PathSelectedConfirm from '@/components/journey/PathSelectedConfirm';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import JourneyEvidence from '@/components/journey/JourneyEvidence';
import CampusEventsPanel from '@/components/campus/CampusEventsPanel';
import ContinuationGate from '@/components/journey/ContinuationGate';
import { Sk } from '@/components/PageSkeleton';
import PullToRefresh from '@/components/PullToRefresh';
import { Reveal, WordReveal, EASE_COPY } from '@/components/motion';
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
    // Same wrapper, same header, same card rhythm as the loaded page below —
    // the title is real because it never changes, so only the parts that
    // depend on data are standing in for anything.
    return (
      <main className="app-page">
        <header className="mb-14">
          <h1 className="tp-page" style={{ color: 'var(--text-primary)' }}>
            My Journey
          </h1>
          <div className="mt-5 flex h-8 items-center">
            <Sk h={14} r={5} w="72%" style={{ maxWidth: 460 }} />
          </div>
        </header>
        <div className="app-stack">
          <Sk h={280} r={16} />
          <div className="space-y-4">
            {[0, 1, 2, 3, 4, 5].map(i => <Sk key={i} h={30} r={8} w={i % 2 ? '58%' : '74%'} />)}
          </div>
        </div>
      </main>
    );
  }

  const { stage, currentPath, nextExperiment, counts, action, livePaths } = resolveJourney(data);
  const set = authoritativeSet(data.paths);
  const comparisonPaths = set?.paths || livePaths;
  const scrollToDecision = () =>
    document.getElementById('decision')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const stageDetail = buildStageDetail({
    counts,
    currentPath,
    nextExperiment,
    experimentsDone: counts.experimentsDone,
  });

  /* The page header is the landing fold's opening move, at the app's scale:
     headline out of a clip mask, standfirst fading up behind it. Both degrade
     to plain text under reduced motion. */
  const shell = (children, sub) => (
    <main className="app-page">
      <header className="mb-14">
        <h1 className="tp-page" style={{ color: 'var(--text-primary)' }}>
          <WordReveal text="My Journey" delay={0.05} />
        </h1>
        <Reveal delay={380} y={14} ease={EASE_COPY}>
          <p className="tp-lead mt-5" style={{ color: 'var(--text-secondary)', maxWidth: '52ch' }}>{sub}</p>
        </Reveal>
      </header>
      {/* Pull down from the top to re-read the journey, the way a native app
          does. Touch only, so nothing about the desktop page changes. */}
      <PullToRefresh onRefresh={load}>
        <div className="app-stack">{children}</div>
      </PullToRefresh>
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
        <ContinuationGate />
        <JourneyStages stage={stage} detail={stageDetail} />
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
        <PathComparisonWorkspace
          paths={comparisonPaths}
          onSelect={handleSelect}
          busyId={busyId}
          error={selectError}
          onRetry={() => setSelectError(null)}
        />
        <JourneyStages stage={stage} detail={stageDetail} />
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

      <JourneyNow
        stage={stage}
        path={currentPath}
        experiment={nextExperiment}
        action={action}
        effort={effort}
        onAnchorClick={scrollToDecision}
      />

      {/* Every section below the fold arrives on scroll, the way the marketing
          page's do. One signal, once, and nothing moves again after it lands. */}

      {/* What to test next, decided by which unresolved question would teach us
          the most — not by which path currently ranks highest. It sits directly
          under the one instruction because for most students it IS the next
          action, and burying it inside the Experiments page would make it a
          feature rather than the way the loop continues. */}
      <NextBestExperimentPanel />

      {/* Then the evidence: which careers currently look worth testing, what
          moved since last time, and what we are still learning. It sits under
          the next action on purpose — the loop is what to do next first, the
          record of what has been learned second. Each card inside reveals
          itself; see the note in that file for why it is not wrapped here. */}
      <JourneyEvidence />

      {/* The "no experiment yet" case is not listed here: the panel above is
          already showing that exact call to action, and two buttons pointing at
          the same route is what made this page read as a menu. */}
      {experimentDone && counts.proof === 0 && <JourneyEmptyState variant="experiment_done" />}
      {data.cycle?.legacy_review && <JourneyEmptyState variant="legacy" />}

      {/* The only dated thing on this page, and the reason it sits directly
          under the instruction rather than at the bottom: everything else here
          describes a state — a stage, a count, a status — and none of it says
          "Thursday". The top of the page is what to do; the spine below is the
          record. It stays silent for a student with no college set or a
          calendar we cannot read, so it costs nothing when it has nothing. */}
      {/* Already reveals itself, and stays silent for a student with no college
          set, so it must not be wrapped from out here. */}
      <CampusEventsPanel />

      <Reveal y={20}>
        <JourneyStages stage={stage} detail={stageDetail} />
      </Reveal>

      <p className="tp-meta pt-2 text-center" style={{ color: 'var(--text-muted)' }}>
        Working on something else? <Link to="/paths" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Compare all paths</Link>
        {' · '}
        <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
        {' · '}
        <Link to="/calendar" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Your week</Link>
        {' · '}
        <Link to="/campus" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Campus events</Link>
      </p>
    </>,
    currentPath
      ? `You're currently testing ${currentPath.path_name}. Nothing here is settled until the evidence says so.`
      : 'One direction at a time. This page tells you what comes next.'
  );
}