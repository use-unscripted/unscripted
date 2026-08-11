/**
 * Career Moments — the default, short form of an Experiment.
 *
 * The evidence model does not change here. A Career Moment still tests ONE
 * unresolved question from a career hypothesis' uncertainty map, still writes an
 * Experiments row, still writes an ExperimentMeasurement row, and still triggers
 * the same hypothesis recalculation. What changes is the size of the ask: three
 * to five minutes of one realistic decision, not a multi-hour simulation.
 *
 * Long experiments are untouched. They remain in the database and keep working;
 * they are simply no longer the default way to gather evidence.
 */
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText, toTextList } from '@/lib/ai-validation';
import { generateValidated } from '@/lib/ai-generate';
import { deriveHypothesis } from '@/lib/career-hypothesis';
import { loadRecalculationContext, recalculateAfterReflection } from '@/lib/hypothesis-recalculation';
import { savePostMeasurement } from '@/lib/experiment-measurement';
import { cycleLinks } from '@/lib/career-cycle';

/** The whole micro-reaction. Two questions, no more. */
export const REACTIONS = [
  { value: 1, emoji: '😫', label: 'Not for me' },
  { value: 2, emoji: '😐', label: 'Neutral' },
  { value: 3, emoji: '🙂', label: 'Enjoyed it' },
  { value: 4, emoji: '🔥', label: 'Loved it' },
];

export const AGAIN_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'yes', label: 'Yes' },
];

// Reaction and repeat answers are 1–4 and three-way; the measurement row speaks
// in tens, so they are mapped here rather than stored twice.
const ENJOYMENT_SCALE = { 1: 2, 2: 5, 3: 8, 4: 10 };
const AGAIN_SCALE = { no: 2, maybe: 5, yes: 9 };
// A weaker answer is still evidence, never a fail. Nothing below the middle.
const STRENGTH_SCALE = { 3: 9, 2: 6.5, 1: 4.5 };

const KEYS = ['A', 'B', 'C', 'D', 'E'];

function repair(raw, { path, focus }) {
  const options = (Array.isArray(raw?.options) ? raw.options : [])
    .map((o, i) => ({
      key: toText(o?.key) || KEYS[i] || String(i + 1),
      text: toText(o?.text),
      strength: [1, 2, 3].includes(Number(o?.strength)) ? Number(o.strength) : 2,
      feedback: toText(o?.feedback),
    }))
    .filter(o => o.text);
  const best = options.slice().sort((a, b) => b.strength - a.strength)[0];
  const minutes = Number(raw?.estimated_minutes);

  return {
    title: toText(raw?.title) || `Career Moment: ${path.path_name}`,
    hook: toText(raw?.hook),
    information: (Array.isArray(raw?.information) ? raw.information : [])
      .map(r => ({ label: toText(r?.label), value: toText(r?.value) }))
      .filter(r => r.label && r.value)
      .slice(0, 5),
    question: toText(raw?.question),
    options,
    best_option_key: best?.key || '',
    rationale_prompt: toText(raw?.rationale_prompt) || 'Explain your reasoning in one sentence.',
    evidence_dimensions: toTextList(raw?.evidence_dimensions).slice(0, 3),
    work_characteristics_tested: toTextList(raw?.work_characteristics_tested).slice(0, 3),
    estimated_minutes: minutes >= 2 && minutes <= 7 ? minutes : 4,
    career_name: path.path_name,
    path_id: path.id,
    career_hypothesis_id: path.id,
    unresolved_question: focus?.question || '',
    unresolved_question_id: focus?.variable || '',
  };
}

function validate(raw, ctx) {
  const m = repair(raw, ctx);
  const ok = Boolean(m.hook && m.question && m.options.length >= 3
    && m.options.every(o => o.feedback) && m.options.some(o => o.strength === 3));
  if (ok) return { ok: true, data: m, errors: [], codes: [] };
  return {
    ok: false,
    data: null,
    errors: ['Return a hook, a question, and 3 to 4 options. Every option needs its own "feedback" explaining what choosing it shows, and exactly one option must have strength 3.'],
    codes: ['moment_unusable'],
  };
}

/**
 * One short, realistic decision built to answer the chosen open question.
 * A single model call: the per-option feedback comes back with the moment, so
 * feedback after answering is instant rather than another wait.
 */
export async function generateCareerMoment(path, focus) {
  return generateValidated({
    feature: 'career_moment',
    model: 'gemini_3_1_pro',
    context: { path_id: path.id },
    validate: (raw) => validate(raw, { path, focus }),
    call: async (correction) => unwrapLLM(await base44.integrations.Core.InvokeLLM({
      model: 'gemini_3_1_pro',
      prompt: `You write Career Moments for Unscripted: three to five minute samples of real professional work for ambitious college students.

CAREER BEING TESTED: ${path.path_name}${path.path_category ? ` (${path.path_category})` : ''}
THE OPEN QUESTION THIS MUST ANSWER: ${focus?.question || `Does this student enjoy the core work of ${path.path_name}?`}
THE CHARACTERISTIC BEING TESTED: ${focus?.label || 'core judgement in this work'}

Do NOT simulate an entire job. Sample the one moment that reveals whether this work fits.

Write:
1. "hook" — two or three sentences dropping the student into a realistic situation in this career, in the first person present. No preamble, no explanation of the exercise.
2. "information" — 2 to 4 short rows of the minimum facts needed to decide (label plus a short value, for example "2025 EBITDA" / "$6M"). Never a spreadsheet.
3. "question" — the single decision they must make now.
4. "options" — 3 or 4 realistic choices a practitioner might actually consider. Give each one "strength": 3 for the strongest professional answer (exactly one option), 2 for defensible but weaker, 1 for a common beginner instinct. Each option needs "feedback": one or two sentences saying what choosing it shows about how this student reasons. Never call an answer wrong or a failure; a weaker answer is described as evidence about how they currently approach this kind of problem.
5. "rationale_prompt" — a one-sentence ask for their reasoning.
6. "evidence_dimensions" — 2 or 3 short plain labels this moment provides evidence about (for example: prioritization, financial reasoning, ambiguity tolerance).
7. "work_characteristics_tested" — 1 to 3 short labels, closely related to each other. Do not try to test every characteristic of the career at once.
8. "estimated_minutes" — between 2 and 7, normally 3 to 5.

The whole thing must be answerable in a few minutes with no research, no spreadsheet and no essay.
Do not use the words hypothesis, variable, uncertainty or experiment in any student-facing text.
${PLAIN_PROSE_RULES}${correction}`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          hook: { type: 'string' },
          information: {
            type: 'array',
            items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } },
          },
          question: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                text: { type: 'string' },
                strength: { type: 'number' },
                feedback: { type: 'string' },
              },
            },
          },
          rationale_prompt: { type: 'string' },
          evidence_dimensions: { type: 'array', items: { type: 'string' } },
          work_characteristics_tested: { type: 'array', items: { type: 'string' } },
          estimated_minutes: { type: 'number' },
        },
      },
    })),
  });
}

/**
 * The career and the one open question a moment should answer. Reuses the same
 * context the recalculation and Next Best Experiment engines read, so a moment
 * is always pointed at a genuinely unresolved question.
 */
export async function loadMomentTarget({ recId, variable } = {}) {
  const ctx = await loadRecalculationContext();
  const live = ctx.paths.filter(p => p.status !== 'archived' && p.hypothesis_status !== 'archived');
  const path = live.find(p => p.id === recId)
    || live.find(p => p.is_primary_focus)
    || live[0]
    || null;
  if (!path) return { path: null, focus: null };

  const h = deriveHypothesis(path, ctx);
  const variables = h.uncertainty?.variables || [];
  const unknownIds = new Set((h.uncertainty?.top_unknowns || []).map(v => v.variable));
  const focus = variables.find(v => v.variable === variable)
    || variables.find(v => unknownIds.has(v.variable))
    || variables[0]
    || null;
  return { path, focus };
}

/** Store the generated moment so the answer has something to attach to. */
export async function saveCareerMoment(moment) {
  const user = await base44.auth.me().catch(() => null);
  return base44.entities.CareerMoment.create({ ...moment, user_id: user?.id, status: 'ready' });
}

/** What the chosen option demonstrated, in the same words the student just read. */
export function feedbackFor(moment, optionKey) {
  const option = (moment.options || []).find(o => o.key === optionKey);
  return {
    option,
    strongest: option?.strength === 3,
    text: option?.feedback || 'This response gives us more evidence about how you currently approach this kind of problem.',
    dimensions: moment.evidence_dimensions || [],
  };
}

/**
 * Completion. Writes the Experiments row this moment becomes, its measurement,
 * and then runs the existing recalculation so the Career Evidence Profile,
 * ability/enjoyment split and uncertainty map all move exactly as they do after
 * a long experiment.
 */
export async function completeCareerMoment({ momentRow, selected, rationale, reaction, again }) {
  const option = (momentRow.options || []).find(o => o.key === selected);
  const links = await cycleLinks({ path: { id: momentRow.path_id } }).catch(() => ({}));

  const experiment = await base44.entities.Experiments.create({
    ...links,
    title: momentRow.title,
    objective: momentRow.question,
    path_id: momentRow.path_id,
    path_name: momentRow.career_name,
    career_name: momentRow.career_name,
    career_hypothesis_id: momentRow.career_hypothesis_id,
    path_recommendation_id: momentRow.career_hypothesis_id,
    unresolved_question: momentRow.unresolved_question,
    unresolved_question_id: momentRow.unresolved_question_id,
    work_characteristics_tested: momentRow.work_characteristics_tested || [],
    work_characteristic_ids: momentRow.unresolved_question_id ? [momentRow.unresolved_question_id] : [],
    realistic_scenario: momentRow.hook,
    experiment_type: 'Career Moment',
    design_source: 'hypothesis_designed',
    difficulty_level: 'introductory',
    estimated_hours: Math.round(((momentRow.estimated_minutes || 4) / 60) * 100) / 100,
    deliverable: 'A decision and a one-sentence rationale',
    status: 'completed',
  });

  const score = STRENGTH_SCALE[option?.strength] ?? 6;
  const measurement = await savePostMeasurement(experiment, null, {
    actual_enjoyment: ENJOYMENT_SCALE[reaction] ?? null,
    actual_energy: ENJOYMENT_SCALE[reaction] ?? null,
    desire_to_repeat: AGAIN_SCALE[again] ?? null,
    surprise_reflection: rationale || undefined,
  });

  await base44.entities.ExperimentMeasurement.update(measurement.id, {
    system_performance_score: score,
    reasoning_quality: score,
    system_evaluation_summary: option?.feedback || undefined,
    demonstrated_strengths: momentRow.evidence_dimensions || [],
    system_evaluated_at: new Date().toISOString(),
  }).catch(() => null);

  await base44.entities.CareerMoment.update(momentRow.id, {
    selected_option: selected,
    rationale_text: rationale || undefined,
    enjoyment_reaction: reaction,
    want_again: again,
    system_performance_score: score,
    experiment_id: experiment.id,
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).catch(() => null);

  // Same evidence architecture as a long experiment: nothing here is a shortcut
  // around the recalculation.
  const changes = await recalculateAfterReflection({ reflection: null, experiment }).catch(() => []);
  return { experiment, measurement, changes };
}