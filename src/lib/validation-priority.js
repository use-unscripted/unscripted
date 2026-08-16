/**
 * Staff-side loader for the validation priority queue and Path coverage.
 *
 * The ranking reads across every student's experiments, paths and events, so it
 * is computed server-side and the browser only ever receives counts. Nothing
 * here writes; the one write available on this data is the strategic-importance
 * flag, which is a staff decision and is stored on the validation record.
 */
import { base44 } from '@/api/base44Client';

export async function loadValidationPriority(include = null) {
  const res = await base44.functions.invoke('validationPriority', include ? { include } : {});
  return res?.data || null;
}

/** The staff lever behind the "strategic importance" factor. */
export function setStrategicPriority(validationId, { strategic_priority, priority_note }) {
  return base44.entities.ExperimentValidation.update(validationId, {
    strategic_priority: Boolean(strategic_priority),
    ...(priority_note === undefined ? {} : { priority_note: priority_note || null }),
  });
}

export const LEVEL_LABEL = {
  0: 'Early Draft',
  1: 'Source Grounded',
  2: 'Professionally Reviewed',
  3: 'Multi-Professional Validated',
  4: 'Field Calibrated',
};

export default loadValidationPriority;