import { useEffect, useState } from 'react';
import { loadJourneyEvidence } from '@/lib/journey-evidence';
import CareersWorthTesting from '@/components/journey/CareersWorthTesting';
import FitChanges from '@/components/journey/FitChanges';
import EvidenceSnapshotCard from '@/components/journey/EvidenceSnapshotCard';
import EvidenceThisWeek from '@/components/journey/EvidenceThisWeek';
import CrossCareerInsight from '@/components/journey/CrossCareerInsight';
import EvidenceMilestones from '@/components/journey/EvidenceMilestones';
import { Sk } from '@/components/PageSkeleton';

/**
 * The evidence half of My Journey: the current career hypotheses, what moved
 * since last time, and the way into the Career Evidence Profile.
 *
 * It loads on its own so the one instruction and the recommended next test are
 * never waiting on it, and it renders nothing at all for a student who has not
 * produced any evidence yet.
 */
export default function JourneyEvidence() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;
    loadJourneyEvidence()
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setData({ hypotheses: [], changes: [], counts: {} }); });
    return () => { live = false; };
  }, []);

  if (!data) {
    return (
      <div className="space-y-4">
        <Sk h={180} r={16} />
        <Sk h={150} r={16} />
      </div>
    );
  }

  /* Each card below reveals itself, and that placement is deliberate rather
     than tidy. Wrapping the six from out here would put a Reveal around a card
     that renders nothing — every one of them returns null when it has no
     evidence to show — and the page would space out an empty box. It would
     also swallow the section rhythm, since app-stack only spaces its own
     direct children, and hand the observer one block taller than the viewport
     to decide about. */
  return (
    <>
      <CareersWorthTesting hypotheses={data.hypotheses} />
      <EvidenceThisWeek week={data.week} />
      <CrossCareerInsight pattern={data.crossCareer} />
      <FitChanges changes={data.changes} />
      <EvidenceMilestones milestones={data.milestones} />
      <EvidenceSnapshotCard counts={data.counts} />
    </>
  );
}