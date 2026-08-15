import { Link } from 'react-router-dom';
import StageShell from '@/components/stages/StageShell';
import HypothesisFocus from '@/components/journey/HypothesisFocus';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import SimEntryCard from '@/components/worksim/SimEntryCard';
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

  return (
    <StageShell stage="test">
      <HypothesisFocus
        focus={focus || { name: journey.currentPath.path_name }}
        experiment={journey.nextExperiment}
        action={journey.action}
      />
      <NextBestExperimentPanel pathId={journey.currentPath.id} />
      <SimEntryCard />
      <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
        <Link to="/experiments" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>All experiments</Link>
      </p>
    </StageShell>
  );
}