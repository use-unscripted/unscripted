import StageShell from '@/components/stages/StageShell';
import KnownAndUnknown from '@/components/journey/KnownAndUnknown';
import CareerClarity from '@/components/journey/CareerClarity';
import OtherHypotheses from '@/components/journey/OtherHypotheses';
import WhatWeAreLearning from '@/components/journey/WhatWeAreLearning';
import PathHistoryPanel from '@/components/paths/PathHistoryPanel';
import DecideReadiness from '@/components/stages/DecideReadiness';
import useJourneyFocus from '@/hooks/useJourneyFocus';

/**
 * Decide: what the evidence now says, and whether this path is worth continuing.
 * The decision itself is recorded in the reflection, which this links to.
 */
export default function StageDecide() {
  const { data, focus, journey } = useJourneyFocus();

  return (
    <StageShell stage="decide">
      {/* The decision opens once every key dimension has at least one reading. */}
      <DecideReadiness progress={focus?.progress} pathId={journey?.currentPath?.id} />
      <KnownAndUnknown focus={focus} />
      {/* The same path, test by test. This is what makes a second and third test
          on one path feel like progress rather than repetition. */}
      <PathHistoryPanel pathId={journey?.currentPath?.id} />
      <CareerClarity clarity={data?.clarity} />
      <WhatWeAreLearning />
      <OtherHypotheses others={data?.others} />
    </StageShell>
  );
}