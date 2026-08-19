/**
 * Lightweight contradiction detection across evidence a student already produced.
 *
 * Five sources, and the only thing this file does is notice where two of them
 * disagree:
 *   what they SAID (intake preferences)
 *   what they CHOSE (decision scenarios)
 *   what they DID (completed experiments and their readings)
 *   how they PERFORMED (self-rated against reviewed work)
 *   how they FELT afterward (enjoyment, energy, desire to repeat)
 *
 * Deliberate limits, because a contradiction is a question and not a finding:
 *  - Nothing here is proof. Every item is phrased as something open, and the
 *    consumer labels the whole set "Something worth testing".
 *  - Nothing here touches Path Confidence. Confidence is earned and reduced in
 *    evidence-contradictions.js, which already caps how far conflicting readings
 *    can pull it down; a single tension from a single test must not move it.
 *  - No records are written, and no reading is overturned or thrown away.
 */
import { scenarioContradictions } from '@/lib/scenarios/scenario-contradictions';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const HIGH = 7;
const LOW = 4;
const GAP = 3;

/**
 * @param {object} args
 * @param {object} args.path the path row
 * @param {object} args.context loadStudentContext() result
 * @param {Array}  args.scenarioResponses ScenarioResponse rows
 * @param {Array}  args.dimensions CareerDimensionEvidence rows
 * @returns {Array} [{ id, source, title, detail, open_question, variable, observations }]
 */
export function buildTensions({ path, context, scenarioResponses = [], dimensions = [] }) {
  const out = [];
  const experiments = (context?.experiments || []).filter(e => e.path_name === path?.path_name);

  experiments.forEach(exp => {
    const m = context?.measurements?.[exp.id];
    if (!m?.post_completed_at) return;

    const enjoyment = num(m.actual_enjoyment);
    const repeat = num(m.desire_to_repeat);
    const selfPerf = num(m.self_rated_performance);
    const systemPerf = num(m.system_performance_score);
    const energy = num(m.actual_energy);
    const where = exp.title ? ` on ${exp.title}` : '';

    // Felt good, does not want it again — or the reverse.
    if (enjoyment !== null && repeat !== null && Math.abs(enjoyment - repeat) >= GAP) {
      const enjoyedMore = enjoyment > repeat;
      out.push({
        id: `${exp.id}:enjoy_repeat`,
        source: 'How you felt afterward',
        title: enjoyedMore
          ? 'You enjoyed the work but do not want to repeat it'
          : 'You want to repeat work you did not especially enjoy',
        detail: enjoyedMore
          ? `You rated your enjoyment high${where} and your desire to do it again much lower.`
          : `You rated your enjoyment low${where} and your desire to do it again much higher.`,
        open_question: 'We do not know yet whether that was the task, the day, or the kind of work itself.',
        observations: 1,
      });
    }

    // Capable and unmoved, or drawn to work that did not go well.
    if (selfPerf !== null && enjoyment !== null) {
      if (selfPerf >= HIGH && enjoyment <= LOW) {
        out.push({
          id: `${exp.id}:able_not_drawn`,
          source: 'How you performed against how you felt',
          title: 'You did this well without enjoying it',
          detail: `You rated your own performance high${where} while rating the experience low.`,
          open_question: 'Being good at something and wanting to do it daily are separate questions, and only one of them has a reading.',
          observations: 1,
        });
      } else if (selfPerf <= LOW && enjoyment >= HIGH) {
        out.push({
          id: `${exp.id}:drawn_not_able`,
          source: 'How you performed against how you felt',
          title: 'You enjoyed work you felt you did poorly',
          detail: `You rated the experience high${where} while rating your own performance low.`,
          open_question: 'Whether that is a skill still forming or a genuine mismatch is untested.',
          observations: 1,
        });
      }
    }

    // What you thought of your work against what the review said.
    if (selfPerf !== null && systemPerf !== null && Math.abs(selfPerf - systemPerf) >= GAP) {
      out.push({
        id: `${exp.id}:self_vs_reviewed`,
        source: 'How you rated yourself against the review',
        title: selfPerf > systemPerf
          ? 'You rated your work higher than the review did'
          : 'You rated your work lower than the review did',
        detail: `Your own rating and the reviewed reading of the same piece of work${where} were some distance apart.`,
        open_question: 'Neither reading settles this on its own. A second reviewed piece of work would show which is closer.',
        observations: 1,
      });
    }

    // Enjoyed it and it flattened them.
    if (enjoyment !== null && energy !== null && enjoyment >= HIGH && energy <= LOW) {
      out.push({
        id: `${exp.id}:enjoy_drain`,
        source: 'How you felt afterward',
        title: 'You enjoyed the work and it drained you',
        detail: `Enjoyment was high${where} while the energy it left you with was low.`,
        open_question: 'Whether that holds over a longer stretch of this work is untested.',
        observations: 1,
      });
    }

    // What you expected against what happened.
    const expected = num(m.expected_enjoyment);
    if (expected !== null && enjoyment !== null && m.pre_completed_at && Math.abs(expected - enjoyment) >= GAP) {
      out.push({
        id: `${exp.id}:expected_vs_actual`,
        source: 'What you expected against what happened',
        title: expected > enjoyment
          ? 'You expected to enjoy this more than you did'
          : 'You enjoyed this more than you expected to',
        detail: `Your before and after readings${where} were some distance apart.`,
        open_question: 'This is evidence about your expectations. Whether the work itself reads the same way a second time is unknown.',
        observations: 1,
      });
    }
  });

  /* What they said and what they chose, from the existing detector. It already
     refuses to fire on a single scenario answer and already defers to real work,
     so it is used as-is rather than re-derived. */
  scenarioContradictions({ profile: context?.profile || {}, responses: scenarioResponses, dimensions })
    .forEach((c, i) => out.push({
      id: `scenario:${c.dimension || i}`,
      source: c.behaviour_leads ? 'What you chose against what you did' : 'What you said against what you chose',
      title: c.title,
      detail: c.detail,
      open_question: c.resolution,
      variable: c.dimension || null,
      observations: 2,
    }));

  return out;
}

export default buildTensions;