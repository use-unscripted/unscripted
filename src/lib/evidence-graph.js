/**
 * The Career Evidence Graph.
 *
 * The student-facing screen is called the Career Evidence Profile, but nothing
 * here stores a conclusion as a sentence. Every conclusion is a node with edges
 * back to the records that produced it — the experiment, the measurement row,
 * the reflection, the proof — so "why does Unscripted think this?" is answered
 * by walking the graph rather than by trusting generated text.
 *
 * Two rules this module exists to hold:
 *  - Nothing reads a clock to become more certain. Strength is a function of
 *    what the student produced, never of how long ago they signed up.
 *  - What the student SAYS about themselves and what we OBSERVED are different
 *    kinds of evidence. Onboarding is kept forever, but it is the weakest tier,
 *    so observed behaviour outweighs it once there is enough of it.
 *
 * The hypothesis layer (career-hypothesis.js), the uncertainty map
 * (uncertainty-model.js) and the pre/post measurement layer
 * (experiment-measurement.js) already exist and are read, not rebuilt.
 */

/**
 * Evidence quality tiers. `weight` is deliberately gentle: the architecture is
 * here so weighting can be tuned later without touching any screen.
 */
export const EVIDENCE_QUALITY = {
  onboarding:       { weight: 1, tier: 'lower',  label: 'What you told us about yourself' },
  reflection:       { weight: 2, tier: 'medium', label: 'Your reflections' },
  measurement:      { weight: 2, tier: 'medium', label: 'Your experiment ratings' },
  experiment:       { weight: 3, tier: 'higher', label: 'Experiments you completed' },
  proof:            { weight: 3, tier: 'higher', label: 'Proof of work' },
  system_evaluation:{ weight: 3, tier: 'higher', label: 'Reviewed performance' },
};

export const TIER_LABELS = { lower: 'Self-reported', medium: 'Observed pattern', higher: 'Demonstrated' };

export const EVIDENCE_LEVELS = {
  none:        { label: 'Still Learning', tone: 'muted' },
  preliminary: { label: 'Preliminary',    tone: 'muted' },
  some:        { label: 'Some Evidence',  tone: 'info' },
  strong:      { label: 'Strong Evidence', tone: 'success' },
};

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const q = (kind) => EVIDENCE_QUALITY[kind] || EVIDENCE_QUALITY.onboarding;

/**
 * One evidence source attached to a conclusion.
 * `nodeId` is the graph node it came from, which is what makes the conclusion
 * traceable rather than merely plausible.
 */
export function evidenceSource({ kind, detail, date, link, nodeId, depth_kind }) {
  return {
    kind,
    // The experiment level this came from (Quick Test / Deep Dive) or the other
    // source kind, so a conclusion can state what it is built from.
    depth_kind: depth_kind || kind,
    quality: q(kind),
    detail: detail || '',
    date: date || null,
    link: link || null,
    nodeId: nodeId || null,
  };
}

/** Counts by experiment level and source kind, for "Based on…" lines. */
export function countSourceKinds(sources = []) {
  const counts = {};
  (sources || []).forEach(s => { const k = s?.depth_kind || s?.kind; if (k) counts[k] = (counts[k] || 0) + 1; });
  return counts;
}

/**
 * Turn a set of sources into a stated confidence.
 *
 * Observed behaviour dominates once it exists: the self-reported tier is capped
 * at a small contribution, so onboarding can start a conclusion but cannot keep
 * carrying it once experiments, proofs and ratings pile up. Confidence is capped
 * below 100 on purpose — we never claim certainty.
 */
export function summarizeEvidence(sources = []) {
  if (!sources.length) {
    return { score: 0, count: 0, level: 'none', tier: null, confidence: 0, sources: [], newest: null, strongest: null, observedCount: 0 };
  }
  const stated = sources.filter(s => s.quality.tier === 'lower');
  const observed = sources.filter(s => s.quality.tier !== 'lower');

  const statedScore = Math.min(stated.reduce((n, s) => n + s.quality.weight, 0), 2);
  const observedScore = observed.reduce((n, s) => n + s.quality.weight, 0);
  const distinctKinds = new Set(observed.map(s => s.kind)).size;
  const score = statedScore + observedScore + Math.max(0, distinctKinds - 1);

  const level = score >= 8 ? 'strong' : score >= 4 ? 'some' : observed.length || score >= 2 ? 'preliminary' : 'preliminary';
  const tier = observed.length
    ? (observed.some(s => s.quality.tier === 'higher') ? 'higher' : 'medium')
    : 'lower';

  const dated = sources.filter(s => s.date).sort((a, b) => new Date(b.date) - new Date(a.date));
  const ranked = [...sources].sort((a, b) => b.quality.weight - a.quality.weight);

  return {
    score,
    count: sources.length,
    observedCount: observed.length,
    level,
    tier,
    confidence: clamp(Math.min(score * 9 + (observed.length ? 8 : 0), 85)),
    sources: ranked,
    newest: dated[0] || null,
    strongest: ranked[0] || null,
  };
}

/** A tiny directed graph. Nodes are de-duplicated by id; edges keep provenance. */
export function createGraph() {
  const nodes = new Map();
  const edges = [];
  return {
    node(id, type, label, data = {}) {
      if (id && !nodes.has(id)) nodes.set(id, { id, type, label, ...data });
      return id;
    },
    link(from, to, type) {
      if (from && to && nodes.has(from) && nodes.has(to)) edges.push({ from, to, type });
      return to;
    },
    get: (id) => nodes.get(id) || null,
    nodes: () => [...nodes.values()],
    edges: () => edges,
    edgesFrom: (id) => edges.filter(e => e.from === id),
    stats() {
      const byType = {};
      nodes.forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1; });
      return { nodes: nodes.size, edges: edges.length, byType };
    },
  };
}

/**
 * The record spine of the graph:
 * user → career hypothesis → experiment → expectation → performance → outcome
 * → reflection → proof.
 *
 * Conclusion nodes (abilities, preferences, patterns, questions) are added on
 * top of this by the modules that derive them, and always link back into it.
 */
export function buildRecordGraph({ user = {}, paths = [], experiments = [], measurements = {}, reflections = [], proof = [], scenarioResponses = [] }) {
  const graph = createGraph();
  const userId = graph.node('user', 'user', user.full_name || 'You');

  /* Hypothetical decisions sit on the spine as their own node type, between what
     the student says and what they do. Keeping them here is what will eventually
     let the same question be asked three ways: what students say, what they
     hypothetically choose, and what they actually did. */
  scenarioResponses.forEach(r => {
    const id = graph.node(`scenario:${r.id}`, 'scenario_decision', r.scenario_key || 'Decision scenario', { record: r });
    graph.link(userId, id, 'decided_hypothetically');
    if (r.experiment_id && graph.get(`experiment:${r.experiment_id}`)) graph.link(`experiment:${r.experiment_id}`, id, 'answered_during');
  });

  paths.forEach(p => {
    const careerId = graph.node(`career:${p.id}`, 'career_hypothesis', p.path_name, { record: p });
    graph.link(userId, careerId, 'is_testing');
  });

  const careerNodeFor = (exp) => {
    const byId = exp.career_hypothesis_id || exp.path_recommendation_id;
    if (byId && graph.get(`career:${byId}`)) return `career:${byId}`;
    const match = paths.find(p => p.path_name === (exp.career_name || exp.path_name));
    return match ? `career:${match.id}` : null;
  };

  experiments.forEach(e => {
    const expId = graph.node(`experiment:${e.id}`, 'experiment', e.title, { record: e });
    graph.link(userId, expId, 'ran');
    graph.link(careerNodeFor(e), expId, 'tested_by');

    const m = measurements[e.id];
    if (m?.pre_completed_at) {
      const preId = graph.node(`expectation:${m.id}`, 'pre_expectation', `What you expected from ${e.title}`, { record: m });
      graph.link(expId, preId, 'expected');
    }
    if (m?.post_completed_at) {
      const postId = graph.node(`outcome:${m.id}`, 'post_measurement', `What actually happened in ${e.title}`, { record: m });
      graph.link(expId, postId, 'measured_by');
    }
    if (typeof m?.system_performance_score === 'number' || m?.demonstrated_strengths?.length) {
      const perfId = graph.node(`performance:${m.id}`, 'experiment_performance', `Performance on ${e.title}`, { record: m });
      graph.link(expId, perfId, 'performed');
    }
  });

  reflections.forEach(r => {
    const id = graph.node(`reflection:${r.id}`, 'reflection', r.path_name ? `Reflection on ${r.path_name}` : 'Reflection', { record: r });
    graph.link(userId, id, 'reflected');
    if (r.experiment_id) graph.link(`experiment:${r.experiment_id}`, id, 'reflected_on');
  });

  proof.forEach(p => {
    const id = graph.node(`proof:${p.id}`, 'proof', p.title, { record: p });
    graph.link(userId, id, 'produced');
    if (p.experiment_id) graph.link(`experiment:${p.experiment_id}`, id, 'produced');
  });

  return graph;
}