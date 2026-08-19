/**
 * The conviction read for every path, computed inside the Career Decision Matrix
 * rather than on a dashboard of its own.
 *
 * It reuses the Conviction Lab's own logic — the Conviction Record, the
 * Conviction Gap, Decision Readiness and the path's next best test — but reads
 * them off the records the matrix has already loaded, so surfacing conviction per
 * path costs no extra requests.
 *
 * Tradeoff stances and tension signals are NOT read here: they need per-path
 * reads that only the deeper path view does. Their absence can only make a path
 * look less settled, never more, which is the safe direction.
 */
import { dimensionProgress, nextTestForPath } from '@/lib/dimension-progress';
import { decideReadiness } from '@/lib/decide-readiness';
import { buildConvictionRecord } from '@/lib/conviction-record';
import { pickConvictionGap } from '@/lib/conviction-gap';
import { decisionReadinessState } from '@/lib/decision-readiness-state';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

/** Task Performance: how the work came out, not how it felt. */
function taskPerformance({ pathName, context }) {
  const experiments = (context.experiments || []).filter(e => e.path_name === pathName);
  const measurements = experiments.map(e => context.measurements?.[e.id]).filter(Boolean);
  const readings = [];
  measurements.forEach(m => {
    if (num(m.system_performance_score) !== null) readings.push(Math.round(m.system_performance_score));
    else if (num(m.self_rated_performance) !== null) readings.push(Math.round(m.self_rated_performance * 10));
  });
  const value = mean(readings);
  return {
    value: value === null ? null : Math.max(0, Math.min(100, Math.round(value))),
    count: readings.length,
    reviewed: measurements.filter(m => num(m.system_performance_score) !== null).length,
  };
}

/**
 * @param {object} args
 * @param {Array}  args.hypotheses [{ path, hypothesis }] from the evidence profile
 * @param {Array}  args.signals    the evidence signals behind them
 * @param {object} args.context    loadStudentContext() result
 * @returns {object} keyed by path id
 */
export function buildMatrixConviction({ hypotheses = [], signals = [], context }) {
  const progressById = new Map();
  hypotheses.forEach(({ path, hypothesis }) => {
    progressById.set(path.id, dimensionProgress({ hypothesis, signals }));
  });

  const out = {};
  hypotheses.forEach(({ path, hypothesis }) => {
    const progress = progressById.get(path.id);
    const readiness = decideReadiness(progress);
    const alternatives = hypotheses
      .filter(h => h.path.id !== path.id)
      .map(h => ({
        name: h.path.path_name,
        testedCount: progressById.get(h.path.id)?.testedCount || 0,
      }));

    const record = buildConvictionRecord({ path, hypothesis, progress, readiness, context, alternatives });
    const nextTest = progress ? nextTestForPath({ path, hypothesis, progress }) : null;

    out[path.id] = {
      record,
      progress,
      nextTest,
      /* Where this path stands, in states rather than a percentage. */
      decisionReadiness: decisionReadinessState({ record, progress }),
      /* "Is there enough here for a decision to rest on evidence?" */
      actionReadiness: record.areas.find(a => a.id === 'action_readiness') || null,
      gap: pickConvictionGap({ record, progress, nextTest }),
      performance: taskPerformance({ pathName: path.path_name, context }),
    };
  });
  return out;
}

export default buildMatrixConviction;