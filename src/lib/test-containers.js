/**
 * The five containers a test on a Conviction Gap can run in.
 *
 * A container is NOT a new kind of record and NOT a new taxonomy. It is how an
 * existing experiment is presented to the student and what it asks for at the
 * end. Each one points at:
 *
 *   - `method`: a rung on the evidence ladder in evidence-methods.js, which is
 *     what actually decides the route and the recommendation, so selecting a
 *     container is the same single piece of state as selecting a method
 *   - `experimentTypes`: existing ids from experiment-types.js, never new ones
 *   - `submits`: which existing submission flow ends it — the proof of work
 *     flow, the human reality flow, or the simulation's own result
 *
 * Order is weakest evidence first, matching the ladder.
 */
import { METHOD_BY_ID, methodAvailability } from '@/lib/evidence-methods';
import { TYPE_BY_ID } from '@/lib/experiment-types';

export const TEST_CONTAINERS = [
  {
    id: 'shadowing',
    label: 'Shadow somebody',
    method: 'exposure',
    experimentTypes: ['environment_test', 'research_test'],
    blurb: 'Sit in on the work, or spend time around it, and watch your own reaction.',
    submits: 'proof',
    submitAsks: 'Ends by submitting your notes on what you saw.',
  },
  {
    id: 'lab_simulation',
    label: 'Conviction Lab simulation',
    method: 'simulated',
    experimentTypes: ['decision_simulation', 'workstyle_test'],
    blurb: 'Make the decisions and do the tasks inside the app.',
    submits: 'simulation',
    submitAsks: 'Ends by submitting its own result automatically.',
  },
  {
    id: 'conversation',
    label: 'Professional conversation',
    method: 'human',
    experimentTypes: ['human_reality'],
    blurb: 'Speak with somebody doing this work now.',
    submits: 'human',
    submitAsks: 'Ends by submitting your notes and who you spoke with.',
  },
  {
    id: 'project',
    label: 'A project you produce',
    method: 'applied',
    experimentTypes: ['work_sample', 'creation_test'],
    blurb: 'Do a real piece of the work and hand something over.',
    submits: 'proof',
    submitAsks: 'Ends by submitting the thing you produced.',
  },
  {
    id: 'internship',
    label: 'Internship',
    method: 'lived',
    experimentTypes: ['combined'],
    blurb: 'Sustained real exposure over weeks rather than one sitting.',
    submits: 'proof',
    submitAsks: 'Ends by submitting the work you did there.',
  },
];

export const CONTAINER_BY_ID = new Map(TEST_CONTAINERS.map(c => [c.id, c]));
export const CONTAINER_BY_METHOD = new Map(TEST_CONTAINERS.map(c => [c.method, c]));

export const containerForMethod = (methodId) => CONTAINER_BY_METHOD.get(methodId) || null;
export const typesForContainer = (id) =>
  (CONTAINER_BY_ID.get(id)?.experimentTypes || []).map(t => TYPE_BY_ID.get(t)).filter(Boolean);

/**
 * Which containers this gap can actually be tested in. Availability is the
 * ladder's own answer for the container's method, so there is one rule about
 * what can be run, not two.
 */
export function containersForGap({ recommendation = null } = {}) {
  return TEST_CONTAINERS.map(c => ({
    ...c,
    ...methodAvailability(c.method, { recommendation }),
    methodLabel: METHOD_BY_ID.get(c.method)?.label || null,
  }));
}

/** What the student has to submit for a container to count as tested. */
export const submitAsk = (methodId) => containerForMethod(methodId)?.submitAsks || null;

export default TEST_CONTAINERS;