/**
 * The longitudinal career decision record.
 *
 * This is an ASSEMBLY module, not a new data product. Every line it returns is
 * read from a row the student already owns — the onboarding profile, career
 * hypotheses, experiments, missions, conversations, proof, the pre/post
 * measurement rows, reflections, and the append-only HypothesisUpdate history.
 * Nothing here writes, recomputes or reconciles anything.
 *
 * The rule that shapes it: HISTORICAL INTEGRITY. A node is built from the record
 * that existed at the time, so an earlier position always reads as "what we
 * believed at the time" even when a later experiment contradicted it. Later
 * conclusions are appended as their own nodes; they never edit an earlier one.
 *
 * Chain, per hypothesis:
 *   Initial hypothesis → Experiment n (tested · expectation · activity ·
 *   evidence · reality) → Hypothesis update (strengthened / weakened / mixed,
 *   unknown resolved, new unknown) → … → Current position.
 */
import { entityTime } from '@/lib/dates';
import { decisionMeta, timelineFrom } from '@/lib/hypothesis-updates';
import { EVIDENCE_LEVEL_LABELS, learningStatements } from '@/lib/career-dimensions';

const live = (r) => r && r.deletion_status !== 'deleted' && r.deletion_status !== 'permanently_deleted';
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const at = (r) => entityTime(r?.recorded_at || r?.completed_at || r?.created_date) || 0;

export const DIRECTIONS = {
  strengthened: { label: 'Strengthened', tone: 'var(--success-700)' },
  weakened: { label: 'Weakened', tone: 'var(--warning-700)' },
  mixed: { label: 'Mixed', tone: 'var(--info-700)' },
  unchanged: { label: 'No clear movement', tone: 'var(--ink-500)' },
};

/** Which way one recorded update moved the hypothesis. Read, never re-derived. */
export function updateDirection(u = {}) {
  const strong = (u.strengthened_by || []).length;
  const weak = (u.weakened_by || []).length;
  const delta = num(u.confidence_after) !== null && num(u.confidence_before) !== null
    ? u.confidence_after - u.confidence_before
    : null;
  if (strong && weak) return 'mixed';
  if (strong || (delta !== null && delta > 2)) return 'strengthened';
  if (weak || (delta !== null && delta < -2)) return 'weakened';
  return 'unchanged';
}

/** What the student expected before doing the work. */
function expectationLines(m) {
  if (!m) return [];
  return [
    num(m.expected_enjoyment) !== null && `Expected enjoyment ${m.expected_enjoyment}/10`,
    num(m.expected_difficulty) !== null && `Expected difficulty ${m.expected_difficulty}/10`,
    num(m.pre_career_interest) !== null && `Interest in the career beforehand ${m.pre_career_interest}/10`,
    m.biggest_concern && `Main concern: “${m.biggest_concern}”`,
    m.expectation_prediction && `Expected to learn: “${m.expectation_prediction}”`,
  ].filter(Boolean);
}

/** What actually happened, with the gap named where both halves exist. */
function realityLines(m) {
  if (!m?.post_completed_at) return [];
  const gap = (d, up, down) => (num(d) === null || d === 0 ? null : d > 0 ? `${up} than expected (+${d})` : `${down} than expected (${d})`);
  return [
    num(m.actual_enjoyment) !== null && `Actual enjoyment ${m.actual_enjoyment}/10`,
    gap(m.enjoyment_expectation_delta, 'More enjoyable', 'Less enjoyable'),
    gap(m.difficulty_expectation_delta, 'Harder', 'Easier'),
    gap(m.career_interest_delta, 'More interested in the career', 'Less interested in the career'),
    m.assumption_that_changed && `Belief that changed: “${m.assumption_that_changed}”`,
    m.surprise_reflection && `Surprise: “${m.surprise_reflection}”`,
  ].filter(Boolean);
}

const unknownsOf = (node) => (node?.unknowns || []).map(u => String(u).trim()).filter(Boolean);

/**
 * One hypothesis, as a chronological chain.
 * `updates` are the stored HypothesisUpdate rows for this path; when there are
 * none (a legacy student, or a hypothesis tested before updates existed) the
 * initial node is read from the hypothesis record itself and marked as such.
 */
export function buildChain({ path, updates = [], experiments = [], missions = [], proof = [], reflections = [], measurements = {} }) {
  const { initial, updates: ups } = timelineFrom(updates);

  const initialNode = {
    kind: 'initial',
    at: initial ? at(initial) : entityTime(path.created_date) || 0,
    statement: initial?.hypothesis_statement || path.why_this_may_fit || path.why_it_fits || path.fit_reason || '',
    rationale: initial?.rationale || path.goals_supported || path.fit_reason || '',
    confidence: initial?.confidence_after ?? path.fit_confidence_score ?? null,
    unknowns: initial?.remaining_unknowns?.length
      ? initial.remaining_unknowns
      : (path.unresolved_questions || []).map(q => q?.question).filter(Boolean),
    // A snapshot recorded at the time, or reconstructed from the hypothesis for
    // a student who tested before the history existed. Never presented as the
    // same thing.
    reconstructed: !initial,
  };

  const expNodes = experiments
    .filter(e => e.path_id === path.id || e.career_hypothesis_id === path.id || e.path_recommendation_id === path.id)
    .sort((a, b) => at(a) - at(b))
    .map((e) => {
      const m = measurements[e.id] || null;
      const evidence = proof.filter(p => p.experiment_id === e.id);
      const acts = missions.filter(mi => mi.experiment_id === e.id);
      const update = ups.find(u => u.experiment_id === e.id) || null;
      return {
        kind: 'experiment',
        at: at(e),
        id: e.id,
        title: e.title,
        status: e.status,
        tested: e.test_question || e.unresolved_question || e.objective || '',
        expectation: expectationLines(m),
        activity: {
          missions: acts.map(a => a.title).filter(Boolean),
          campus: acts.filter(a => /campus|event|club|fair/i.test(`${a.title} ${a.objective || ''}`)).map(a => a.title),
        },
        evidence: evidence.map(p => ({ id: p.id, title: p.title, category: p.category, approved: p.resume_status === 'approved' })),
        reality: realityLines(m),
        reflectionId: update?.reflection_id || reflections.find(r => r.experiment_id === e.id)?.id || null,
        updateId: update?.id || null,
      };
    });

  // Unknowns carried forward, so "resolved" and "new" are differences between
  // recorded states rather than a judgement made now.
  let carried = unknownsOf(initialNode);
  const updateNodes = ups.map((u) => {
    const now = (u.remaining_unknowns || []).map(x => String(x).trim()).filter(Boolean);
    const node = {
      kind: 'update',
      at: at(u),
      id: u.id,
      sequence: u.sequence,
      experimentId: u.experiment_id || null,
      experimentTitle: u.experiment_title || '',
      direction: updateDirection(u),
      confidenceBefore: u.confidence_label_before || (num(u.confidence_before) !== null ? `${u.confidence_before}%` : null),
      confidenceAfter: u.confidence_label_after || (num(u.confidence_after) !== null ? `${u.confidence_after}%` : null),
      studentCorrected: u.confidence_label_source === 'student_corrected',
      strengthened: (u.strengthened_by || []).map(x => x.text).filter(Boolean),
      weakened: (u.weakened_by || []).map(x => x.text).filter(Boolean),
      resolved: carried.filter(q => !now.includes(q)),
      newUnknowns: now.filter(q => !carried.includes(q)),
      unknowns: now,
      decision: u.decision || null,
      decisionLabel: decisionMeta(u.decision)?.label || null,
      note: u.decision_note || '',
      correction: u.student_correction || '',
      nextTest: u.next_best_test || '',
    };
    carried = now;
    return node;
  });

  const nodes = [initialNode, ...expNodes, ...updateNodes].sort((a, b) => a.at - b.at);
  const last = updateNodes[updateNodes.length - 1] || null;

  return {
    path,
    pathId: path.id,
    pathName: path.path_name,
    status: path.hypothesis_status || 'untested',
    nodes,
    experimentCount: expNodes.length,
    updateCount: updateNodes.length,
    hasHistory: Boolean(initial) || updateNodes.length > 0,
    current: {
      kind: 'current',
      decision: last?.decision || null,
      decisionLabel: last?.decisionLabel || null,
      status: path.hypothesis_status || 'untested',
      confidence: last?.confidenceAfter || (num(path.fit_confidence_score) !== null ? `${path.fit_confidence_score}%` : null),
      openUnknowns: carried,
      nextTest: last?.nextTest || '',
      changedAt: path.hypothesis_status_changed_at || null,
      modificationNote: path.hypothesis_modification_note || '',
    },
  };
}

/**
 * Cross-hypothesis evidence about the student: strength, direction and the
 * experiences behind each conclusion, so every line can be traced back.
 */
export function crossHypothesisEvidence(dimensions = []) {
  const groups = learningStatements(dimensions, { known: 6, open: 4 });
  const line = (d) => ({
    dimension: d.dimension,
    label: d.dimension_label,
    level: d.current_evidence_level,
    levelLabel: EVIDENCE_LEVEL_LABELS[d.current_evidence_level] || 'Unknown',
    statement: d.statement,
    count: d.evidence_count || 0,
    careers: d.careers_observed_in || [],
    sources: [...(d.behavioral_evidence || []), ...(d.contradictory_evidence || [])],
    raw: d,
  });
  return {
    confirmed: groups.knowing.map(line),
    suspected: groups.suspecting.map(line),
    conflicting: groups.conflicting.map(line),
    open: groups.open.map(line),
    experimentsBehind: new Set(
      dimensions.flatMap(d => [...(d.behavioral_evidence || []), ...(d.contradictory_evidence || [])].map(e => e.experiment_id).filter(Boolean))
    ).size,
  };
}

/** Where the record starts: what the student said before testing anything. */
export function originFrom(profile) {
  if (!profile) return null;
  return {
    clarity: profile.baseline_career_clarity ?? null,
    confidence: profile.baseline_confidence ?? null,
    considered: profile.current_careers_considered || [],
    ruledOut: profile.careers_ruled_out || [],
    uncertainties: profile.major_uncertainties || [],
    pressure: profile.current_decision_pressure || [],
    recordedAt: profile.baseline_recorded_at || profile.created_date || null,
  };
}

/** The whole record. Hypotheses most recently moved first. */
export function buildDecisionRecord({
  paths = [], experiments = [], missions = [], proof = [], reflections = [],
  measurements = {}, updates = [], profile = null, dimensions = [],
}) {
  const exps = experiments.filter(live);
  const mis = missions.filter(live);
  const prf = proof.filter(live);
  const refs = reflections.filter(live);

  const hypotheses = paths
    .filter(p => p && p.path_name)
    .map(p => buildChain({
      path: p,
      updates: updates.filter(u => u.path_id === p.id),
      experiments: exps, missions: mis, proof: prf, reflections: refs, measurements,
    }))
    .sort((a, b) => (b.updateCount - a.updateCount) || (b.experimentCount - a.experimentCount));

  return {
    origin: originFrom(profile),
    hypotheses,
    cross: crossHypothesisEvidence(dimensions),
    // A student whose activity predates the update history: their chains still
    // read, and the record says which parts were reconstructed.
    reconstructedOnly: hypotheses.length > 0 && hypotheses.every(h => !h.hasHistory),
    counts: {
      hypotheses: hypotheses.length,
      experiments: exps.length,
      evidence: prf.length,
      reflections: refs.length,
    },
  };
}

export default buildDecisionRecord;