/**
 * Structured measurement around a Career Experiment: what the student expected
 * before doing the work, what actually happened after, and the gap between the
 * two.
 *
 * One row per experiment. The pre check-in creates it, the post check-in fills
 * the second half and computes the deltas. Nothing here reads or writes the
 * Career Hypothesis: recalibration is a later change, so this only records
 * evidence.
 *
 * Self-rated performance and system-rated performance are deliberately separate
 * fields and are never averaged or overwritten by each other. The distance
 * between them is itself the signal.
 */
import { base44 } from '@/api/base44Client';

/**
 * The five the Career Experiment pre check-in asks.
 *
 * That component renders every entry and requires every entry, and its own copy
 * reads "Answer all five to begin", so a field added to this list silently
 * becomes another mandatory question in a flow that never asked for one. Every
 * extra required question costs completions, which is the number this area of
 * the product exists to move. A prediction that only one flow needs goes in a
 * list of its own, the way SIM_PRE_FIELDS below does. Add here only when you
 * mean to change the Career Experiment check-in, and change its copy to match.
 */
export const PRE_FIELDS = [
  { key: 'expected_enjoyment', label: 'Expected enjoyment', low: 'Not at all', high: 'A lot' },
  { key: 'expected_difficulty', label: 'Expected difficulty', low: 'Easy', high: 'Very hard' },
  { key: 'pre_career_interest', label: 'Current interest in this career', low: 'Low', high: 'High' },
  { key: 'pre_career_fit_confidence', label: 'How strongly do you think this career fits you?', low: 'Not sure', high: 'Very sure' },
  { key: 'expected_energy', label: 'Expected energy / excitement', low: 'Flat', high: 'Energised' },
];

/**
 * The four the work simulation asks on its setup screen, in its own wording.
 * Two of them, expected_performance and expected_want_more, are asked nowhere
 * else. The other two overlap with PRE_FIELDS by key on purpose: the same
 * column, so the same deltas come out, asked in the simulation's voice.
 */
export const SIM_PRE_FIELDS = [
  { key: 'expected_enjoyment', label: 'How much do you think you will enjoy this?', low: 'Not at all', high: 'A lot' },
  { key: 'expected_energy', label: 'How do you think you will feel after 30 minutes of this?', low: 'Drained', high: 'Energised' },
  { key: 'expected_performance', label: 'How well do you think you will do?', low: 'Poorly', high: 'Very well' },
  { key: 'expected_want_more', label: 'Do you think you will want to do another one after this?', low: 'No', high: 'Yes' },
];

/**
 * Every pre field any flow can write, deduplicated by key. The save path reduces
 * over this rather than over one flow's list, so both check-ins land their
 * answers on the row without either one having to declare its fields at the call
 * site. A key the caller did not answer stays absent, which is how this schema
 * stores "not asked".
 */
export const ALL_PRE_FIELDS = [
  ...PRE_FIELDS,
  ...SIM_PRE_FIELDS.filter(s => !PRE_FIELDS.some(p => p.key === s.key)),
];

export const POST_FIELDS = [
  { key: 'actual_enjoyment', label: 'Actual enjoyment', low: 'Not at all', high: 'A lot' },
  { key: 'actual_difficulty', label: 'Actual difficulty', low: 'Easy', high: 'Very hard' },
  { key: 'actual_energy', label: 'Energy after completing it', low: 'Drained', high: 'Energised' },
  { key: 'frustration_level', label: 'Frustration level', low: 'None', high: 'A lot' },
  { key: 'desire_to_repeat', label: 'Desire to do similar work again', low: 'None', high: 'Strong' },
  { key: 'self_rated_performance', label: 'How well do you think you did?', low: 'Poorly', high: 'Very well' },
  { key: 'post_career_fit_confidence', label: 'How strongly do you think this career fits you now?', low: 'Not sure', high: 'Very sure' },
];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Every measurement row this student owns, keyed by experiment. */
export async function loadMeasurements() {
  const rows = await base44.entities.ExperimentMeasurement.list('-created_date', 200).catch(() => []);
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach(r => {
    if (r?.experiment_id && !map[r.experiment_id]) map[r.experiment_id] = r;
  });
  return map;
}

export const hasPre = (m) => !!m?.pre_completed_at;
export const hasPost = (m) => !!m?.post_completed_at;

const links = (exp) => ({
  experiment_id: exp.id,
  experiment_title: exp.title || undefined,
  career_hypothesis_id: exp.career_hypothesis_id || exp.path_recommendation_id || undefined,
  career_name: exp.career_name || exp.path_name || undefined,
  path_name: exp.path_name || undefined,
  cycle_id: exp.cycle_id || undefined,
});

const clean = (payload) => {
  Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
  return payload;
};

/** The pre-experiment check-in. Reuses an existing row rather than adding one. */
export async function savePreMeasurement(exp, values) {
  const user = await base44.auth.me();
  const payload = clean({
    user_id: user?.id,
    ...links(exp),
    ...ALL_PRE_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: num(values[f.key]) ?? undefined }), {}),
    pre_completed_at: new Date().toISOString(),
  });

  const existing = await base44.entities.ExperimentMeasurement
    .filter({ experiment_id: exp.id }, '-created_date', 5).catch(() => []);
  const row = (Array.isArray(existing) ? existing : [])[0];
  if (row) {
    await base44.entities.ExperimentMeasurement.update(row.id, payload);
    return { ...row, ...payload };
  }
  return base44.entities.ExperimentMeasurement.create(payload);
}

/**
 * Belief correction: actual minus expected. A negative enjoyment delta means the
 * work was less enjoyable than hoped; a negative difficulty delta means it was
 * easier than feared. Null wherever the matching pre answer is missing, so a
 * historical experiment never gets an invented baseline.
 */
export function computeDeltas(pre, post) {
  const d = (a, b) => (num(a) !== null && num(b) !== null ? num(a) - num(b) : undefined);
  return {
    enjoyment_expectation_delta: d(post.actual_enjoyment, pre?.expected_enjoyment),
    difficulty_expectation_delta: d(post.actual_difficulty, pre?.expected_difficulty),
    energy_expectation_delta: d(post.actual_energy, pre?.expected_energy),
    career_confidence_delta: d(post.post_career_fit_confidence, pre?.pre_career_fit_confidence),
  };
}

/** The post-experiment check-in, plus the calculated differences. */
export async function savePostMeasurement(exp, existingRow, values) {
  const user = await base44.auth.me();
  const post = POST_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: num(values[f.key]) }), {});
  const payload = clean({
    user_id: user?.id,
    ...links(exp),
    ...POST_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: post[f.key] ?? undefined }), {}),
    surprise_reflection: (values.surprise_reflection || '').trim() || undefined,
    post_completed_at: new Date().toISOString(),
    ...computeDeltas(existingRow, post),
  });

  const rows = await base44.entities.ExperimentMeasurement
    .filter({ experiment_id: exp.id }, '-created_date', 5).catch(() => []);
  const row = existingRow || (Array.isArray(rows) ? rows : [])[0];
  if (row) {
    await base44.entities.ExperimentMeasurement.update(row.id, payload);
    return { ...row, ...payload };
  }
  return base44.entities.ExperimentMeasurement.create(payload);
}