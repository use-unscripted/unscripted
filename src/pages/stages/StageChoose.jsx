import { useEffect, useState } from 'react';
import StageShell from '@/components/stages/StageShell';
import ChoosePath from '@/components/journey/ChoosePath';
import EliminatedPaths from '@/components/journey/EliminatedPaths';
import AllPathsLink from '@/components/journey/AllPathsLink';
import QuickScenarioPrompt from '@/components/scenarios/QuickScenarioPrompt';
import useJourneyFocus from '@/hooks/useJourneyFocus';
import { loadOwnedPaths } from '@/lib/path-set';

/**
 * Choose: read the paths one at a time, then commit to the one you test first.
 * This is also what Explore used to be — the same three paths and the same
 * button, so asking twice was asking twice.
 */
export default function StageChoose() {
  const { data, journey } = useJourneyFocus();
  /* The way out of the three recommended paths and into every path this student
     could test. It used to sit on My Journey, which is not where the choosing
     happens. */
  const [pathCount, setPathCount] = useState(0);
  useEffect(() => {
    let alive = true;
    loadOwnedPaths()
      .then(owned => { if (alive) setPathCount((owned?.paths || []).length); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <StageShell stage="choose">
      <ChoosePath />
      {/* Two minutes against something genuinely untested. It can refine the
          next experiment we suggest; it cannot rule a path out. */}
      <QuickScenarioPrompt path={journey?.currentPath} />
      <AllPathsLink count={pathCount} />
      <EliminatedPaths eliminated={data?.eliminated} />
    </StageShell>
  );
}