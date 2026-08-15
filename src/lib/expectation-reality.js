/**
 * Expectation against reality, for one experiment.
 *
 * Everything here is derived from what the student actually answered. A row with
 * no pre half shows the outcome alone rather than a delta from an invented
 * baseline, and the "what changed" lines are descriptions of their own numbers,
 * never explanations of them: "your interest decreased after completing this
 * work, despite expecting to enjoy it" reports two answers side by side and
 * stops there. Nothing in this file concludes that a career fits or does not.
 */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The comparison rows, in a fixed order so two experiments read the same way.
 * `expected` is null wherever that question was never asked.
 */
export const COMPARISON_ROWS = [
  { key: 'enjoyment', label: 'Enjoyment', pre: 'expected_enjoyment', post: 'actual_enjoyment', preLabel: 'Expected', postLabel: 'Actual' },
  { key: 'difficulty', label: 'Difficulty', pre: 'expected_difficulty', post: 'actual_difficulty', preLabel: 'Expected', postLabel: 'Actual' },
  { key: 'energy', label: 'Energy', pre: 'expected_energy', post: 'actual_energy', preLabel: 'Expected', postLabel: 'Actual' },
  { key: 'interest', label: 'Interest in path', pre: 'pre_career_interest', post: 'post_career_interest', preLabel: 'Before', postLabel: 'After' },
  { key: 'confidence', label: 'Confidence this fits you', pre: 'pre_career_fit_confidence', post: 'post_career_fit_confidence', preLabel: 'Before', postLabel: 'After' },
];

/** Post-only answers: no expectation was ever collected for these. */
export const OUTCOME_ONLY_ROWS = [
  { key: 'frustration', label: 'Frustration', post: 'frustration_level' },
  { key: 'repeat', label: 'Desire to do similar work again', post: 'desire_to_repeat' },
  { key: 'performance', label: 'How well you think you did', post: 'self_rated_performance' },
];

export const hasPost = (m) => !!m?.post_completed_at;

/**
 * The comparison itself. Returns rows plus whether a baseline existed at all, so
 * a historical experiment can say so instead of showing empty arrows.
 */
export function comparison(m) {
  if (!m) return { rows: [], outcomes: [], hasBaseline: false, hasOutcome: false };

  const rows = COMPARISON_ROWS.map(r => {
    const expected = num(m[r.pre]);
    const actual = num(m[r.post]);
    return {
      ...r,
      expected,
      actual,
      delta: expected !== null && actual !== null ? actual - expected : null,
      state: actual === null ? 'not_recorded' : expected === null ? 'outcome_only' : 'compared',
    };
  }).filter(r => r.expected !== null || r.actual !== null);

  const outcomes = OUTCOME_ONLY_ROWS
    .map(r => ({ ...r, value: num(m[r.post]) }))
    .filter(r => r.value !== null);

  return {
    rows,
    outcomes,
    hasBaseline: rows.some(r => r.expected !== null),
    hasOutcome: hasPost(m) && rows.some(r => r.actual !== null),
  };
}

/**
 * "What changed?" — one careful sentence per movement the student's own numbers
 * show. No causal claim, no fit verdict, and nothing at all when a pair is
 * missing or unmoved.
 */
export function whatChanged(m) {
  const c = comparison(m);
  if (!c.hasOutcome) return [];
  const by = (key) => c.rows.find(r => r.key === key && r.state === 'compared') || null;
  const lines = [];

  const enjoyment = by('enjoyment');
  const interest = by('interest');
  const difficulty = by('difficulty');
  const energy = by('energy');
  const confidence = by('confidence');

  if (interest && interest.delta !== 0) {
    const dir = interest.delta < 0 ? 'decreased' : 'increased';
    const hoped = enjoyment && enjoyment.expected >= 7;
    lines.push(
      hoped && interest.delta < 0
        ? `You reported that your interest in this path ${dir} after completing this work, despite expecting to enjoy it.`
        : `You reported that your interest in this path ${dir} after completing this work.`
    );
  }

  if (enjoyment && enjoyment.delta !== 0) {
    lines.push(enjoyment.delta < 0
      ? `You enjoyed the work less than you expected to (${enjoyment.expected} expected, ${enjoyment.actual} actual).`
      : `You enjoyed the work more than you expected to (${enjoyment.expected} expected, ${enjoyment.actual} actual).`);
  }

  if (difficulty && difficulty.delta !== 0) {
    lines.push(difficulty.delta > 0
      ? `You found it harder than you expected. Difficulty on its own says nothing about whether this path fits you.`
      : `You found it easier than you expected.`);
  }

  if (energy && energy.delta !== 0) {
    lines.push(energy.delta < 0
      ? `You felt less energised afterwards than you expected to.`
      : `You felt more energised afterwards than you expected to.`);
  }

  if (confidence && confidence.delta !== 0) {
    lines.push(confidence.delta < 0
      ? `Your own confidence that this path fits you went down. That is one experiment, not a conclusion.`
      : `Your own confidence that this path fits you went up.`);
  }

  if (!lines.length) lines.push('Your answers after the work matched what you expected before it.');
  return lines;
}

/**
 * Behavioural signals, kept apart from everything the student rated. Counts of
 * what happened, with no interpretation attached: finishing something is not
 * evidence of enjoying it, and skipping a mission is not evidence of dislike.
 * Every entry is null when we genuinely do not have it.
 */
export function behavioralSnapshot({ exp, guide, proof = [], measurement } = {}) {
  const steps = Array.isArray(guide?.steps) ? guide.steps : (Array.isArray(exp?.mission_steps) ? exp.mission_steps : []);
  const completed = Array.isArray(guide?.completed_steps) ? guide.completed_steps.length : null;
  const total = steps.length || null;

  const started = guide?.progress_started_at ? new Date(guide.progress_started_at).getTime() : null;
  const ended = guide?.progress_completed_at ? new Date(guide.progress_completed_at).getTime() : null;
  const minutes = started && ended && ended > started ? Math.round((ended - started) / 60000) : null;

  const mine = (rows) => rows.filter(r => r.experiment_id === exp?.id);
  const evidence = mine(proof);

  return {
    missions_completed: completed,
    missions_total: total,
    missions_skipped: completed !== null && total !== null ? Math.max(total - completed, 0) : null,
    minutes_spent: minutes,
    optional_work_completed: evidence.length > 1 ? true : null,
    evidence_submitted: evidence.length,
    desire_to_repeat: num(measurement?.desire_to_repeat),
  };
}

/**
 * What this experiment may contribute onward: work-preference evidence, a nudge
 * to hypothesis confidence, and unknowns that are still open. Deliberately
 * advisory. Nothing here eliminates a hypothesis, and a single result never
 * changes a path's status on its own.
 */
export function dimensionContributions(m, exp) {
  if (!hasPost(m)) return { preferences: [], confidence_hint: null, still_unknown: [], eliminates: false };

  const preferences = [];
  const enjoyed = num(m.actual_enjoyment);
  const repeat = num(m.desire_to_repeat);
  const energy = num(m.actual_energy);
  const label = exp?.uncertainty_label || exp?.test_question || 'this kind of work';

  if (enjoyed !== null && repeat !== null) {
    if (enjoyed >= 7 && repeat >= 7) preferences.push(`Evidence suggests you respond well to ${label}.`);
    else if (enjoyed <= 4 && repeat <= 4) preferences.push(`Evidence suggests ${label} may not be something you want more of.`);
    else preferences.push(`Evidence on ${label} is mixed so far.`);
  }
  if (energy !== null) {
    preferences.push(energy >= 7
      ? 'You reported feeling energised after this work.'
      : energy <= 4 ? 'You reported feeling drained after this work.' : 'You reported a neutral energy level after this work.');
  }

  const delta = num(m.career_confidence_delta);
  const confidence_hint = delta === null || delta === 0 ? null
    : delta < 0 ? 'Confidence in this hypothesis may need lowering, based on one experiment.'
    : 'Confidence in this hypothesis may be raised slightly, based on one experiment.';

  const still_unknown = [];
  if (num(m.actual_enjoyment) !== null && num(m.desire_to_repeat) !== null && Math.abs(m.actual_enjoyment - m.desire_to_repeat) >= 3) {
    still_unknown.push('You enjoyed the work and do not want to repeat it, or the reverse. Worth one more test.');
  }
  if (!m.assumption_that_changed && !m.surprise_reflection) {
    still_unknown.push('What this experience told you about the path is still thin. A second, different test would help.');
  }

  return { preferences, confidence_hint, still_unknown, eliminates: false };
}