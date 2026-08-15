/**
 * The cycle, as navigation.
 *
 * Six stages, one screen each, and each screen carries only that stage's work.
 * This file is the single source of truth for which route does which stage, so
 * the sidebar rail, the stage stepper and the journey spine can never disagree.
 */
import { STAGES, STAGE_INDEX } from '@/lib/journey';

export const STAGE_ROUTE = {
  choose: '/choose',
  test: '/test',
  prove: '/prove',
  reflect: '/reflect',
  decide: '/decide',
};

export function stageMeta(key) {
  return STAGES.find(s => s.key === key) || null;
}

/** The stage before and after this one, for the stepper at the foot of a stage. */
export function stageNeighbours(key) {
  const i = STAGE_INDEX[key] ?? 0;
  return {
    prev: STAGES[i - 1] || null,
    next: STAGES[i + 1] || null,
  };
}