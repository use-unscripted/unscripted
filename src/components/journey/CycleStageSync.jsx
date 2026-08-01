import { useEffect } from 'react';
import { syncCycleStage } from '@/lib/career-cycle';

/**
 * Keeps the active CareerCycle's current_stage in step with the stage shown on
 * My Journey. Renders nothing, and a failure here never blocks the page.
 */
export default function CycleStageSync({ stage }) {
  useEffect(() => {
    if (!stage) return;
    syncCycleStage(stage).catch(() => {});
  }, [stage]);
  return null;
}