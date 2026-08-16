import { Link } from 'react-router-dom';
import StageShell from '@/components/stages/StageShell';
import KnownAndUnknown from '@/components/journey/KnownAndUnknown';
import CareerClarity from '@/components/journey/CareerClarity';
import OtherHypotheses from '@/components/journey/OtherHypotheses';
import WhatWeAreLearning from '@/components/journey/WhatWeAreLearning';
import PathHistoryPanel from '@/components/paths/PathHistoryPanel';
import useJourneyFocus from '@/hooks/useJourneyFocus';

/**
 * Decide: what the evidence now says, and whether this path is worth continuing.
 * The decision itself is recorded in the reflection, which this links to.
 */
export default function StageDecide() {
  const { data, focus, journey } = useJourneyFocus();

  return (
    <StageShell stage="decide">
      <KnownAndUnknown focus={focus} />
      {/* The same path, test by test. This is what makes a second and third test
          on one path feel like progress rather than repetition. */}
      <PathHistoryPanel pathId={journey?.currentPath?.id} />
      <CareerClarity clarity={data?.clarity} />
      <WhatWeAreLearning />
      <OtherHypotheses others={data?.others} />
      <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
        Ready to record the decision?{' '}
        <Link to="/reflect" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Conclude this test</Link>
      </p>
    </StageShell>
  );
}