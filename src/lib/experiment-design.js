/**
 * Experiment design layer.
 *
 * An Experiment is no longer "an activity related to a career". Every experiment
 * designed here exists to answer ONE unresolved question from a career
 * hypothesis' uncertainty map, through a realistic miniature of the actual work.
 *
 * Nothing in here changes or deletes experiments that already exist. Legacy rows
 * keep working; `backfillLegacyExperiments` only fills in fields that can be
 * determined with confidence and leaves the rest blank rather than guessing.
 */
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText, toTextList } from '@/lib/ai-validation';
import { generateValidated } from '@/lib/ai-generate';
import {
  EXPERIMENT_TYPES, TYPE_BY_ID, normalizeEffort, effortHours,
  smallestUsefulEffort, typeForUncertainty, dimensionsForUncertainty,
  evidenceRequirementFallback,
} from '@/lib/experiment-types';

export const DIFFICULTY_LABELS = {
  introductory: 'Introductory',
  moderate: 'Moderate',
  challenging: 'Challenging',
};

/** One design, coerced into the shape the Experiments record expects. */
function repairDesign(raw, { unknown, path }) {
  const instructions = toTextList(raw?.instructions, { splitLines: true });
  // The kind of test and the effort it takes are constrained vocabularies. A
  // model answer outside them is replaced by the smallest useful test capable of
  // reducing THIS uncertainty, never by a 30-day default.
  const variable = unknown?.variable || '';
  const type = TYPE_BY_ID.has(raw?.experiment_type) ? raw.experiment_type : typeForUncertainty(variable);
  const effort = normalizeEffort(raw?.effort) || smallestUsefulEffort(type);
  const testQuestion = toText(raw?.test_question) || toText(raw?.unresolved_question) || unknown?.question || '';
  const evidenceRequirements = toTextList(raw?.evidence_requirements);
  return {
    title: toText(raw?.title),
    career_name: path.path_name,
    objective: toText(raw?.objective),
    unresolved_question: testQuestion,
    unresolved_question_id: variable,
    // Every experiment names the uncertainty it exists to reduce, and the
    // decision dimensions that uncertainty would move.
    test_question: testQuestion,
    why_this_test_matters: toText(raw?.why_this_test_matters)
      || (unknown?.label ? `${path.path_name} asks for ${String(unknown.label).toLowerCase()} constantly, and we do not yet know how you respond to it.` : ''),
    uncertainty_ids: variable ? [variable] : [],
    uncertainty_label: unknown?.label || '',
    decision_dimension_ids: dimensionsForUncertainty(variable),
    effort,
    evidence_requirements: evidenceRequirements.length
      ? evidenceRequirements
      : [evidenceRequirementFallback({ test_question: testQuestion })],
    work_characteristics_tested: toTextList(raw?.work_characteristics_tested),
    work_characteristic_ids: variable ? [variable] : [],
    realistic_scenario: toText(raw?.realistic_scenario),
    instructions,
    deliverable: toText(raw?.deliverable),
    evaluation_criteria: toTextList(raw?.evaluation_criteria),
    evidence_expected: toText(raw?.evidence_expected),
    // Internal. Never shown to the student in this wording.
    evidence_purpose: `This experiment exists to generate evidence about ${unknown?.label || 'this career\u2019s fit'} on ${path.path_name}.`,
    difficulty_level: DIFFICULTY_LABELS[raw?.difficulty_level] ? raw.difficulty_level : 'moderate',
    estimated_hours: effortHours(effort) || 1,
    experiment_type: type,
    design_source: 'hypothesis_designed',
  };
}

/** A design a student could not act on is a failure, not a thin result. */
function usable(d) {
  return Boolean(d.title && d.realistic_scenario && d.deliverable && d.instructions.length >= 2);
}

function validateDesigns(raw, unknowns, path) {
  const list = Array.isArray(raw?.experiments) ? raw.experiments : [];
  const designs = list
    .map((d, i) => repairDesign(d, { unknown: unknowns[i] || unknowns[0], path }))
    .filter(usable);
  if (designs.length) return { ok: true, data: designs, errors: [], codes: [] };
  return {
    ok: false,
    data: null,
    errors: ['No usable experiment came back. Each item in "experiments" needs a title, a realistic_scenario describing a concrete work situation, at least 2 instructions, and a deliverable.'],
    codes: ['designs_unusable'],
  };
}

/**
 * Design up to 3 experiments for a career hypothesis, each testing one of the
 * highest-value unknowns from its uncertainty map.
 */
/**
 * `focus` is the single unknown the student chose to test. When it is given,
 * all three designs answer that one question in different ways, so the choice
 * they just made is what the experiments are actually about.
 */
export async function designExperiments(path, uncertainty, { focus } = {}) {
  const unknowns = focus
    ? [focus, focus, focus]
    : (uncertainty?.top_unknowns || []).slice(0, 3);
  if (!unknowns.length) return { ok: false, data: null };

  const asked = focus
    ? `${focus.label}. The open question is: ${focus.question}\n\nAll ${unknowns.length} experiments must answer this same question, each through a clearly different kind of work.`
    : unknowns
        .map((u, i) => `${i + 1}. ${u.label}. The open question is: ${u.question}`)
        .join('\n');

  return generateValidated({
    feature: 'experiment_design',
    model: 'gemini_3_1_pro',
    context: { path_id: path.id },
    validate: (raw) => validateDesigns(raw, unknowns, path),
    call: async (correction) => unwrapLLM(await base44.integrations.Core.InvokeLLM({
      model: 'gemini_3_1_pro',
      prompt: `You design career-testing experiments for Unscripted, a platform for ambitious college students.

CAREER BEING TESTED: ${path.path_name}${path.path_category ? ` (${path.path_category})` : ''}
${path.why_it_fits || path.fit_reason || ''}

Design exactly ${unknowns.length} experiments. ${focus ? 'Every experiment must be built to answer the single open question below, and nothing else:' : 'Experiment i must be built to answer unknown i below, and nothing else:'}
${asked}

Rules:
- The experiment exists to reduce ONE uncertainty, not to represent the career. State it in "test_question", and in "why_this_test_matters" say why that unknown decides whether this career is worth more of their life.
- Choose "experiment_type" from this list, picking the kind of test that can actually answer the question (a lifestyle or income unknown is answered by speaking to someone, not by producing a work sample):
${EXPERIMENT_TYPES.map(t => `  ${t.id}: ${t.blurb}`).join('\n')}
- Choose "effort" from exactly these two values: "15-30 minutes" or "30-45 minutes". Every experiment must be completable in ONE SITTING of no more than 45 minutes, and most in 15 to 25 minutes. Scope the scenario, the instructions and the deliverable to fit that. Never design multi-hour, multi-day or multi-week work.
- "evidence_requirements" is 2 to 4 plain items answering: what evidence would help us update our view of this career?
- Where the type is a work sample, decision simulation, research or creation test, the experiment is a miniature version of ACTUAL work in this career, with a concrete scenario containing real details, numbers, constraints and competing pressures the student must reason through. Consulting: diagnose why a business is losing profitability. Product management: prioritize a roadmap when engineering, sales and design each want something different. Venture capital: decide whether a startup earns further diligence. Marketing: position a new product. Investment banking: review a simplified acquisition case. UX research: interpret mock interview feedback.
- NEVER a quiz, a personality test, or generic reading and reflection about the profession.
- The scenario must be self-contained: invent the company, the numbers and the constraints so the student can start immediately.
- Deliverable is something the student writes or builds inside that one short sitting (a recommendation, a memo, a simple model, a plan). Keep it small enough that 25 minutes is genuinely enough.
- Evaluation criteria describe what a good response looks like, in plain language.
- "evidence_expected" states what completing this will reveal about whether this work fits the student.
- Do not use technical language about hypotheses, variables or uncertainty in any student-facing text.

"instructions" must be an array of 4 to 8 plain strings.
"work_characteristics_tested" must be 3 to 5 short plain labels (for example: prioritization, decision making, persuasion).
"difficulty_level" must be one of: introductory, moderate, challenging.
${PLAIN_PROSE_RULES}${correction}`,
      response_json_schema: {
        type: 'object',
        properties: {
          experiments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                objective: { type: 'string' },
                unresolved_question: { type: 'string' },
                test_question: { type: 'string' },
                why_this_test_matters: { type: 'string' },
                experiment_type: { type: 'string' },
                effort: { type: 'string' },
                evidence_requirements: { type: 'array', items: { type: 'string' } },
                realistic_scenario: { type: 'string' },
                instructions: { type: 'array', items: { type: 'string' } },
                deliverable: { type: 'string' },
                evaluation_criteria: { type: 'array', items: { type: 'string' } },
                evidence_expected: { type: 'string' },
                work_characteristics_tested: { type: 'array', items: { type: 'string' } },
                difficulty_level: { type: 'string' },
                estimated_hours: { type: 'number' },
              },
            },
          },
        },
      },
    })),
  });
}

/**
 * Retroactively associate previously created experiments with a career
 * hypothesis. Only writes when the path match is unambiguous, and never invents
 * the characteristics an old experiment tested.
 */
export async function backfillLegacyExperiments(experiments, paths) {
  const stale = experiments.filter(e => !e.design_source && !e.career_hypothesis_id && e.path_name);
  if (!stale.length) return false;
  let wrote = false;
  await Promise.all(stale.map(async (e) => {
    const matches = paths.filter(p => p.path_name === e.path_name);
    const fields = { design_source: 'legacy' };
    if (matches.length === 1) {
      fields.career_hypothesis_id = matches[0].id;
      fields.career_name = matches[0].path_name;
    }
    wrote = true;
    await base44.entities.Experiments.update(e.id, fields).catch(() => null);
  }));
  return wrote;
}