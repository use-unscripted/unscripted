/**
 * Contradictions worth a real experiment.
 *
 * Two kinds, and neither is ever resolved here:
 *  1. what the student TOLD us, against what their scenario answers lean toward;
 *  2. scenario answers that point both ways on the same dimension.
 *
 * A contradiction is only surfaced when it is still open. Once real work has
 * settled that dimension the disagreement has an answer, and repeating it would
 * be arguing with evidence the student already produced. Nothing here decides
 * which side is right: the output is a question and a way to test it.
 */
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import { DIMENSION_BY_ID } from '@/lib/career-dimensions';

/**
 * Stated preferences that have an opposite worth testing. `term` is matched
 * against what the student wrote in the intake; `opposing` is the dimension whose
 * scenario answers would contradict it.
 */
const STATED_OPPOSITES = [
  { term: 'independent', stated: 'independent_work', opposing: 'teamwork', said: 'you prefer independent work', leaned: 'collaborative approaches' },
  { term: 'alone', stated: 'independent_work', opposing: 'teamwork', said: 'you prefer working on your own', leaned: 'collaborative approaches' },
  { term: 'team', stated: 'teamwork', opposing: 'independent_work', said: 'you prefer working with other people', leaned: 'working through things alone' },
  { term: 'collaborat', stated: 'teamwork', opposing: 'independent_work', said: 'you prefer collaborative work', leaned: 'working through things alone' },
  { term: 'structure', stated: 'structured_environments', opposing: 'ambiguity_tolerance', said: 'you prefer a clear structure', leaned: 'open-ended situations' },
  { term: 'clear direction', stated: 'structured_environments', opposing: 'ambiguity_tolerance', said: 'you prefer clear direction', leaned: 'open-ended situations' },
  { term: 'variety', stated: 'ambiguity_tolerance', opposing: 'structured_environments', said: 'you prefer open-ended work', leaned: 'defined process' },
  { term: 'detail', stated: 'detail_orientation', opposing: 'high_pressure_pace', said: 'you value getting details right', leaned: 'moving quickly' },
  { term: 'fast', stated: 'high_pressure_pace', opposing: 'detail_orientation', said: 'you like working at pace', leaned: 'slowing down for precision' },
];

const SETTLED = ['moderate', 'strong'];

function statedTerms(profile = {}) {
  const parts = [
    ...(profile.self_reported_energizers || []),
    ...(profile.work_setting_preference ? [profile.work_setting_preference] : []),
  ];
  return parts.map(p => String(p).toLowerCase());
}

/**
 * @returns [{ dimension, title, detail, resolution }] — dimension is what the
 *          Next Best Experiment engine should be pointed at.
 */
export function scenarioContradictions({ profile = {}, responses = [], dimensions = [] } = {}) {
  const scenarios = new Map(scenarioEvidence(responses).map(s => [s.dimension, s]));
  const levelOf = (id) => dimensions.find(d => d.dimension === id)?.current_evidence_level || 'unknown';
  const out = [];
  const seen = new Set();

  // 1. Stated preference against a run of scenario answers the other way.
  const terms = statedTerms(profile);
  STATED_OPPOSITES.forEach(rule => {
    if (seen.has(rule.stated)) return;
    if (!terms.some(t => t.includes(rule.term))) return;
    // Real work has already answered this, so there is nothing open to test.
    if (SETTLED.includes(levelOf(rule.stated)) || SETTLED.includes(levelOf(rule.opposing))) return;

    const against = scenarios.get(rule.opposing);
    // One answer is not a pattern, so it never contradicts what they told us.
    if (!against || against.response_count < 2 || against.direction !== 'draws_toward') return;

    seen.add(rule.stated);
    out.push({
      dimension: rule.stated,
      title: `You said ${rule.said}`,
      detail: `Several recent decision scenarios leaned toward ${rule.leaned}.`,
      resolution: 'We do not know which better reflects your actual preference yet.',
    });
  });

  // 2. Scenario answers against what the student actually did. Behaviour is not
  //    overturned here: the point is that the student can see the disagreement and
  //    settle it with another real experiment rather than with another opinion.
  scenarios.forEach(s => {
    if (seen.has(s.dimension)) return;
    const behaviour = dimensions.find(d => d.dimension === s.dimension);
    if (!behaviour || behaviour.direction === 'none' || !behaviour.direction) return;
    if (s.direction === 'unclear' || s.direction === behaviour.direction) return;
    if (s.response_count < 2) return;
    seen.add(s.dimension);
    const dim = DIMENSION_BY_ID.get(s.dimension);
    out.push({
      dimension: s.dimension,
      title: `Your scenario answers and your real work disagree about ${dim.noun}`,
      detail: behaviour.direction === 'draws_toward'
        ? `Real experiments suggested you are drawn to ${dim.noun}, while several scenario answers leaned away from it.`
        : `Real experiments suggested ${dim.noun} drains you, while several scenario answers leaned toward it.`,
      resolution: 'Your real experiments carry more weight, and one more real reading would settle this.',
      behaviour_leads: true,
    });
  });

  // 3. Scenario answers disagreeing with each other.
  scenarios.forEach(s => {
    if (seen.has(s.dimension) || s.scenario_level !== 'conflicting') return;
    if (SETTLED.includes(levelOf(s.dimension))) return;
    seen.add(s.dimension);
    const dim = DIMENSION_BY_ID.get(s.dimension);
    out.push({
      dimension: s.dimension,
      title: `Your answers about ${dim.noun} point both ways`,
      detail: `Across ${s.scenarios_answered} scenario${s.scenarios_answered === 1 ? '' : 's'} you have leaned in both directions.`,
      resolution: 'We do not know which better reflects your actual preference yet.',
    });
  });

  return out;
}

export default scenarioContradictions;