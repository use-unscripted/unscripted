/**
 * Option order.
 *
 * Options are shuffled so the same tendency does not sit in the same position
 * every time — a student who works out that the first option is always the
 * decisive one is answering the layout, not the question. The shuffle is:
 *
 *  - semantic-preserving: options are reordered, never rewritten, and each keeps
 *    its own id and dimension mapping, so a stored answer means exactly what it
 *    meant when it was given;
 *  - stable per student and scenario, from a seed, so going Back and returning
 *    shows the same order rather than reshuffling under them;
 *  - skipped entirely where order carries meaning — a performance question, or
 *    anything marked `order_matters`.
 */

/** Small deterministic string hash. Same seed in, same order out. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PERFORMANCE = ['performance_objective', 'performance_rubric'];

export function shouldRandomize(scenario) {
  if (!scenario) return false;
  if (scenario.order_matters) return false;
  return !PERFORMANCE.includes(scenario.scenario_type);
}

/**
 * The options to show, in the order to show them. Never mutates the scenario:
 * the library is shared module state, so sorting it in place would change the
 * order for everything else on the page.
 */
export function orderedOptions(scenario, seedKey = '') {
  const options = [...(scenario?.options || [])];
  if (!shouldRandomize(scenario) || options.length < 2) return options;

  const seed = `${seedKey}:${scenario.scenario_key || scenario.id || ''}`;
  return options
    .map(o => ({ o, rank: hash(`${seed}:${o.id}`) }))
    .sort((a, b) => a.rank - b.rank)
    .map(x => x.o);
}

export default orderedOptions;