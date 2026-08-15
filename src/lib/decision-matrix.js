/**
 * The Career Decision Matrix: scoring, deterministically, from records the
 * student already produced.
 *
 * This module READS ONLY. It creates no hypotheses, writes no scores and stores
 * nothing new. Every number it returns carries the inputs it was computed from,
 * so "Why this score?" is a projection of the same object rather than a second,
 * looser explanation of it.
 *
 * The rules it exists to hold:
 *  - No percentage without enough evidence to justify one. Below the maturity
 *    threshold the metric returns null and the interface says what stage it is
 *    at instead of inventing precision.
 *  - Hypothesis Confidence and Evidence Coverage are separate and are never
 *    blended. Positive early experiences with almost nothing tested is a real
 *    and important state, and collapsing the two would hide it.
 *  - Signals are not equal, and the weights are exported and versioned rather
 *    than buried. A score is reproducible from WEIGHTS + the stored inputs.
 *  - Nothing here is a prediction of success. Confidence answers only how far
 *    the evidence so far supports continuing to test this direction.
 */
import { dimensionsForCareer } from '@/lib/career-dimensions';

/** Bump when the formula changes. Historical rows keep the version they used. */
export const SCORING_VERSION = 'cdm-1';

/**
 * Configurable weights. Experienced signals dominate; what a student told us
 * during onboarding never enters this sum at all — it only sets the starting
 * hypothesis, which is a different thing from evidence.
 */
export const WEIGHTS = {
  experienced_enjoyment: 0.24,
  experienced_energy: 0.15,
  desire_to_repeat: 0.16,
  interest_change: 0.12,
  dimension_evidence: 0.18,
  evidence_consistency: 0.08,
  human_exposure: 0.07,
};

/** Evidence maturity. Confidence is shown as a percentage from `developing` up. */
export const MATURITY = {
  not_tested: { key: 'not_tested', label: 'Not tested', note: 'No real evidence yet.' },
  early_signal: { key: 'early_signal', label: 'Early signal', note: 'Based mostly on what you have told us. Complete an experiment to build stronger evidence.' },
  developing: { key: 'developing', label: 'Developing evidence', note: 'Several relevant signals, still early.' },
  stronger: { key: 'stronger', label: 'Stronger evidence', note: 'Multiple consistent experiences across relevant dimensions.' },
};

/** The minimum before a confidence percentage is shown at all. Configurable. */
export const THRESHOLDS = {
  min_measured_experiments: 1,
  min_signals: 3,
  developing_evidence_items: 2,
  stronger_measured_experiments: 2,
  stronger_evidence_items: 4,
};

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
/** A 1-10 rating as a 0-100 reading. */
const scale = (v) => (num(v) === null ? null : clamp((v / 10) * 100));

const activeRows = (rows) => (Array.isArray(rows) ? rows : [])
  .filter(r => r?.deletion_status !== 'deleted' && r?.deletion_status !== 'permanently_deleted');

const RESPONDED = ['responded', 'call_scheduled', 'completed'];

/** The records that belong to one career hypothesis, matched as the app does. */
export function recordsFor(path, { experiments = [], measurements = {}, proof = [], reflections = [], contacts = [] }) {
  const exps = activeRows(experiments).filter(e => e.path_name === path.path_name || e.path_id === path.id);
  const ids = new Set(exps.map(e => e.id));
  const measured = exps.map(e => measurements[e.id]).filter(m => m?.post_completed_at);
  return {
    experiments: exps,
    completed: exps.filter(e => e.status === 'completed'),
    measured,
    proof: activeRows(proof).filter(p => p.path_tested === path.path_name || p.path_id === path.id || ids.has(p.experiment_id)),
    reflections: activeRows(reflections).filter(r => r.path_name === path.path_name || r.path_id === path.id || ids.has(r.experiment_id)),
    conversations: activeRows(contacts).filter(c =>
      (c.path_being_tested === path.path_name || c.path_id === path.id || ids.has(c.experiment_id))
      && RESPONDED.includes(c.response_status)),
  };
}

/** Which stage of evidence a hypothesis is at. Never inferred from one rating. */
function maturityFor(rec) {
  const items = rec.proof.length + rec.reflections.length + rec.conversations.length;
  if (!rec.measured.length && !items) return MATURITY.not_tested;
  if (rec.measured.length >= THRESHOLDS.stronger_measured_experiments && items >= THRESHOLDS.stronger_evidence_items) return MATURITY.stronger;
  if (rec.measured.length >= THRESHOLDS.min_measured_experiments && items >= THRESHOLDS.developing_evidence_items) return MATURITY.developing;
  return MATURITY.early_signal;
}

/** Evidence Coverage: how much of what this career turns on has been tested. */
function coverageFor({ hypothesis, dimensions, careerName }) {
  const grouped = dimensionsForCareer({ hypothesis, dimensions, careerName });
  const rows = grouped?.rows || [];
  if (!rows.length) return { value: null, tested: [], untested: [], rows: [] };

  const weightOf = (r) => (r.relevance === 'high' ? 2 : 1);
  const creditOf = (r) => {
    if (['strong', 'moderate'].includes(r.current_evidence_level)) return 1;
    if (r.current_evidence_level === 'conflicting') return 0.6;
    if (r.current_evidence_level === 'weak') return 0.35;
    return 0;
  };
  const total = rows.reduce((a, r) => a + weightOf(r), 0);
  const covered = rows.reduce((a, r) => a + weightOf(r) * creditOf(r), 0);
  return {
    value: clamp((covered / total) * 100),
    tested: rows.filter(r => creditOf(r) >= 0.6),
    untested: rows.filter(r => creditOf(r) < 0.6),
    rows,
  };
}

/** Experienced Fit: only what was reported AFTER doing the work. */
function experiencedFit(rec) {
  const inputs = [];
  rec.measured.forEach(m => {
    const add = (label, value, invert = false) => {
      if (num(value) === null) return;
      inputs.push({
        label,
        value: invert ? clamp(100 - scale(value)) : scale(value),
        raw: value,
        inverted: invert,
        source: m.experiment_title || 'An experiment',
        experiment_id: m.experiment_id,
      });
    };
    add('Enjoyment during the work', m.actual_enjoyment);
    add('Energy afterwards', m.actual_energy);
    add('Wanted to do similar work again', m.desire_to_repeat);
    add('Interest in the career after', m.post_career_interest);
    add('Frustration (lower is better)', m.frustration_level, true);
  });
  const value = mean(inputs.map(i => i.value));
  return { value: value === null ? null : clamp(value), inputs };
}

const EXPECTATION_PAIRS = [
  { key: 'enjoyment', label: 'Enjoyment', pre: 'expected_enjoyment', post: 'actual_enjoyment' },
  { key: 'energy', label: 'Energy', pre: 'expected_energy', post: 'actual_energy' },
  { key: 'difficulty', label: 'Difficulty', pre: 'expected_difficulty', post: 'actual_difficulty' },
  { key: 'interest', label: 'Interest in the career', pre: 'pre_career_interest', post: 'post_career_interest' },
  { key: 'confidence', label: 'Belief this career fits', pre: 'pre_career_fit_confidence', post: 'post_career_fit_confidence' },
];

/** Expectation vs Reality. Absent whenever one half was never answered. */
function expectationFor(rec) {
  const usable = rec.measured.filter(m => m.pre_completed_at);
  const pairs = EXPECTATION_PAIRS.map(p => {
    const expected = mean(usable.map(m => num(m[p.pre])).filter(v => v !== null));
    const actual = mean(usable.map(m => num(m[p.post])).filter(v => v !== null));
    if (expected === null || actual === null) return null;
    return {
      ...p,
      expected: clamp(scale(expected)),
      actual: clamp(scale(actual)),
      gap: clamp(scale(actual)) - clamp(scale(expected)),
    };
  }).filter(Boolean);

  return {
    available: pairs.length > 0,
    pairs,
    experiments: usable.length,
    // The headline gap the matrix column shows: closeness of expectation to
    // reality, so a smaller gap reads as a better-calibrated expectation.
    value: pairs.length ? clamp(100 - (mean(pairs.map(p => Math.abs(p.gap))) || 0)) : null,
  };
}

/** Human Exposure: real people only. AI conversations are never counted. */
function humanFor(rec) {
  const people = rec.conversations.map(c => ({
    id: c.id,
    name: c.name,
    role: [c.role, c.company].filter(Boolean).join(' at ') || c.contact_type?.replace(/_/g, ' ') || '',
    date: c.call_date || c.last_contacted_date || c.date_contacted || c.created_date,
    connected: c.reason_for_contact || c.path_being_tested || '',
    learned: (c.notes || '').trim(),
  }));
  return {
    count: people.length,
    // Three real conversations is treated as good exposure for one direction.
    value: clamp((Math.min(people.length, 3) / 3) * 100),
    people,
  };
}

/** The signals behind Hypothesis Confidence, each with its own weight. */
function confidenceSignals({ rec, coverage, contradictions }) {
  const out = [];
  const push = (key, label, value, detail) => {
    if (value === null) return;
    out.push({ key, label, weight: WEIGHTS[key], value: clamp(value), detail });
  };

  const avg = (field) => mean(rec.measured.map(m => num(m[field])).filter(v => v !== null));
  push('experienced_enjoyment', 'Enjoyment reported after real work', scale(avg('actual_enjoyment')),
    `Averaged across ${rec.measured.length} measured experiment${rec.measured.length === 1 ? '' : 's'}.`);
  push('experienced_energy', 'Energy after doing the work', scale(avg('actual_energy')), 'From your post-experiment check-ins.');
  push('desire_to_repeat', 'Wanting to do similar work again', scale(avg('desire_to_repeat')), 'From your post-experiment check-ins.');

  const interestAfter = scale(avg('post_career_interest'));
  push('interest_change', 'Interest in this career after experiencing it', interestAfter, 'Reported after the work, not before it.');

  const tested = (coverage.rows || []).filter(r => ['strong', 'moderate', 'conflicting'].includes(r.current_evidence_level));
  if (tested.length) {
    const toward = tested.filter(r => r.direction === 'draws_toward').length;
    const away = tested.filter(r => r.direction === 'draws_away').length;
    const denom = toward + away;
    push('dimension_evidence', 'Evidence on the dimensions this career turns on',
      denom ? (toward / denom) * 100 : 50,
      `${tested.length} relevant dimension${tested.length === 1 ? '' : 's'} have evidence.`);
  }

  push('evidence_consistency', 'Consistency of your evidence', clamp(100 - contradictions.length * 25),
    contradictions.length ? `${contradictions.length} conflicting reading${contradictions.length === 1 ? '' : 's'} on relevant work.` : 'No conflicting readings on relevant work.');

  const human = humanFor(rec);
  if (human.count) push('human_exposure', 'Perspective from people doing the work', human.value,
    `${human.count} real conversation${human.count === 1 ? '' : 's'}.`);

  return out;
}

/** The trend, from stored hypothesis versions. Never from a single point. */
function trendFrom(updates) {
  const points = [...updates]
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map(u => ({
      id: u.id,
      label: u.stage === 'initial' ? 'Onboarding' : (u.experiment_title || u.test_question || `Update ${u.sequence}`),
      value: num(u.confidence_after),
      at: u.recorded_at || u.created_date,
      strengthened: u.strengthened_by || [],
      weakened: u.weakened_by || [],
      change: u.recommendation_change || u.ai_synthesis || '',
      outcome: u.evidence_outcome || '',
      scoring_version: u.scoring_version || 'stored',
    }))
    .filter(p => p.value !== null);

  if (points.length < 2) return { dir: null, label: 'Not enough history yet', points, from: null, to: null };
  const from = points[points.length - 2].value;
  const to = points[points.length - 1].value;
  const diff = to - from;
  const dir = diff >= 4 ? 'up' : diff <= -4 ? 'down' : 'flat';
  return {
    dir,
    label: dir === 'up' ? 'Strengthening' : dir === 'down' ? 'Weakening' : 'Stable or mixed',
    points, from, to,
  };
}

/** One hypothesis, fully scored, with every input it used attached. */
export function scoreHypothesis({ path, hypothesis, dimensions, updates = [], data }) {
  const rec = recordsFor(path, data);
  const maturity = maturityFor(rec);
  const coverage = coverageFor({ hypothesis, dimensions, careerName: path.path_name });
  const contradictions = hypothesis.contradictions || [];
  const signals = confidenceSignals({ rec, coverage, contradictions });
  const human = humanFor(rec);
  const fit = experiencedFit(rec);
  const expectation = expectationFor(rec);

  // Weighted mean over the signals that actually exist, renormalised so a
  // missing signal cannot quietly count as zero.
  const weightSum = signals.reduce((a, s) => a + s.weight, 0);
  const raw = weightSum ? signals.reduce((a, s) => a + s.value * s.weight, 0) / weightSum : null;
  const showPercent = ['developing', 'stronger'].includes(maturity.key)
    && signals.length >= THRESHOLDS.min_signals
    && rec.measured.length >= THRESHOLDS.min_measured_experiments;

  const unknowns = (coverage.untested || []).map(r => ({
    key: r.dimension,
    label: r.dimension_label,
    question: `Do you take to ${r.noun}?`,
    relevance: r.relevance,
  }));

  const strengthening = [
    ...fit.inputs.filter(i => !i.inverted && i.value >= 70).map(i => ({ text: `${i.label} was high after ${i.source}.`, source: i.source })),
    ...(coverage.tested || []).filter(r => r.direction === 'draws_toward').map(r => ({ text: `Evidence suggests ${r.noun} draws you in.`, source: 'Your decision dimensions' })),
    ...human.people.filter(p => p.learned).slice(0, 2).map(p => ({ text: `A conversation with ${p.name} added real perspective.`, source: p.role || 'Conversation' })),
  ].slice(0, 6);

  const weakening = [
    ...fit.inputs.filter(i => (i.inverted && i.value <= 40) || (!i.inverted && i.value <= 40)).map(i => ({ text: `${i.label} was low after ${i.source}.`, source: i.source })),
    ...(coverage.tested || []).filter(r => r.direction === 'draws_away').map(r => ({ text: `Evidence suggests ${r.noun} tends to drain you.`, source: 'Your decision dimensions' })),
    ...contradictions.slice(0, 2).map(c => ({ text: c.note, source: 'Conflicting evidence' })),
  ].slice(0, 6);

  return {
    pathId: path.id,
    name: path.path_name,
    category: path.path_category || '',
    status: hypothesis.hypothesis_status,
    maturity,
    records: rec,
    confidence: {
      value: showPercent ? clamp(raw) : null,
      signals,
      basis: `Based on ${rec.measured.length} measured experiment${rec.measured.length === 1 ? '' : 's'}, ${rec.proof.length + rec.reflections.length} evidence item${rec.proof.length + rec.reflections.length === 1 ? '' : 's'}, and ${human.count} professional conversation${human.count === 1 ? '' : 's'}.`,
    },
    coverage,
    fit,
    expectation,
    human,
    uncertainty: {
      value: coverage.value === null ? null : clamp(100 - coverage.value),
      biggest: unknowns.sort((a, b) => (b.relevance === 'high' ? 1 : 0) - (a.relevance === 'high' ? 1 : 0))[0] || null,
      others: unknowns.slice(1, 5),
    },
    strengthening,
    weakening,
    unknowns,
    trend: trendFrom(updates),
    provenance: {
      scoring_version: SCORING_VERSION,
      score_generated_at: new Date().toISOString(),
      weights_used: WEIGHTS,
      signals_used: signals.map(s => s.key),
      experiment_ids: rec.experiments.map(e => e.id),
      evidence_ids: [...rec.proof.map(p => p.id), ...rec.reflections.map(r => r.id)],
      decision_dimension_ids: (coverage.rows || []).map(r => r.dimension),
      human_interaction_ids: human.people.map(p => p.id),
      hypothesis_version_id: [...updates].sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0))[0]?.id || null,
    },
  };
}

/** The strongest hypothesis, or nothing when the leaders are too close. */
export function strongestOf(rows = []) {
  const scored = rows.filter(r => r.confidence.value !== null).sort((a, b) => b.confidence.value - a.confidence.value);
  if (!scored.length) return { row: null, reason: 'Not enough evidence yet to compare your directions.' };
  if (scored.length > 1 && scored[0].confidence.value - scored[1].confidence.value < 6) {
    return { row: null, reason: 'Your leading hypotheses are still too close to distinguish confidently.' };
  }
  return { row: scored[0], reason: null };
}

const LEVEL_LABEL = {
  strong_positive: 'Strong Positive Evidence',
  positive: 'Positive Evidence',
  mixed: 'Mixed Evidence',
  negative: 'Negative Evidence',
  strong_negative: 'Strong Negative Evidence',
  unknown: 'Still Unknown',
};

/** Cross-career work-preference evidence, described as evidence, never identity. */
export function workstyleRows(dimensions = []) {
  return dimensions.map(d => {
    let key = 'unknown';
    if (d.current_evidence_level === 'conflicting') key = 'mixed';
    else if (d.direction === 'draws_toward') key = d.current_evidence_level === 'strong' ? 'strong_positive' : d.current_evidence_level === 'unknown' ? 'unknown' : 'positive';
    else if (d.direction === 'draws_away') key = d.current_evidence_level === 'strong' ? 'strong_negative' : d.current_evidence_level === 'unknown' ? 'unknown' : 'negative';
    return {
      dimension: d.dimension,
      label: d.dimension_label,
      noun: d.noun,
      levelKey: key,
      levelLabel: LEVEL_LABEL[key],
      confidence: d.confidence || 0,
      interpretation: d.current_interpretation,
      statement: d.statement,
      behavioral: d.behavioral_evidence || [],
      contradictory: d.contradictory_evidence || [],
      careers: d.careers_observed_in || [],
      selfReported: d.self_reported_preference || null,
      evidenceCount: d.behavioral_evidence_count || 0,
    };
  }).sort((a, b) => b.confidence - a.confidence || b.evidenceCount - a.evidenceCount);
}

/** What real experience has actually changed. Only the student's own words. */
export function changedMind({ measurements = {}, experiments = [] }) {
  const byId = new Map(activeRows(experiments).map(e => [e.id, e]));
  const out = [];
  Object.values(measurements || {}).forEach(m => {
    if (!m?.post_completed_at) return;
    const exp = byId.get(m.experiment_id);
    const career = m.path_name || m.career_name || exp?.path_name || '';
    const gap = (a, b) => (num(m[a]) !== null && num(m[b]) !== null ? num(m[a]) - num(m[b]) : null);

    if (m.assumption_that_changed) {
      out.push({ key: `${m.id}:assumption`, career, expected: 'Before this, you believed:', experienced: m.assumption_that_changed, source: exp?.title || 'An experiment', kind: 'stated' });
    }
    const enjoy = gap('actual_enjoyment', 'expected_enjoyment');
    if (enjoy !== null && Math.abs(enjoy) >= 2) {
      out.push({
        key: `${m.id}:enjoy`,
        career,
        expected: `You expected to enjoy this work ${enjoy < 0 ? 'more' : 'less'} than you did.`,
        experienced: enjoy < 0
          ? `Reported ${Math.abs(enjoy)} points lower enjoyment than expected.`
          : `Reported ${enjoy} points higher enjoyment than expected.`,
        source: exp?.title || 'An experiment',
        kind: enjoy < 0 ? 'down' : 'up',
      });
    }
    const energy = gap('actual_energy', 'expected_energy');
    if (energy !== null && Math.abs(energy) >= 2) {
      out.push({
        key: `${m.id}:energy`,
        career,
        expected: `You expected this work to leave you ${energy < 0 ? 'more energised' : 'flatter'} than it did.`,
        experienced: energy < 0 ? `Reported lower energy than expected.` : `Reported higher energy than expected.`,
        source: exp?.title || 'An experiment',
        kind: energy < 0 ? 'down' : 'up',
      });
    }
    if (m.surprise_reflection) {
      out.push({ key: `${m.id}:surprise`, career, expected: 'What surprised you:', experienced: m.surprise_reflection, source: exp?.title || 'An experiment', kind: 'stated' });
    }
  });
  return out.slice(0, 8);
}

/** The clarity summary. Nothing is manufactured when a record is missing. */
export function claritySummary({ profile = {}, reflections = [], rows = [], dimensions = [] }) {
  const refs = activeRows(reflections).filter(r => num(r.clarity_score) !== null)
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const testedDims = dimensions.filter(d => (d.behavioral_evidence_count || 0) > 0);
  return {
    baseline: num(profile.baseline_career_clarity),
    current: refs.length ? num(refs[refs.length - 1].clarity_score) : null,
    hypothesesTested: rows.filter(r => r.records.measured.length || r.records.proof.length).length,
    experiments: rows.reduce((a, r) => a + r.records.completed.length, 0),
    evidence: rows.reduce((a, r) => a + r.records.proof.length, 0),
    conversations: rows.reduce((a, r) => a + r.human.count, 0),
    unknownsTested: testedDims.length,
    unknownsResolved: dimensions.filter(d => ['moderate', 'strong'].includes(d.current_evidence_level)).length,
    unknownsRemaining: dimensions.filter(d => d.current_evidence_level === 'unknown').length,
  };
}