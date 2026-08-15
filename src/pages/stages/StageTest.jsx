import { Link } from 'react-router-dom';
import StageShell from '@/components/stages/StageShell';
import HypothesisFocus from '@/components/journey/HypothesisFocus';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import UnknownsChecklist from '@/components/stages/UnknownsChecklist';
import SimEntryCard from '@/components/worksim/SimEntryCard';
import LibraryTestPicker from '@/components/library/LibraryTestPicker';
import ExperimentScenarios from '@/components/scenarios/ExperimentScenarios';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import useJourneyFocus from '@/hooks/useJourneyFocus';
import { Sk } from '@/components/PageSkeleton';

/** Test: the one test running against the path you chose, and what to test next. */
export default function StageTest() {
  const { journey, focus } = useJourneyFocus();

  if (!journey) return <StageShell stage="test"><Sk h={280} r={16} /></StageShell>;
  if (!journey.currentPath) {
    return (
      <StageShell stage="test">
        <JourneyEmptyState variant="paths" />
      </StageShell>
    );
  }

  /* The button says where the test itself stands, not where the cycle stands:
     started work continues, planned work starts, and with nothing set up yet it
     sets one up. */
  const exp = journey.nextExperiment;
  const action = exp
    ? {
        label: exp.status === 'in_progress' ? 'Continue Test' : 'Start Test',
        to: `/experiment?experimentId=${exp.id}`,
        sub: exp.title,
      }
    : {
        label: 'Set Up My Test',
        to: `/experiments/new?pathName=${encodeURIComponent(journey.currentPath.path_name)}`,
        sub: 'A 30-day test that shows you what this path actually feels like.',
      };

  return (
    <StageShell stage="test">
      <HypothesisFocus
        focus={focus || { name: journey.currentPath.path_name }}
        experiment={exp}
        action={action}
      />
      <UnknownsChecklist progress={focus?.progress} pathId={journey.currentPath.id} />
      {/* No test set up yet: the validated library is the first place to look,
          and it says plainly when this career is not covered. */}
      {!exp && <LibraryTestPicker path={journey.currentPath} />}
      {/* Role-relevant decision scenarios, and a scored question kept apart. */}
      <ExperimentScenarios
        experiment={exp}
        careerName={journey.currentPath.path_name}
        pathId={journey.currentPath.id}
      />
      <NextBestExperimentPanel pathId={journey.currentPath.id} />
      <SimEntryCard />
      <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
        <Link to={`/experiments/compare?pathName=${encodeURIComponent(journey.currentPath.path_name)}`} className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Compare experiments</Link>
        {' · '}
        <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
      </p>
    </StageShell>
  );
}