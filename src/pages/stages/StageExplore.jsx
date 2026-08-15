import { useNavigate } from 'react-router-dom';
import StageShell from '@/components/stages/StageShell';
import ChoosePath from '@/components/journey/ChoosePath';
import EliminatedPaths from '@/components/journey/EliminatedPaths';
import useJourneyFocus from '@/hooks/useJourneyFocus';

/**
 * Explore: the paths on the table, compared, and the ones already ruled out.
 * Nothing is committed here — picking one hands you to Choose.
 */
export default function StageExplore() {
  const navigate = useNavigate();
  const { data } = useJourneyFocus();

  return (
    <StageShell stage="explore">
      <ChoosePath mode="compare" onCompareSelect={() => navigate('/choose')} />
      <EliminatedPaths eliminated={data?.eliminated} />
    </StageShell>
  );
}