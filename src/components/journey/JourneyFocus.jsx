import { useEffect, useState } from 'react';
import HypothesisFocus from '@/components/journey/HypothesisFocus';
import KnownAndUnknown from '@/components/journey/KnownAndUnknown';
import OtherHypotheses from '@/components/journey/OtherHypotheses';
import CareerClarity from '@/components/journey/CareerClarity';
import EliminatedPaths from '@/components/journey/EliminatedPaths';
import { loadJourneyFocus } from '@/lib/journey-focus';

/**
 * The five questions this dashboard has to answer, in order: what are we
 * testing, what have we learned, what is still unknown, what should I do next,
 * and how has my thinking changed.
 *
 * The focus panel renders immediately from what the journey resolver already
 * knows, so the one instruction never waits on the evidence read behind it. The
 * sections below appear as their evidence arrives, and stay absent when there is
 * none rather than showing an empty frame.
 */
export default function JourneyFocus({ currentPath, experiment, action, effort, onAnchorClick }) {
  const [focusData, setFocusData] = useState(null);

  useEffect(() => {
    let alive = true;
    loadJourneyFocus({ currentPathName: currentPath?.path_name })
      .then(d => { if (alive) setFocusData(d); })
      .catch(() => { if (alive) setFocusData({ focus: null, others: [], eliminated: [], clarity: null }); });
    return () => { alive = false; };
  }, [currentPath?.path_name]);

  const focus = focusData?.focus || (currentPath ? { name: currentPath.path_name } : null);

  return (
    <>
      <HypothesisFocus
        focus={focus}
        experiment={experiment}
        action={action}
        effort={effort}
        onAnchorClick={onAnchorClick}
      />
      <KnownAndUnknown focus={focusData?.focus} />
      <OtherHypotheses others={focusData?.others} />
      <CareerClarity clarity={focusData?.clarity} />
      <EliminatedPaths eliminated={focusData?.eliminated} />
    </>
  );
}