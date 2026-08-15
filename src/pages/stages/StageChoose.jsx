import StageShell from '@/components/stages/StageShell';
import ChoosePath from '@/components/journey/ChoosePath';

/** Choose: commit to the one path you will test first. */
export default function StageChoose() {
  return (
    <StageShell stage="choose">
      <ChoosePath mode="choose" />
    </StageShell>
  );
}