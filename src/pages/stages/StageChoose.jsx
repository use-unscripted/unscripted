import StageShell from '@/components/stages/StageShell';
import ChoosePath from '@/components/journey/ChoosePath';
import EliminatedPaths from '@/components/journey/EliminatedPaths';
import useJourneyFocus from '@/hooks/useJourneyFocus';

/**
 * Choose: read the paths one at a time, then commit to the one you test first.
 * This is also what Explore used to be — the same three paths and the same
 * button, so asking twice was asking twice.
 */
export default function StageChoose() {
  const { data } = useJourneyFocus();
  return (
    <StageShell stage="choose">
      <ChoosePath />
      <EliminatedPaths eliminated={data?.eliminated} />
    </StageShell>
  );
}