/**
 * The tradeoffs on one path, and where the student stands on each.
 *
 * GROUNDING RULE: every tradeoff listed here is read off a record that already
 * exists — the Role Blueprint for this career (its schedule notes, environment,
 * the characteristics it marks as important, and the parts it says cannot be
 * simulated) or the path's own recorded information. Nothing is invented here,
 * and a path with no blueprint and no recorded costs shows no tradeoffs rather
 * than a generic list.
 *
 * The student's own reading of each one is a TradeoffStance record: unknown,
 * untested, acceptable, concern, dealbreaker, or context dependent. Only
 * "acceptable" and "dealbreaker" are settled positions; everything else is still
 * an open question, and the most important open one can become the Conviction
 * Gap (see conviction-gap.js).
 */

export const TRADEOFF_STATUSES = [
  { id: 'unknown', label: 'Unknown', help: 'I have not thought about this yet.', resolved: false },
  { id: 'untested', label: 'Untested', help: 'I have a view, but nothing I have done tests it.', resolved: false },
  { id: 'acceptable', label: 'Acceptable', help: 'I have seen this and I can live with it.', resolved: true },
  { id: 'concern', label: 'Concern', help: 'This worries me and it is not settled.', resolved: false },
  { id: 'dealbreaker', label: 'Dealbreaker', help: 'If this is true of the work, this path is out.', resolved: true },
  { id: 'context_dependent', label: 'Context dependent', help: 'Fine in some settings, not in others.', resolved: false },
];

const STATUS_BY_ID = new Map(TRADEOFF_STATUSES.map(s => [s.id, s]));
const text = (v) => String(v || '').trim();
const list = (v) => (Array.isArray(v) ? v.filter(x => text(x)) : []);

/**
 * @param {object} args
 * @param {object} args.path      the PathRecommendations record
 * @param {object|null} args.blueprint the RoleBlueprint for this career
 * @param {Array} args.stances    this student's TradeoffStance records
 * @returns {{items: Array, important: Array, unresolvedImportant: Array, settledCount: number}}
 */
export function buildTradeoffs({ path, blueprint, stances = [] }) {
  const raw = [];

  // From the blueprint: the parts of the work it names as costs or conditions.
  if (blueprint) {
    if (text(blueprint.work_schedule_notes)) {
      raw.push({
        id: 'bp:schedule',
        label: 'The hours and schedule this work runs on',
        detail: text(blueprint.work_schedule_notes),
        source: 'Role blueprint: work schedule',
        dimension: 'pace',
        importance: 'high',
      });
    }
    if (text(blueprint.work_environment)) {
      raw.push({
        id: 'bp:environment',
        label: 'The setting the work happens in',
        detail: text(blueprint.work_environment),
        source: 'Role blueprint: work environment',
        dimension: 'structure',
        importance: 'high',
      });
    }
    (Array.isArray(blueprint.characteristics) ? blueprint.characteristics : [])
      .filter(c => c && c.importance === 'high' && text(c.note))
      .forEach(c => raw.push({
        id: `bp:char:${c.dimension || c.dimension_label}`,
        label: text(c.dimension_label) || text(c.dimension),
        detail: text(c.note),
        source: 'Role blueprint: important work characteristic',
        dimension: text(c.dimension) || null,
        importance: 'high',
        simulatable: c.simulatable !== false,
      }));
    list(blueprint.cannot_be_simulated).forEach((s, i) => raw.push({
      id: `bp:nosim:${i}`,
      label: s,
      detail: 'This part of the work cannot be reproduced in a test, so the only way to read it is from people doing it.',
      source: 'Role blueprint: cannot be simulated',
      dimension: null,
      importance: 'high',
      simulatable: false,
    }));
    list(blueprint.common_misconceptions).forEach((s, i) => raw.push({
      id: `bp:myth:${i}`,
      label: s,
      detail: 'Recorded as something people commonly get wrong about this work.',
      source: 'Role blueprint: common misconception',
      dimension: null,
      importance: 'medium',
    }));
  }

  // From the path's own recorded information.
  if (text(path?.main_tradeoffs)) {
    raw.push({
      id: 'path:tradeoffs',
      label: 'The main tradeoff recorded for this path',
      detail: text(path.main_tradeoffs),
      source: 'Path information: main tradeoffs',
      dimension: null,
      importance: 'high',
    });
  }
  if (text(path?.lifestyle_implications)) {
    raw.push({
      id: 'path:lifestyle',
      label: 'What this path would mean for how you live',
      detail: text(path.lifestyle_implications),
      source: 'Path information: lifestyle',
      dimension: null,
      importance: 'high',
      simulatable: false,
    });
  }
  const doubt = text(path?.why_it_may_not_fit) || text(path?.concern);
  if (doubt) {
    raw.push({
      id: 'path:concern',
      label: 'The reason this path may not fit you',
      detail: doubt,
      source: 'Path information: why it may not fit',
      dimension: null,
      importance: 'high',
    });
  }

  const stanceById = new Map((stances || []).filter(s => s.tradeoff_id).map(s => [s.tradeoff_id, s]));
  const seen = new Set();
  const items = raw
    .filter(t => t.label && !seen.has(t.id) && seen.add(t.id))
    .map(t => {
      const stance = stanceById.get(t.id) || null;
      const status = STATUS_BY_ID.get(stance?.status) || STATUS_BY_ID.get('unknown');
      return {
        ...t,
        stanceId: stance?.id || null,
        status: status.id,
        statusLabel: status.label,
        note: text(stance?.note),
        resolved: status.resolved,
      };
    });

  const important = items.filter(t => t.importance === 'high');
  return {
    items,
    important,
    unresolvedImportant: important.filter(t => !t.resolved),
    settledCount: items.filter(t => t.resolved).length,
  };
}

/** The kind of test that would settle one tradeoff, given how it is grounded. */
export function tradeoffTest(tradeoff) {
  if (!tradeoff) return null;
  if (tradeoff.simulatable === false) {
    return 'A Human Reality conversation with somebody doing this work, aimed squarely at this. It is not something a simulated task can answer honestly.';
  }
  if (tradeoff.status === 'context_dependent') {
    return 'A second test on this in a different realistic setting, so you can see which conditions make it acceptable and which do not.';
  }
  return 'A short test run under the condition itself, so your reading of it comes from having met it rather than from imagining it.';
}

export default buildTradeoffs;