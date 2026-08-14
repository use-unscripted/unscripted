/**
 * Career decision dimensions: what we know about the student, what we suspect,
 * and what still has to be tested.
 *
 * This is NOT a personality assessment. Every conclusion here is derived from
 * things the student actually did — a completed experiment and how they rated
 * the work afterwards, a written reflection — with stated preferences from
 * onboarding kept in the weakest tier so they can start a conclusion but never
 * finish one.
 *
 * Rules this module exists to hold:
 *  - One experience is never definitive. A single observation can reach WEAK and
 *    no further, however extreme the rating.
 *  - Observations pointing opposite ways produce CONFLICTING, never an average.
 *  - Evidence is per DIMENSION, not per career, so a dimension tested while
 *    exploring consulting also informs strategy, product and venture work. The
 *    source experiment stays attached, and transfer is labelled as transfer.
 *  - Nothing is deleted. Each derivation appends observations; the history lives
 *    in the experiments, measurements and reflections it was read from.
 *  - Language is "evidence suggests", never "you are".
 */
import { characteristicSignals } from '@/lib/evidence-patterns';

/** The five evidence levels, weakest first. */
export const EVIDENCE_LEVELS = ['unknown', 'weak', 'moderate', 'strong', 'conflicting'];

export const EVIDENCE_LEVEL_LABELS = {
  unknown: 'Unknown',
  weak: 'Weak Evidence',
  moderate: 'Moderate Evidence',
  strong: 'Strong Evidence',
  conflicting: 'Conflicting Evidence',
};

/** Confidence is capped by level. Nothing here can ever reach certainty. */
export const CONFIDENCE_CAP = { unknown: 0, weak: 30, moderate: 60, strong: 85, conflicting: 40 };

/**
 * The dimensions careers are actually decided on. `signals` are the work
 * characteristic ids an experiment may be tagged with — several map onto one
 * dimension, and the ids reuse the existing uncertainty model wherever one
 * already exists rather than inventing a parallel vocabulary.
 */
export const CAREER_DIMENSIONS = [
  { id: 'analytical_depth', label: 'Analytical depth', noun: 'sustained analytical work', signals: ['analytical_intensity', 'problem_solving'] },
  { id: 'quantitative_intensity', label: 'Quantitative intensity', noun: 'working in numbers and models', signals: ['quantitative_work'] },
  { id: 'ambiguity_tolerance', label: 'Ambiguity tolerance', noun: 'problems that are not clearly defined', signals: ['ambiguity_tolerance'] },
  { id: 'detail_orientation', label: 'Detail orientation', noun: 'precision held over long stretches', signals: ['attention_to_detail'] },
  { id: 'persuasion', label: 'Persuasion', noun: 'persuading people repeatedly', signals: ['persuasion'] },
  { id: 'client_interaction', label: 'Client interaction', noun: 'working directly with clients', signals: ['interpersonal', 'stakeholder_conflict'] },
  { id: 'teamwork', label: 'Teamwork', noun: 'working closely alongside other people', signals: ['teamwork'] },
  { id: 'independent_work', label: 'Independent work', noun: 'long stretches of solo work', signals: ['independent_work'] },
  { id: 'creativity', label: 'Creativity', noun: 'producing original work', signals: ['creativity'] },
  { id: 'leadership', label: 'Leadership', noun: 'responsibility for other people\u2019s work', signals: ['leadership'] },
  { id: 'competition', label: 'Competition', noun: 'openly competitive work', signals: ['competition'] },
  { id: 'high_pressure_pace', label: 'High-pressure pace', noun: 'high-pressure deadlines', signals: ['pace'] },
  { id: 'long_project_cycles', label: 'Long project cycles', noun: 'work that pays off months later', signals: ['long_project_cycles'] },
  { id: 'short_feedback_loops', label: 'Short feedback loops', noun: 'fast feedback on what you produce', signals: ['short_feedback_loops'] },
  { id: 'autonomy', label: 'Autonomy', noun: 'setting your own direction', signals: ['autonomy'] },
  { id: 'structured_environments', label: 'Structured environments', noun: 'a defined process to work inside', signals: ['structure'] },
  { id: 'risk_tolerance', label: 'Risk tolerance', noun: 'career and financial uncertainty', signals: ['risk_tolerance'] },
  { id: 'building_orientation', label: 'Building vs advising', noun: 'building something yourself rather than advising', signals: ['building_orientation'] },
  { id: 'research', label: 'Research', noun: 'open-ended investigation', signals: ['research'] },
  { id: 'writing', label: 'Writing', noun: 'writing as core work', signals: ['writing'] },
  { id: 'presenting', label: 'Presenting', noun: 'presenting your thinking to a room', signals: ['presenting', 'communication'] },
  { id: 'operational_execution', label: 'Operational execution', noun: 'running the process that keeps things working', signals: ['operational_execution'] },
  { id: 'mission_orientation', label: 'Mission orientation', noun: 'work with a cause behind it', signals: ['mission_orientation'] },
  { id: 'repetitive_precision', label: 'Repetitive precision work', noun: 'repetitive precision work', signals: ['repetitive_tolerance'] },
];

export const DIMENSION_BY_ID = new Map(CAREER_DIMENSIONS.map(d => [d.id, d]));

/** Stated preferences from onboarding. Weak by design: this is belief, not behaviour. */
const STATED = {
  autonomy: { field: 'priority_autonomy', high: 'You said you want to set your own direction.', low: 'You said you prefer clear direction.' },
  structured_environments: { field: 'priority_stability', high: 'You said you value a defined process.', low: 'You said you are comfortable outside a defined process.' },
  creativity: { field: 'priority_creativity', high: 'You said original work matters to you.', low: 'You said you would rather execute a clear brief.' },
  leadership: { field: 'priority_ownership', high: 'You said you want responsibility for other people\u2019s work.', low: 'You said you would rather own only your own work.' },
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const HIGH = 7;
const LOW = 4.5;

/** One rated reading, turned into an observation with its source kept. */
function observations(signal) {
  if (!signal) return [];
  const out = [];
  const readings = [
    ...(signal.enjoyment || []).map(v => ({ v, kind: 'enjoyment' })),
    ...(signal.energy || []).map(v => ({ v, kind: 'energy' })),
    ...(signal.desire || []).map(v => ({ v, kind: 'desire' })),
  ].filter(r => num(r.v) !== null);

  const exps = signal.experiments || [];
  readings.forEach((r, i) => {
    const e = exps[Math.min(i, Math.max(exps.length - 1, 0))] || {};
    out.push({
      value: r.v,
      polarity: r.v >= HIGH ? 'positive' : r.v <= LOW ? 'negative' : 'neutral',
      experiment_id: e.id || null,
      experiment_title: e.title || null,
      career_name: e.career_name || e.path_name || null,
    });
  });
  return out;
}

/**
 * The evidence level for a set of observations.
 * The cap on a single observation is the whole point: no one activity is allowed
 * to look like a settled conclusion.
 */
export function levelFor({ positives = 0, negatives = 0, careers = 0, stated = false }) {
  const total = positives + negatives;
  if (!total) return stated ? 'weak' : 'unknown';
  if (positives && negatives) return 'conflicting';
  if (total === 1) return 'weak';
  if (total >= 3 && careers >= 2) return 'strong';
  return 'moderate';
}

function statementFor(dim, level, direction) {
  if (level === 'unknown') return `We still need to test how you respond to ${dim.noun}.`;
  if (level === 'conflicting') return `Your experiences with ${dim.noun} have pointed both ways, so this is unsettled.`;
  const hedge = level === 'weak' ? 'One experience suggests' : level === 'moderate' ? 'Evidence suggests' : 'Consistent evidence suggests';
  if (direction === 'draws_toward') return `${hedge} you are drawn to ${dim.noun}.`;
  if (direction === 'draws_away') return `${hedge} ${dim.noun} tends to drain you.`;
  return `${hedge} we are still reading how you respond to ${dim.noun}.`;
}

/**
 * Every dimension, as an evidence record. Pure: pass the signals derived from
 * measurements and reflections, plus the onboarding profile.
 */
export function deriveDimensions({ signals = [], profile = {} } = {}) {
  const byId = new Map();
  signals.forEach(s => byId.set(s.id, s));
  const labelIndex = new Map(signals.map(s => [String(s.label || '').toLowerCase(), s]));

  return CAREER_DIMENSIONS.map(dim => {
    const matched = dim.signals
      .map(id => byId.get(id) || labelIndex.get(id.replace(/_/g, ' ')))
      .filter(Boolean);

    const obs = matched.flatMap(observations);
    const positives = obs.filter(o => o.polarity === 'positive');
    const negatives = obs.filter(o => o.polarity === 'negative');
    const careers = new Set(obs.map(o => o.career_name).filter(Boolean));

    const stated = STATED[dim.id];
    const statedValue = stated ? num(profile[stated.field]) : null;
    const self_reported_preference = stated && statedValue !== null && (statedValue >= 4 || statedValue <= 2)
      ? (statedValue >= 4 ? stated.high : stated.low)
      : null;

    const level = levelFor({
      positives: positives.length,
      negatives: negatives.length,
      careers: careers.size,
      stated: Boolean(self_reported_preference),
    });

    const direction = level === 'conflicting' ? 'unclear'
      : positives.length && !negatives.length ? 'draws_toward'
      : negatives.length && !positives.length ? 'draws_away'
      : level === 'weak' && self_reported_preference ? 'unclear'
      : 'none';

    // The majority side is the behavioural evidence; the minority side is kept
    // as contradictory evidence rather than discarded.
    const supporting = negatives.length > positives.length ? negatives : positives;
    const contradicting = negatives.length > positives.length ? positives : negatives;
    const describe = (o) => ({
      text: `${o.polarity === 'positive' ? 'Rated highly' : 'Rated low'} after ${o.experiment_title || 'an experiment'}${o.career_name ? ` (${o.career_name})` : ''}.`,
      source: o.experiment_title || 'Your ratings',
      experiment_id: o.experiment_id,
      experiment_title: o.experiment_title,
      career_name: o.career_name,
    });

    return {
      dimension: dim.id,
      dimension_label: dim.label,
      noun: dim.noun,
      current_evidence_level: level,
      direction,
      self_reported_preference,
      behavioral_evidence: supporting.map(describe),
      contradictory_evidence: contradicting.map(describe),
      careers_observed_in: [...careers],
      evidence_count: obs.length,
      confidence: Math.min(CONFIDENCE_CAP[level], obs.length * 20 + (self_reported_preference ? 10 : 0)),
      statement: statementFor(dim, level, direction),
      sources: matched.flatMap(s => s.sources || []),
    };
  });
}

const RANK = { strong: 0, conflicting: 1, moderate: 2, weak: 3, unknown: 4 };

/**
 * "What we're learning about you": the known and suspected first, then the
 * highest-value gaps. Never more than a handful of each, so it reads as a
 * finding rather than a report.
 */
export function learningStatements(dimensions = [], { known = 4, open = 3 } = {}) {
  const sorted = [...dimensions].sort((a, b) => RANK[a.current_evidence_level] - RANK[b.current_evidence_level] || b.evidence_count - a.evidence_count);
  return {
    knowing: sorted.filter(d => ['strong', 'moderate'].includes(d.current_evidence_level)).slice(0, known),
    suspecting: sorted.filter(d => d.current_evidence_level === 'weak').slice(0, known),
    conflicting: sorted.filter(d => d.current_evidence_level === 'conflicting').slice(0, 2),
    open: sorted.filter(d => d.current_evidence_level === 'unknown').slice(0, open),
  };
}

/**
 * The dimensions one career hypothesis still turns on, answered from the shared
 * store so a dimension already tested elsewhere is not retested for its own
 * sake. Anything learned on a different career is marked as transferred, with
 * the source career named, because a preference does not transfer perfectly
 * across contexts.
 */
export function dimensionsForCareer({ hypothesis, dimensions = [], careerName }) {
  const relevant = (hypothesis?.uncertainty?.variables || []).filter(v => v.relevance !== 'low');
  const wanted = new Map();
  relevant.forEach(v => {
    CAREER_DIMENSIONS.forEach(d => { if (d.signals.includes(v.variable)) wanted.set(d.id, v.relevance); });
  });
  if (!wanted.size) return null;

  const rows = dimensions
    .filter(d => wanted.has(d.dimension))
    .map(d => {
      const others = (d.careers_observed_in || []).filter(c => c && c !== careerName);
      return {
        ...d,
        relevance: wanted.get(d.dimension),
        transferred: d.current_evidence_level !== 'unknown' && others.length > 0 && !(d.careers_observed_in || []).includes(careerName),
        transferred_from: others,
        transfer_note: others.length
          ? `Learned while testing ${others.slice(0, 2).join(' and ')}. It may read differently here.`
          : null,
      };
    })
    .sort((a, b) => RANK[b.current_evidence_level] - RANK[a.current_evidence_level]);

  return {
    rows,
    unknown: rows.filter(r => r.current_evidence_level === 'unknown'),
    conflicting: rows.filter(r => r.current_evidence_level === 'conflicting'),
    answered: rows.filter(r => ['moderate', 'strong'].includes(r.current_evidence_level)),
    transferred: rows.filter(r => r.transferred),
  };
}

/**
 * The decision dimensions ONE experiment tested, matched from the work
 * characteristics it was tagged with. Empty when an experiment carries no tags,
 * so nobody is asked what they noticed about something they never did.
 */
export function dimensionsForExperiment({ experiment, dimensions = [] }) {
  const tags = new Set([
    ...(experiment?.decision_dimension_ids || []),
    ...(experiment?.work_characteristic_ids || []),
    ...(experiment?.work_characteristics_tested || []),
  ].map(t => String(t).toLowerCase().replace(/\s+/g, '_')));
  if (!tags.size) return [];

  const wanted = CAREER_DIMENSIONS.filter(d => tags.has(d.id) || d.signals.some(s => tags.has(s)));
  return wanted
    .map(d => dimensions.find(x => x.dimension === d.id) || {
      dimension: d.id, dimension_label: d.label, noun: d.noun,
      current_evidence_level: 'unknown', evidence_count: 0,
    })
    .slice(0, 4);
}

/** Signals → dimensions in one call, for screens that already loaded the raw rows. */
export function dimensionsFromActivity({ experiments = [], measurements = {}, reflections = [], profile = {} } = {}) {
  const signals = characteristicSignals({ experiments, measurements, reflections });
  return deriveDimensions({ signals, profile });
}