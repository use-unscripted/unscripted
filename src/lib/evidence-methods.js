/**
 * How a student can test a Conviction Gap: six methods, weakest evidence first.
 *
 * This is a MAPPING TABLE, not a third taxonomy. Each method points at the
 * evidence tiers that already exist in scenarios/evidence-hierarchy.js and the
 * experiment types that already exist in experiment-types.js, so nothing else in
 * the product has to guess how a method relates to either. No stored weight is
 * changed here and nothing new is scored.
 *
 * The ladder is the point: a student should be able to see the whole climb, so a
 * method that is not available for a gap yet is shown with a reason rather than
 * hidden.
 */
import { TIER_BY_ID } from '@/lib/scenarios/evidence-hierarchy';
import { TYPE_BY_ID } from '@/lib/experiment-types';

export const EVIDENCE_METHODS = [
  {
    id: 'stated',
    label: 'Stated',
    asks: 'What you already believe, or have told us about yourself.',
    /* First tier is the one this method reads at; a second is the ceiling it can
       reach when the work is also reviewed. */
    tiers: ['self_report'],
    experimentTypes: [],
    route: null,
    /* Reporting copy only: how heavily this evidence counts, in words. No weight
       or threshold anywhere in the product reads this. */
    weightNote: 'This is the lightest kind of evidence, because nothing was tested.',
  },
  {
    id: 'exposure',
    label: 'Exposure',
    asks: 'Read, watch, or put yourself around the work and notice your reaction.',
    tiers: ['single_scenario'],
    experimentTypes: ['environment_test', 'research_test'],
    route: 'moment',
    weightNote: 'It counts for more than what you already believed, and for less than doing the work or speaking to somebody in it.',
  },
  {
    id: 'simulated',
    label: 'Simulated',
    asks: 'Make the decisions or do the tasks in an in-app simulation.',
    tiers: ['scenario_pattern'],
    experimentTypes: ['decision_simulation', 'workstyle_test'],
    route: 'moment',
    weightNote: 'It counts for more than reading about the work, and for less than doing a real piece of it or speaking to somebody in it.',
  },
  {
    id: 'human',
    label: 'Human',
    asks: 'Have a conversation with somebody doing this work now.',
    tiers: ['experiment'],
    experimentTypes: ['human_reality'],
    route: 'human',
    weightNote: 'It counts heavily, because it came from somebody living this work rather than from a simulation.',
  },
  {
    id: 'applied',
    label: 'Applied',
    asks: 'Do a real piece of the work yourself and hand something over.',
    tiers: ['experiment', 'reviewed'],
    experimentTypes: ['work_sample', 'creation_test'],
    route: 'experiment',
    weightNote: 'It counts heavily, because you did a real piece of the work and produced something.',
  },
  {
    id: 'lived',
    label: 'Lived',
    asks: 'Sustained real exposure: an internship or an ongoing project.',
    tiers: ['repeated_behaviour', 'reviewed'],
    experimentTypes: ['combined'],
    route: 'experiment',
    weightNote: 'This is the heaviest kind of evidence, because it came from sustained real exposure.',
  },
];

export const METHOD_BY_ID = new Map(EVIDENCE_METHODS.map(m => [m.id, m]));

/** The one thing to say about the ladder. No number on how much. */
export const LADDER_NOTE =
  'Higher-value evidence moves the decision about this path more than lower-value evidence.';

export const tiersForMethod = (id) => (METHOD_BY_ID.get(id)?.tiers || []).map(t => TIER_BY_ID.get(t)).filter(Boolean);
export const typesForMethod = (id) => (METHOD_BY_ID.get(id)?.experimentTypes || []).map(t => TYPE_BY_ID.get(t)).filter(Boolean);

/** Which method a recommendation is already offering, so the ladder can preselect it. */
export function methodForRecommendation(recommendation) {
  if (!recommendation) return 'simulated';
  if (recommendation.human_reality) return 'human';
  return recommendation.depth === 'deep_dive' ? 'applied' : 'simulated';
}

/**
 * Whether a method can be offered for this gap yet, and if not, why.
 * Honest rather than encouraging: a method we cannot actually run is greyed.
 */
export function methodAvailability(methodId, { recommendation = null } = {}) {
  const humanOnly = Boolean(recommendation?.human_reality);
  switch (methodId) {
    case 'stated':
      return { available: false, reason: 'Already recorded from what you told us.' };
    case 'lived':
      return { available: false, reason: 'Internships and ongoing projects are not run inside the app yet.' };
    case 'exposure':
    case 'simulated':
    case 'applied':
      return humanOnly
        ? { available: false, reason: 'This question cannot honestly be simulated, so it needs a conversation.' }
        : { available: true, reason: null };
    case 'human':
      return { available: true, reason: null };
    default:
      return { available: false, reason: 'Not available for this gap yet.' };
  }
}

/** Where a method starts, on the existing flows. */
export function methodStartUrl(methodId, { pathId, variable }) {
  /* The method travels with the link so the flow it opens is designed at the
     level the student chose, not at the engine's default. */
  const q = `recId=${pathId || ''}&variable=${encodeURIComponent(variable || '')}&method=${methodId}`;
  switch (METHOD_BY_ID.get(methodId)?.route) {
    case 'moment': return `/moment?${q}`;
    case 'human': return `/human-reality?${q}`;
    case 'experiment': return `/experiments/new?${q}`;
    default: return null;
  }
}

export default EVIDENCE_METHODS;