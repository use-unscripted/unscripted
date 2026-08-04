/**
 * Validator for the path-generation model response.
 *
 * This is the gate between `InvokeLLM` and the four entities a generation
 * writes. Nothing reaches the database that has not been through here.
 *
 * ## Why a validator and not just normalisation
 *
 * The generator used to repair whatever came back and save it regardless. That
 * is right for cosmetic drift and wrong for structural drift, and the two need
 * different answers:
 *
 *   - Repairable (warning): a missing time estimate, an unknown confidence
 *     level, a mission step returned as a bare string. The student's outcome is
 *     unchanged by filling these in, so fill them in and save.
 *
 *   - Structural (error): two recommendations instead of three, a
 *     recommendation with no name, a readiness score of 74. These break the
 *     product — the compare screen is built on three paths, and every
 *     experiment/mission/proof linkage in the app is a `path_name` string match
 *     against PathRecommendations, so an unnamed or duplicated path silently
 *     detaches everything downstream from it. Saving a repaired version of one
 *     of these hands the student a broken account that looks finished.
 *
 * Errors are what the caller feeds back to the model for one guided retry, so
 * they are written as instructions to the model, not as user-facing copy.
 *
 * ## Two error channels, on purpose
 *
 * `errors` are prose and can quote model output (a duplicated path name, for
 * instance) — they go back to the model, which produced that text in the first
 * place. `codes` are stable slugs that never contain generated content, and are
 * the only thing safe to write to a log or an analytics event. A generated path
 * name is derived from a student's own profile answers; it does not belong in
 * console output.
 */

import { isPlainObject, describeShape, toBoundedNumber, LEVELS } from '@/lib/ai-validation';

/** Readiness is a 0-10 scale. Stated in the prompt, bounded in both schemas. */
export const READINESS_MIN = 0;
export const READINESS_MAX = 10;

export { LEVELS };

const REQUIRED_REC_COUNT = 3;

/** The prompt asks for 8 to 12 hours per experiment. This is the outer bound. */
const MAX_EXPERIMENT_HOURS = 60;

/** How many experiments the prompt asks for. Fewer is a warning, not a failure. */
const EXPECTED_EXPERIMENT_COUNT = 3;

const DEFAULT_STEP_MINUTES = 30;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

/** Accept a number or a numeric string; reject anything else, including NaN. */
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}


// ---- Request schema -------------------------------------------------------
//
// The schema the model is asked for lives next to the validator that checks
// what comes back, so the two cannot drift apart unnoticed. A test asserts
// they declare exactly the same fields.

export const str = { type: 'string' };
const strArr = { type: 'array', items: { type: 'string' } };

export const missionStepSchema = {
  type: 'object',
  properties: {
    order: { type: 'number' },
    title: { type: 'string' },
    description: { type: 'string' },
    estimated_minutes: { type: 'number' },
    status: { type: 'string' },
    proof_required: { type: 'string' },
  }
};

export const pathRecSchema = {
  type: 'object',
  properties: {
    path_name: str,
    fit_reason: str,
    concern: str,
    lifestyle_implications: str,
    main_tradeoffs: str,
    // Bounded here as well as in the validator. The schema is the cheap ask —
    // it costs a retry only when the model ignores it — and 261 live rows were
    // written before anything stated the scale at all.
    readiness_score: { type: 'number', minimum: READINESS_MIN, maximum: READINESS_MAX },
    confidence_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    current_gaps: strArr,
    first_experiment: str,
    path_fit_signals: strArr,
  }
};

export const experimentSchema = {
  type: 'object',
  properties: {
    title: str,
    objective: str,
    why_recommended: str,
    expected_learning: str,
    estimated_hours: { type: 'number' },
    deliverable: str,
    completion_criteria: str,
    proof_required: str,
    mission_steps: { type: 'array', items: missionStepSchema },
    reflection_questions: strArr,
    common_mistakes: strArr,
    alternative_version: str,
  }
};

/**
 * Normalise one mission step.
 *
 * The original path-generation bug: the model returns steps as bare prose
 * strings while every reader in the app expects `{ order, title, description,
 * … }`. A string spread into an object produces a character map that passes
 * every field check and renders as an empty row, so strings are converted here
 * rather than being allowed through.
 */
export function normalizeMissionStep(step, index) {
  if (typeof step === 'string') {
    const text = step.trim();
    return {
      order: index + 1,
      title: text,
      description: text,
      estimated_minutes: DEFAULT_STEP_MINUTES,
      status: 'not_started',
      proof_required: '',
    };
  }

  const title = cleanString(step.title) || `Step ${index + 1}`;
  const minutes = toNumber(step.estimated_minutes);
  return {
    order: toNumber(step.order) ?? index + 1,
    title,
    description: cleanString(step.description) || title,
    estimated_minutes: minutes !== null && minutes > 0 ? minutes : DEFAULT_STEP_MINUTES,
    status: cleanString(step.status) || 'not_started',
    proof_required: cleanString(step.proof_required),
  };
}

function validateRecommendation(rec, index, ctx) {
  const label = `Recommendation ${index + 1}`;
  const name = cleanString(rec.path_name);

  if (!name) {
    ctx.fail(
      'rec_missing_name',
      `${label}: every path recommendation needs a non-empty "path_name". An unnamed path cannot be linked to its experiments and renders as a blank card.`
    );
    return null;
  }

  const key = name.toLowerCase();
  if (ctx.seenNames.has(key)) {
    ctx.fail(
      'rec_duplicate_name',
      `${label}: "${name}" duplicates an earlier recommendation. The three paths must be genuinely distinct (best fit, strong alternative, and a contrarian option) and each needs its own name.`
    );
    return null;
  }
  ctx.seenNames.add(key);

  if (!cleanString(rec.fit_reason)) {
    ctx.fail(
      'rec_missing_fit_reason',
      `${label}: missing "fit_reason". It is the sentence the student reads to understand why this path was suggested, so it cannot be blank.`
    );
    return null;
  }

  const score = toNumber(rec.readiness_score);
  if (score === null) {
    ctx.fail(
      'rec_score_missing',
      `${label}: "readiness_score" must be a number on a 0-10 scale.`
    );
    return null;
  }
  if (score < READINESS_MIN || score > READINESS_MAX) {
    ctx.fail(
      'rec_score_out_of_range',
      `${label}: "readiness_score" must be between ${READINESS_MIN} and ${READINESS_MAX} on a 0-10 scale where 10 means fully ready to pursue this path today.`
    );
    return null;
  }

  const confidence = cleanString(rec.confidence_level).toLowerCase();
  const risk = cleanString(rec.risk_level).toLowerCase();
  if (!LEVELS.includes(confidence)) {
    ctx.warn(`${label}: unusable confidence_level; defaulted to medium.`);
  }
  if (!LEVELS.includes(risk)) {
    ctx.warn(`${label}: unusable risk_level; defaulted to medium.`);
  }

  return {
    path_name: name,
    fit_reason: cleanString(rec.fit_reason),
    concern: cleanString(rec.concern),
    lifestyle_implications: cleanString(rec.lifestyle_implications),
    main_tradeoffs: cleanString(rec.main_tradeoffs),
    readiness_score: score,
    confidence_level: LEVELS.includes(confidence) ? confidence : 'medium',
    risk_level: LEVELS.includes(risk) ? risk : 'medium',
    current_gaps: stringArray(rec.current_gaps),
    first_experiment: cleanString(rec.first_experiment),
    path_fit_signals: stringArray(rec.path_fit_signals),
  };
}

function validateExperiment(exp, index, ctx) {
  const label = `Experiment ${index + 1}`;
  const title = cleanString(exp.title);

  if (!title) {
    ctx.fail(
      'experiment_missing_title',
      `${label}: every experiment needs a non-empty "title". The student picks experiments by title, so an untitled one is unclickable.`
    );
    return null;
  }

  const rawSteps = Array.isArray(exp.mission_steps) ? exp.mission_steps : [];
  if (!Array.isArray(exp.mission_steps)) {
    ctx.warn(`${label}: mission_steps was ${describeShape(exp.mission_steps)}; treated as empty.`);
  }

  const usableSteps = rawSteps.filter(step => typeof step === 'string' ? !!step.trim() : isPlainObject(step));
  if (usableSteps.length !== rawSteps.length) {
    ctx.warn(`${label}: dropped ${rawSteps.length - usableSteps.length} mission step(s) that were neither text nor a step object.`);
  }
  if (rawSteps.some(step => typeof step === 'string')) {
    ctx.warn(`${label}: one or more mission steps arrived as plain text and were converted to step objects.`);
  }

  // A 30 day experiment claiming 400 hours against a student who told us they
  // have 8 a week is the model ignoring the brief. Left unset rather than
  // clamped, so the screen shows no estimate instead of a made-up one.
  const hours = toBoundedNumber(exp.estimated_hours, 0, MAX_EXPERIMENT_HOURS);
  if (hours === null) {
    ctx.warn(`${label}: no usable estimated_hours within 0 to ${MAX_EXPERIMENT_HOURS}; left unset.`);
  }

  return {
    title,
    objective: cleanString(exp.objective),
    why_recommended: cleanString(exp.why_recommended),
    expected_learning: cleanString(exp.expected_learning),
    ...(hours !== null ? { estimated_hours: hours } : {}),
    deliverable: cleanString(exp.deliverable),
    completion_criteria: cleanString(exp.completion_criteria),
    proof_required: cleanString(exp.proof_required),
    mission_steps: usableSteps.map(normalizeMissionStep),
    reflection_questions: stringArray(exp.reflection_questions),
    common_mistakes: stringArray(exp.common_mistakes),
    alternative_version: cleanString(exp.alternative_version),
  };
}

/**
 * Validate and repair a path-generation response.
 *
 * @returns {{ ok: boolean, data: object|null, errors: string[], codes: string[], warnings: string[] }}
 *   `data` is the repaired payload, safe to save, and is only non-null when
 *   `ok` is true. `errors` are model-facing instructions for a retry. `codes`
 *   are content-free slugs, the only channel safe to log.
 */
export function validatePathSet(raw) {
  const errors = [];
  const codes = [];
  const warnings = [];
  const ctx = {
    seenNames: new Set(),
    fail(code, message) { codes.push(code); errors.push(message); },
    warn(message) { warnings.push(message); },
  };

  const bail = () => ({ ok: false, data: null, errors, codes, warnings });

  if (!isPlainObject(raw)) {
    ctx.fail('no_result', 'The model returned no result object.');
    return bail();
  }

  // ── Path recommendations ──
  if (!Array.isArray(raw.path_recommendations)) {
    ctx.fail(
      'recs_not_array',
      `"path_recommendations" came back as ${describeShape(raw.path_recommendations)}. It must be an array of exactly ${REQUIRED_REC_COUNT} recommendation objects.`
    );
    return bail();
  }

  const malformedRecs = raw.path_recommendations.filter(r => !isPlainObject(r));
  if (malformedRecs.length) {
    const shapes = [...new Set(malformedRecs.map(describeShape))];
    ctx.fail(
      'rec_malformed',
      `${malformedRecs.length} of ${raw.path_recommendations.length} path recommendations came back as ${shapes.join(' / ')} instead of objects. Each one must be an object with path_name, fit_reason, readiness_score and the rest of the fields in the schema.`
    );
    return bail();
  }

  const recommendations = raw.path_recommendations
    .map((rec, i) => validateRecommendation(rec, i, ctx))
    .filter(Boolean);

  if (recommendations.length !== REQUIRED_REC_COUNT) {
    // Only report the count when nothing more specific already explained the
    // shortfall — otherwise a retry prompt leads with a symptom of its own
    // first error and buries the cause.
    if (!errors.length) {
      ctx.fail(
        'recs_wrong_count',
        `Exactly ${REQUIRED_REC_COUNT} path recommendations are required and ${recommendations.length} came back. Generate all three: best apparent fit, strong alternative, and a contrarian option.`
      );
    } else {
      codes.push('recs_wrong_count');
    }
    return bail();
  }

  // ── Experiments ──
  if (!Array.isArray(raw.experiments)) {
    ctx.fail(
      'experiments_not_array',
      `"experiments" came back as ${describeShape(raw.experiments)}. It must be an array of ${EXPECTED_EXPERIMENT_COUNT} experiment objects for the primary path.`
    );
    return bail();
  }

  const malformedExps = raw.experiments.filter(e => !isPlainObject(e));
  if (malformedExps.length) {
    const shapes = [...new Set(malformedExps.map(describeShape))];
    ctx.fail(
      'experiment_malformed',
      `${malformedExps.length} of ${raw.experiments.length} experiments came back as ${shapes.join(' / ')} instead of objects. Each one must be an object with a title, an objective and a mission_steps array.`
    );
    return bail();
  }

  const experiments = raw.experiments
    .map((exp, i) => validateExperiment(exp, i, ctx))
    .filter(Boolean);

  if (errors.length) return bail();

  // The 30-day plan is the product. Three paths with nothing to run against
  // them is a dead end, so an empty experiment list fails rather than saving.
  if (experiments.length === 0) {
    ctx.fail(
      'experiments_empty',
      `No usable experiments came back. Generate ${EXPECTED_EXPERIMENT_COUNT} experiments for the primary path.`
    );
    return bail();
  }
  if (experiments.length < EXPECTED_EXPERIMENT_COUNT) {
    warnings.push(`Only ${experiments.length} of ${EXPECTED_EXPERIMENT_COUNT} experiments came back.`);
  }

  return {
    ok: true,
    data: {
      path_recommendations: recommendations,
      experiments: experiments.slice(0, EXPECTED_EXPERIMENT_COUNT),
      feasibility_note: cleanString(raw.feasibility_note),
      identity_statement: cleanString(raw.identity_statement),
      archetype: cleanString(raw.archetype),
    },
    errors,
    codes,
    warnings,
  };
}
