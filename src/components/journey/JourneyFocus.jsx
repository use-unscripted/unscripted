import { useEffect, useState } from 'react';
import HypothesisFocus from '@/components/journey/HypothesisFocus';
import { loadJourneyFocus } from '@/lib/journey-focus';

/**
 * The one thing My Journey says: which path is being tested, and the single next
 * action. What we know, what is unknown, the other paths and the clarity record
 * each live on the stage screen that does that work, so this page is not a menu.
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
    <HypothesisFocus
      focus={focus}
      experiment={experiment}
      action={action}
      effort={effort}
      onAnchorClick={onAnchorClick}
    />
  );
}