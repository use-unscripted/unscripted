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

  /* My Journey's one button always opens the Test stage. Naming the stage-
     specific work here ("Submit Evidence") told the student what to do without
     telling them where they were in the cycle; the stage screen carries that. */
  const journeyAction = { label: 'Go to My Test', to: '/test', sub: action?.sub };

  return (
    <HypothesisFocus
      focus={focus}
      experiment={experiment}
      action={journeyAction}
      effort={effort}
      onAnchorClick={onAnchorClick}
    />
  );
}