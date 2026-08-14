/**
 * Work preferences, and the patterns behind what energises and what drains.
 *
 * Everything here comes from the post-experiment measurement rows that already
 * exist: for each work characteristic an experiment tested, we look at how the
 * student actually rated that work afterwards. Onboarding priorities still
 * count, in the weakest tier, so a stated preference can start a conclusion but
 * an observed one overtakes it.
 *
 * A characteristic seen once is labelled preliminary rather than presented as a
 * pattern, and where there is too little to say the answer is "Still Learning".
 */
import { evidenceSource, summarizeEvidence } from '@/lib/evidence-graph';
import { WORK_VARIABLES } from '@/lib/uncertainty-model';
import { reflectionCharacteristicSignals } from '@/lib/reflection-signals';

const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Onboarding priorities that speak to a preference, kept as weak evidence. */
const STATED = {
  autonomy:   { field: 'priority_autonomy',   high: 'You said you want to set your own direction.',       low: 'You said you prefer clear direction.' },
  structure:  { field: 'priority_stability',  high: 'You said you value stability and a defined process.', low: 'You said you are comfortable outside a defined process.' },
  creativity: { field: 'priority_creativity', high: 'You said original work matters to you.',              low: 'You said you would rather execute a clear brief.' },
  leadership: { field: 'priority_ownership',  high: 'You said you want responsibility for other people\u2019s work.', low: 'You said you would rather own only your own work.' },
};

/**
 * Aggregate every rated experiment by the work characteristics it tested.
 * This is the shared spine for preferences, energisers and drains.
 */
export function characteristicSignals({ experiments = [], measurements = {}, reflections = [] }) {
  const byLabel = new Map();
  const variableFor = (tag) => {
    const t = String(tag).toLowerCase();
    return WORK_VARIABLES.find(v => v.id === tag || v.label.toLowerCase() === t)
      || WORK_VARIABLES.find(v => t.includes(v.label.toLowerCase()));
  };

  experiments.forEach(e => {
    const m = measurements[e.id];
    if (!m?.post_completed_at) return;
    const tags = [...(e.work_characteristic_ids || []), ...(e.work_characteristics_tested || [])];
    const seen = new Set();

    tags.forEach(tag => {
      const v = variableFor(tag);
      const id = v?.id || String(tag).toLowerCase();
      const label = v?.label || String(tag);
      if (seen.has(id)) return;
      seen.add(id);

      if (!byLabel.has(id)) byLabel.set(id, { id, label, enjoyment: [], energy: [], desire: [], frustration: [], sources: [], experiments: [] });
      const bucket = byLabel.get(id);
      [['enjoyment', m.actual_enjoyment], ['energy', m.actual_energy], ['desire', m.desire_to_repeat], ['frustration', m.frustration_level]]
        .forEach(([key, value]) => { if (num(value) !== null) bucket[key].push(value); });
      bucket.experiments.push(e);
      bucket.sources.push(evidenceSource({
        kind: 'measurement',
        detail: `Your ratings after ${e.title}`,
        date: m.post_completed_at,
        link: `/experiments?experimentId=${e.id}`,
        nodeId: `outcome:${m.id}`,
      }));
      if (e.status === 'completed') {
        bucket.sources.push(evidenceSource({
          kind: 'experiment',
          detail: e.title,
          date: m.post_completed_at,
          link: `/experiments?experimentId=${e.id}`,
          nodeId: `experiment:${e.id}`,
        }));
      }
    });
  });

  // Written reflections join the same buckets rather than living in a parallel
  // system, so a characteristic the student wrote about is evidence too — at
  // self-report quality, and unable on its own to look like a measured pattern.
  reflectionCharacteristicSignals(reflections).forEach(r => {
    if (!byLabel.has(r.id)) byLabel.set(r.id, { id: r.id, label: r.label, enjoyment: [], energy: [], desire: [], frustration: [], sources: [], experiments: [], extractions: [] });
    const b = byLabel.get(r.id);
    b.enjoyment.push(...r.enjoyment);
    b.energy.push(...r.energy);
    b.sources.push(...r.sources);
    b.extractions = [...(b.extractions || []), ...r.extractions];
  });

  return [...byLabel.values()].map(b => ({
    ...b,
    ratedCount: b.enjoyment.length || b.energy.length || b.desire.length,
    avgEnjoyment: avg(b.enjoyment),
    avgEnergy: avg(b.energy),
    avgDesire: avg(b.desire),
    avgFrustration: avg(b.frustration),
  }));
}

/**
 * The fourteen preferences the profile reports on. Each one reads the signal for
 * its matching work characteristic, so nothing is invented for a characteristic
 * the student has never been measured on.
 */
export const PREFERENCES = [
  { id: 'autonomy', label: 'Autonomy', noun: 'deciding your own approach' },
  { id: 'teamwork', label: 'Teamwork', noun: 'working closely with other people' },
  { id: 'ambiguity_tolerance', label: 'Ambiguity Tolerance', noun: 'problems that are not clearly defined' },
  { id: 'structure', label: 'Structure', noun: 'a defined process to work inside' },
  { id: 'pace', label: 'Pace', noun: 'a fast and intense working pace' },
  { id: 'interpersonal', label: 'Interpersonal Intensity', noun: 'spending most of the day with people' },
  { id: 'quantitative_work', label: 'Quantitative Intensity', noun: 'working in numbers and models' },
  { id: 'creativity', label: 'Creative Freedom', noun: 'producing original work' },
  { id: 'leadership', label: 'Leadership', noun: 'responsibility for other people\u2019s work' },
  { id: 'persuasion', label: 'Persuasion', noun: 'persuading people repeatedly' },
  { id: 'research', label: 'Research', noun: 'open-ended investigation' },
  { id: 'independent_work', label: 'Independent Work', noun: 'long stretches of solo work' },
  { id: 'repetitive_tolerance', label: 'Tolerance for Repetition', noun: 'work that repeats day to day' },
  { id: 'risk_tolerance', label: 'Risk Tolerance', noun: 'career and financial uncertainty' },
];

const direction = (signal) => {
  if (!signal || !signal.ratedCount) return null;
  const readings = [...(signal.enjoyment || []), ...(signal.energy || []), ...(signal.desire || [])];
  // Rated both ways at different times: mixed, and left open for more testing
  // rather than averaged into a preference the student never expressed.
  if (readings.some(n => n >= 7) && readings.some(n => n <= 4.5)) return 'mixed';
  const score = avg([signal.avgEnjoyment, signal.avgEnergy, signal.avgDesire].filter(n => n !== null));
  if (score === null) return null;
  if (score >= 7) return 'high';
  if (score <= 4.5) return 'low';
  return 'mixed';
};

function statement(pref, dir, signal) {
  if (dir === 'high') return `You consistently report greater enjoyment and energy when the work involves ${pref.noun}.`;
  if (dir === 'low') return `You consistently report lower enjoyment and energy when the work leans on ${pref.noun}.`;
  if (dir === 'mixed') return `Your ratings on ${pref.noun} have gone both ways so far, so this is not settled.`;
  return `We have not measured you on ${pref.noun} yet.`;
}

/** Work preferences, each with its own evidence and an explicit status. */
export function derivePreferences({ signals = [], profile = {} }) {
  const byId = new Map(signals.map(s => [s.id, s]));

  return PREFERENCES.map(pref => {
    const signal = byId.get(pref.id);
    const sources = [...(signal?.sources || [])];

    const stated = STATED[pref.id];
    const value = stated ? num(profile[stated.field]) : null;
    if (stated && value !== null && (value >= 4 || value <= 2)) {
      sources.push(evidenceSource({
        kind: 'onboarding',
        detail: value >= 4 ? stated.high : stated.low,
        date: profile.created_date,
        link: '/profile',
        nodeId: 'user',
      }));
    }
    if (pref.id === 'risk_tolerance' && typeof profile.willing_financial_risk === 'boolean') {
      sources.push(evidenceSource({
        kind: 'onboarding',
        detail: profile.willing_financial_risk ? 'You said you can carry financial risk.' : 'You said you need financial security.',
        date: profile.created_date,
        link: '/profile',
        nodeId: 'user',
      }));
    }

    const summary = summarizeEvidence(sources);
    const dir = direction(signal);
    const observed = (signal?.ratedCount || 0) >= 2;
    const status = observed ? 'observed' : summary.observedCount ? 'preliminary' : summary.count ? 'stated_only' : 'still_learning';

    return {
      ...pref,
      signal: signal || null,
      direction: dir,
      status,
      headline: dir === 'high' ? `High ${pref.label} Preference`
        : dir === 'low' ? `Lower ${pref.label} Preference`
        : status === 'still_learning' ? `${pref.label} — Still Learning`
        : `${pref.label} — Not Settled Yet`,
      statement: status === 'still_learning'
        ? `Nothing you have done yet tells us how you feel about ${pref.noun}.`
        : status === 'stated_only'
          ? `${sources.find(s => s.quality.tier === 'lower')?.detail || ''} We have not tested it through real work yet.`
          : statement(pref, dir, signal),
      sources,
      summary,
    };
  }).sort((a, b) => b.summary.score - a.summary.score);
}

/**
 * Repeated patterns behind energy and frustration.
 * A single measured occurrence is returned flagged `preliminary` so the screen
 * can label it instead of presenting one rating as a pattern.
 */
export function deriveEnergyPatterns(signals = []) {
  const energisers = [];
  const drains = [];

  signals.forEach(s => {
    if (!s.ratedCount) return;
    const positive = avg([s.avgEnjoyment, s.avgEnergy, s.avgDesire].filter(n => n !== null));
    const entry = (kind) => ({
      id: s.id,
      label: s.label,
      kind,
      preliminary: s.ratedCount < 2,
      occurrences: s.ratedCount,
      enjoyment: s.avgEnjoyment,
      energy: s.avgEnergy,
      desire: s.avgDesire,
      frustration: s.avgFrustration,
      sources: s.sources,
      summary: summarizeEvidence(s.sources),
    });

    if (positive !== null && positive >= 6.5) energisers.push(entry('energiser'));
    const draining = (positive !== null && positive <= 4.5) || (s.avgFrustration !== null && s.avgFrustration >= 7);
    if (draining) drains.push(entry('drain'));
  });

  const rank = (a, b) => (a.preliminary === b.preliminary ? b.summary.score - a.summary.score : a.preliminary ? 1 : -1);
  return { energisers: energisers.sort(rank), drains: drains.sort(rank) };
}

/** Attach preference and pattern conclusions to the graph. */
export function linkPatterns(graph, { preferences = [], energisers = [], drains = [] }) {
  const attach = (prefix, type, items) => items.forEach(item => {
    const id = graph.node(`${prefix}:${item.id}`, type, item.headline || item.label, { summary: item.summary });
    item.sources.forEach(s => graph.link(s.nodeId, id, 'evidences'));
    graph.link('user', id, 'holds');
  });
  attach('preference', 'work_preference', preferences.filter(p => p.status !== 'still_learning'));
  attach('energiser', 'work_preference', energisers);
  attach('drain', 'work_preference', drains);
  return graph;
}