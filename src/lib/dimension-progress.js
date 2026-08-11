/**
 * Evidence progress for a Career Hypothesis.
 *
 * This module adds NO new model. Every dimension it shows comes from the Career
 * Uncertainty Map that already decides which work characteristics matter for a
 * given career, and whether one counts as tested is read from the same
 * per-characteristic signals the recommendation engine uses. Nothing is invented
 * so that a progress bar has something to fill.
 *
 * Rules held here on purpose:
 *  - A dimension is TESTED only when real evidence exists for it. Opening or
 *    generating an experiment moves nothing.
 *  - No career is ever "complete". The strongest state is strong evidence, and
 *    understanding can keep changing after it.
 *  - Nothing predicts a score increase. A test is described by what it would
 *    tell us, never by what it would add.
 *  - Evidence that lowers a career's fit is progress and is worded that way.
 */
import { evidenceState } from '@/lib/next-best-experiment';
import { depthOf } from '@/lib/experiment-depth';

/** How much evidence a characteristic needs before we call it tested. */
export const TESTED_OBSERVATIONS = 2;

const WEIGHT = { high: 2, medium: 1, low: 0 };
const lower = (s) => String(s || '').trim().replace(/\?$/, '').replace(/^./, c => c.toLowerCase());

/**
 * What has and has not been tested on one career.
 * `hypothesis` is a derived Career Hypothesis; `signals` are the rated
 * characteristic signals (evidence-patterns.characteristicSignals).
 */
export function dimensionProgress({ hypothesis, signals = [] }) {
  const variables = (hypothesis?.uncertainty?.variables || [])
    .filter(v => v.relevance !== 'low')
    .sort((a, b) => WEIGHT[b.relevance] - WEIGHT[a.relevance])
    .slice(0, 8);
  if (!variables.length) return null;

  const byId = new Map(signals.map(s => [s.id, s]));
  const rows = variables.map(v => {
    const state = evidenceState(byId.get(v.variable));
    return {
      id: v.variable,
      label: v.label,
      question: v.question,
      relevance: v.relevance,
      observations: state.rated,
      contradicted: state.contradicted,
      status: state.rated >= TESTED_OBSERVATIONS ? 'tested' : state.rated === 1 ? 'partial' : 'untested',
    };
  });

  const tested = rows.filter(r => r.status === 'tested');
  const partial = rows.filter(r => r.status === 'partial');
  const untested = rows.filter(r => r.status === 'untested');
  const confidence = hypothesis?.fit_confidence_score ?? null;

  return {
    rows,
    tested,
    partial,
    untested,
    total: rows.length,
    testedCount: tested.length,
    confidence,
    fit: hypothesis?.career_fit_score ?? null,
    evidenceStatus: evidenceStatusOf({ tested: tested.length, total: rows.length, confidence }),
    message: progressMessage({ tested, partial, untested }),
  };
}

/** Never "complete". Strong evidence is as settled as a career gets. */
export function evidenceStatusOf({ tested = 0, total = 0, confidence = null }) {
  const share = total ? tested / total : 0;
  if (share >= 0.7 && (confidence === null || confidence >= 60)) return { key: 'strong', label: 'Strong', hint: 'Enough evidence that we would stand behind this, and it can still change.' };
  if (tested >= 2) return { key: 'building', label: 'Building', hint: 'Real evidence exists here, and parts of it are still open.' };
  if (tested >= 1 || share > 0) return { key: 'early', label: 'Early', hint: 'One piece of real evidence so far.' };
  return { key: 'untested', label: 'Untested', hint: 'Nothing tested yet, so this is still only a hypothesis.' };
}

/** Curiosity, not pressure. Never a promised score movement. */
function progressMessage({ tested, partial, untested }) {
  if (untested.length === 1) return `One part of this career is still untested: ${lower(untested[0].label)}.`;
  if (untested.length > 1) return `One more targeted Quick Test could strengthen our understanding of this path. ${untested.length} dimensions are still untested.`;
  if (partial.length) return `We have one reading on ${lower(partial[0].label)}. A second would tell us whether it holds.`;
  if (tested.some(t => t.contradicted)) return 'We found something we are still unsure about. Your readings here have gone both ways.';
  return 'Every dimension that matters most here now has evidence behind it. Testing again keeps it honest as you change.';
}

/**
 * The next test for one career: the most useful untested dimension, why it
 * matters, and where it goes. Returns null when nothing is open.
 */
export function nextTestForPath({ path, hypothesis, progress, minutes = 4 }) {
  const p = progress || dimensionProgress({ hypothesis, signals: [] });
  const target = p?.untested?.[0] || p?.partial?.[0] || p?.tested?.find(t => t.contradicted);
  if (!target) return null;

  const shown = (p.tested || []).filter(t => !t.contradicted).slice(0, 2).map(t => lower(t.label));
  const why = [
    shown.length ? `You have shown evidence on ${shown.join(' and ')}.` : 'We know what you told us you want, and little yet about how you work.',
    target.contradicted
      ? `Your readings on ${lower(target.label)} have gone both ways, so this is not settled.`
      : `We still have limited evidence about ${lower(target.label)}.`,
  ].join(' ');

  return {
    dimension: target.label,
    question: target.question,
    minutes,
    why,
    to: `/moment?recId=${path?.id || ''}&variable=${encodeURIComponent(target.id)}`,
  };
}

/**
 * Cross-career patterns, only where the evidence carries them: a characteristic
 * measured at least twice, rated positively, and tested on more than one career.
 * Returns null rather than a thin insight.
 */
export function crossCareerPatterns({ signals = [], minCharacteristics = 2, minCareers = 2 } = {}) {
  const characteristics = [];
  const careers = new Set();

  signals.forEach(s => {
    const state = evidenceState(s);
    if (state.rated < TESTED_OBSERVATIONS || state.contradicted || state.direction !== 'positive') return;
    const names = new Set((s.experiments || []).map(e => e.career_name || e.path_name).filter(Boolean));
    if (names.size < minCareers) return;
    characteristics.push({ id: s.id, label: s.label, careers: [...names] });
    names.forEach(n => careers.add(n));
  });

  if (characteristics.length < minCharacteristics || careers.size < minCareers) return null;
  return {
    characteristics: characteristics.slice(0, 4),
    careers: [...careers].slice(0, 4),
  };
}

const withinDays = (date, days) => {
  if (!date) return false;
  const t = new Date(date).getTime();
  return Number.isFinite(t) && Date.now() - t <= days * 86400000;
};

/**
 * Career evidence this week. Only counts of records that exist — no streaks, and
 * nothing to lose by not returning.
 */
export function weeklyEvidence({ experiments = [], measurements = {}, signals = [], recalculations = {}, days = 7 } = {}) {
  const recent = experiments.filter(e => withinDays(measurements[e.id]?.post_completed_at, days));
  const quickTests = recent.filter(e => depthOf(e) === 'quick_test').length;
  const deepDives = recent.filter(e => depthOf(e) === 'deep_dive').length;

  const dimensions = new Set();
  signals.forEach(s => {
    if ((s.sources || []).some(src => withinDays(src.date, days))) dimensions.add(s.id);
  });

  const moreConfident = Object.values(recalculations || {})
    .filter(r => withinDays(r?.recalculated_at || r?.created_date, days) && (r?.delta_confidence || 0) >= 2).length;

  const total = quickTests + deepDives + dimensions.size + moreConfident;
  return total ? { quickTests, deepDives, dimensions: dimensions.size, moreConfident } : null;
}

/**
 * Evidence milestones. Each one marks something the student actually learned,
 * including learning that a career does not fit.
 */
export function evidenceMilestones({ progressList = [], recalculations = {}, completedExperiments = 0 } = {}) {
  const out = [];
  const dimensions = new Set();
  progressList.forEach(p => (p?.progress?.tested || []).forEach(t => dimensions.add(t.id)));

  if (completedExperiments >= 1) out.push({ id: 'first_test', label: 'First career tested', hint: 'You produced your first piece of real evidence.' });
  if (dimensions.size >= 3) out.push({ id: 'three_dimensions', label: '3 career dimensions explored', hint: `${dimensions.size} dimensions now have evidence behind them.` });
  if (progressList.some(p => p?.progress?.evidenceStatus?.key === 'strong')) {
    out.push({ id: 'strong_path', label: 'Your first strong-evidence path', hint: 'Enough evidence on one career that we would stand behind it.' });
  }
  const changedMind = Object.values(recalculations || {}).find(r => typeof r?.delta_fit === 'number' && r.delta_fit <= -8);
  if (changedMind) {
    out.push({
      id: 'changed_mind',
      label: 'You changed your mind about a career',
      hint: `Testing ${changedMind.path_name || 'a career'} lowered its fit. Ruling something out is progress too.`,
    });
  }
  return out;
}

/** How a movement in fit is described. A fall is clarity, never failure. */
export function outcomeFraming(deltaFit) {
  if (typeof deltaFit !== 'number' || Math.abs(deltaFit) < 2) return 'That test held your current picture steady, and added evidence behind it.';
  if (deltaFit < 0) return 'That test gave you useful clarity. Ruling a career down is progress, not a setback.';
  return 'That test strengthened the case for this career. It is still a hypothesis.';
}