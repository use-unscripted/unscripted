import { Link } from 'react-router-dom';
import StageShell from '@/components/stages/StageShell';
import KnownAndUnknown from '@/components/journey/KnownAndUnknown';
import CareerClarity from '@/components/journey/CareerClarity';
import OtherHypotheses from '@/components/journey/OtherHypotheses';
import WhatWeAreLearning from '@/components/journey/WhatWeAreLearning';
import useJourneyFocus from '@/hooks/useJourneyFocus';

/**
 * Decide: what the evidence now says, and whether this path is worth continuing.
 * The decision itself is recorded in the reflection, which this links to.
 */
export default function StageDecide() {
  const { data, focus } = useJourneyFocus();

  return (
    <StageShell stage="decide">
      <KnownAndUnknown focus={focus} />
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