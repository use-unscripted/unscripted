import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ActiveExperimentsPanel from '@/components/experiments/ActiveExperimentsPanel';
import { loadExperimentProgress } from '@/lib/active-experiments';
import StageShell from '@/components/stages/StageShell';
import StageSection from '@/components/stages/StageSection';
import HypothesisFocus from '@/components/journey/HypothesisFocus';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import SimEntryCard from '@/components/worksim/SimEntryCard';
import LibraryTestPicker from '@/components/library/LibraryTestPicker';
import ExperimentScenarios from '@/components/scenarios/ExperimentScenarios';
import { scenariosForCareer, performanceForCareer } from '@/lib/scenarios/scenario-library';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import UnsupportedPathNotice from '@/components/paths/UnsupportedPathNotice';
import usePathSupport from '@/hooks/usePathSupport';
import useJourneyFocus from '@/hooks/useJourneyFocus';
import { Sk } from '@/components/PageSkeleton';

/** Test: the one test running against the path you chose, and what to test next. */
export default function StageTest() {
  const { journey, focus } = useJourneyFocus();
  const { support, index, loading: supportLoading } = usePathSupport(journey?.currentPath?.path_name);
  /* One shared reading of where every experiment stands, scoped to the path the
     cycle says is being tested — the same scope My Journey uses, so the headline
     test here is the one My Journey names rather than a test on another path. */
  const pathName = journey?.currentPath?.path_name;
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    if (!pathName) return;
    let live = true;
    setProgress(null);
    loadExperimentProgress({ pathName })
      .then(p => { if (live) setProgress(p); })
      .catch(() => { if (live) setProgress(null); });
    return () => { live = false; };
  }, [pathName]);

  if (!journey) return <StageShell stage="test"><Sk h={280} r={16} /></StageShell>;
  if (!journey.currentPath) {
    return (
      <StageShell stage="test">
        <JourneyEmptyState variant="paths" />
      </StageShell>
    );
  }

  /* The experiment to act on comes from the shared reading when it is loaded:
     unfinished work first, otherwise the one that owes a reflection. */
  const currentRow = progress?.current || null;
  const exp = currentRow?.experiment || journey.nextExperiment;
  /* The Supported Path Gate. A direction the library cannot carry a cycle on does
     not enter the normal Test flow: no new test is offered, no strength or
     learning value is shown, and work already in progress on it is untouched. */
  const gated = Boolean(support && !support.testable);

  if (supportLoading) {
    return <StageShell stage="test"><Sk h={280} r={16} /></StageShell>;
  }

  if (gated) {
    return (
      <StageShell stage="test">
        <UnsupportedPathNotice path={journey.currentPath} support={support} index={index} />
        {/* Work already started on this direction stays available and finishable. */}
        {exp && (
          <HypothesisFocus
            focus={focus || { name: journey.currentPath.path_name }}
            experiment={exp}
            action={{
              label: exp.status === 'in_progress' ? 'Continue Test' : 'Open Test',
              to: `/experiment?experimentId=${exp.id}`,
              sub: exp.title,
            }}
          />
        )}
      </StageShell>
    );
  }

  /* The button says where the test itself stands, not where the cycle stands:
     started work continues, planned work starts, and with nothing set up yet it
     sets one up. */
  const action = exp
    ? currentRow?.awaitingReflection
      ? {
          label: 'Reflect On This Test',
          to: `/reflect?experimentId=${exp.id}`,
          sub: `${exp.title}. The reflection is still open.`,
        }
      : {
          label: exp.status === 'in_progress' ? 'Continue Test' : 'Start Test',
          to: `/experiment?experimentId=${exp.id}`,
          sub: exp.title,
        }
    : {
        label: 'Set Up My Test',
        to: `/experiments/new?pathName=${encodeURIComponent(journey.currentPath.path_name)}`,
        sub: 'A 30-day test of what this path feels like.',
      };

  /* Nothing to fold away when this career has no scenarios in the library. */
  const careerName = journey.currentPath.path_name;
  const hasScenarios = scenariosForCareer(careerName, { limit: 2 }).length > 0
    || Boolean(performanceForCareer(careerName));

  return (
    <StageShell stage="test">
      <HypothesisFocus
        focus={focus || { name: journey.currentPath.path_name }}
        experiment={exp}
        action={action}
      />
      {/* Second from the top, directly under the path being tested: what to test
          next is the decision this screen exists to support. */}
      <NextBestExperimentPanel pathId={journey.currentPath.id} />
      {/* Everything below is optional, so it arrives folded: the instruction at
          the top and the recommended next test stay on screen instead of being
          pushed off by four full panels. */}
      {/* The rest of the open work on this path, with the current test marked. */}
      {(progress?.active || []).length > 0 && (
        <StageSection
          title="Your other open tests"
          hint="Where each one stands, and which is closest to finished."
          meta={`${progress.active.length}`}
        >
          <ActiveExperimentsPanel rows={progress.active} currentId={currentRow?.id} />
        </StageSection>
      )}
      {/* No test set up yet: the validated library is the first place to look,
          and it says plainly when this career is not covered. Open by default,
          because with nothing running this IS the work. */}
      {!exp && (
        <StageSection
          title="Other ways to test this path"
          hint="Validated tests for this career, or design your own."
          defaultOpen
        >
          <LibraryTestPicker path={journey.currentPath} />
        </StageSection>
      )}
      {/* Role-relevant decision scenarios, and a scored question kept apart. */}
      {hasScenarios && (
      <StageSection
        title="Answer a few short scenarios"
        hint="A couple of minutes. Adds workstyle evidence without running a test."
      >
        <ExperimentScenarios
          experiment={exp}
          careerName={journey.currentPath.path_name}
          pathId={journey.currentPath.id}
        />
      </StageSection>
      )}
      <StageSection
        title="Spend 30 minutes inside one job"
        hint="A work simulation you can run in a single sitting."
      >
        <SimEntryCard />
      </StageSection>
      <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
        <Link to={`/conviction-lab?pathId=${journey.currentPath.id}`} className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Conviction Lab</Link>
        {' · '}
        <Link to={`/experiments/compare?pathName=${encodeURIComponent(journey.currentPath.path_name)}`} className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Compare experiments</Link>
        {' · '}
        <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
      </p>
    </StageShell>
  );
}