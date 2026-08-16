/**
 * Assembles the Career Evidence Profile.
 *
 * This module only reads. The Career Hypothesis layer, the Career Uncertainty
 * Map and the pre/post measurement rows are already the source of truth, and
 * recalculating any of them belongs to a later change, so nothing here writes
 * back to them. The one thing it does write is a disagreement, and a
 * disagreement never deletes evidence: it is recorded alongside it as another
 * piece of information to reconcile through future experiments.
 *
 * Everything is private to the signed-in student. There is no sharing surface.
 */
import { base44 } from '@/api/base44Client';
import { deriveHypothesis } from '@/lib/career-hypothesis';
import { loadStudentContext } from '@/lib/student-context';
import { buildRecordGraph, summarizeEvidence, evidenceSource } from '@/lib/evidence-graph';
import { deriveAbilities, linkAbilities } from '@/lib/evidence-abilities';
import { derivePreferences, deriveEnergyPatterns, linkPatterns } from '@/lib/evidence-patterns';
import { linkFitDimensions } from '@/lib/career-fit-dimensions';

/**
 * Everything the profile needs, in one pass.
 *
 * `context` is the shared student context (see @/lib/student-context). Passing
 * one in makes this function do no network work at all, which is how the Career
 * Decision Matrix now builds the profile and the matrix from a single read wave
 * instead of two. Loading it here is the standalone path, and both produce the
 * same records: the measurements and the recalculations used to be a SECOND
 * serial wave after the six lists, and are now in the same parallel one.
 */
export async function loadEvidenceProfile({ context = null } = {}) {
  const loaded = context || await loadStudentContext();
  const { user, measurements, recalculations, profile } = loaded;
  const flags = loaded.disagreements;
  const paths = loaded.ownedPaths.filter(p => p.status !== 'archived');
  const experiments = loaded.experiments;
  const reflections = loaded.reflections;
  const proof = loaded.proof;

  const graph = buildRecordGraph({ user, paths, experiments, measurements, reflections, proof });

  // Rated work characteristics, needed by both the fit dimensions and the
  // preference/pattern sections. Computed once in the shared context, from the
  // same three inputs this line used to pass.
  const signals = loaded.signals;

  // Career hypotheses, read straight from the existing layer. Measurements and
  // signals go in so ability and enjoyment can be scored as separate dimensions.
  const ctx = { experiments, proof, reflections, profile, measurements, signals };
  const hypotheses = paths.map(p => {
    const h = deriveHypothesis(p, ctx);
    const pathExps = experiments.filter(e => e.path_name === p.path_name);
    const expIds = new Set(pathExps.map(e => e.id));
    const sources = [
      ...pathExps.filter(e => e.status === 'completed').map(e => evidenceSource({
        kind: 'experiment', detail: e.title, date: e.updated_date || e.created_date,
        link: `/experiments?experimentId=${e.id}`, nodeId: `experiment:${e.id}`,
      })),
      ...proof.filter(x => x.path_tested === p.path_name || expIds.has(x.experiment_id)).map(x => evidenceSource({
        kind: 'proof', detail: x.title, date: x.completed_at || x.created_date,
        link: '/evidence?tab=proof', nodeId: `proof:${x.id}`,
      })),
      ...reflections.filter(r => r.path_name === p.path_name || expIds.has(r.experiment_id)).map(r => evidenceSource({
        kind: 'reflection', detail: r.path_name ? `Reflection on ${r.path_name}` : 'Reflection',
        date: r.created_date, link: '/evidence?tab=reflect', nodeId: `reflection:${r.id}`,
      })),
      ...(h.supporting_evidence || []).filter(s => /onboarding|goals/i.test(s.source || '')).map(s => evidenceSource({
        kind: 'onboarding', detail: s.text, date: profile.created_date, link: '/profile', nodeId: 'user',
      })),
    ];
    return { path: p, hypothesis: h, sources, summary: summarizeEvidence(sources) };
  }).sort((a, b) => b.hypothesis.career_fit_score - a.hypothesis.career_fit_score);

  // Abilities and patterns, both traceable back into the record graph.
  const abilities = deriveAbilities({ experiments, measurements, proof, profile });
  const preferences = derivePreferences({ signals, profile });
  const { energisers, drains } = deriveEnergyPatterns(signals);
  linkAbilities(graph, abilities);
  linkPatterns(graph, { preferences, energisers, drains });
  // Each career's fit dimensions, with an edge from every piece of evidence
  // behind them, so ability evidence and enjoyment evidence stay distinguishable.
  hypotheses.forEach(({ path, hypothesis }) => linkFitDimensions(graph, path.id, hypothesis.fit));

  // Experiment history, with the measured outcome attached where it exists.
  const history = experiments
    .filter(e => e.status === 'completed')
    .map(e => ({ experiment: e, measurement: measurements[e.id] || null }))
    .sort((a, b) => new Date(b.experiment.updated_date || b.experiment.created_date) - new Date(a.experiment.updated_date || a.experiment.created_date));

  // Open questions, taken from each hypothesis's uncertainty map.
  const openQuestions = [];
  hypotheses.forEach(({ path, hypothesis }) => {
    (hypothesis.uncertainty?.top_unknowns || []).forEach(v => {
      openQuestions.push({
        key: `${path.id}:${v.variable}`,
        question: v.question,
        career: path.path_name,
        careerId: path.id,
        label: v.label,
        tested: v.evidence_strength >= 25,
        relevance: v.relevance,
      });
    });
    (hypothesis.unresolved_questions || []).slice(0, 2).forEach((q, i) => {
      if (!openQuestions.some(o => o.question === q.question)) {
        openQuestions.push({ key: `${path.id}:q${i}`, question: q.question, career: path.path_name, careerId: path.id, label: q.why_it_matters, tested: false, relevance: 'medium' });
      }
    });
  });

  return {
    user, profile, graph, hypotheses, abilities, preferences, energisers, drains, history,
    proof, experiments, measurements,
    // The rated work characteristics, so callers can read per-dimension evidence
    // without recomputing a second, slightly different version of it.
    signals,
    // The last recorded change per career, so no score has moved invisibly.
    recalculations,
    openQuestions: openQuestions.slice(0, 10),
    disagreements: Array.isArray(flags) ? flags : [],
    counts: {
      completedExperiments: history.length,
      measuredExperiments: history.filter(h => h.measurement?.post_completed_at).length,
      proof: proof.length,
      reflections: reflections.length,
      graph: graph.stats(),
    },
  };
}

/**
 * Record that a conclusion does not feel accurate.
 * Nothing is erased. The flag becomes evidence of its own, to be reconciled by
 * what the student does next.
 */
export async function flagDisagreement({ conclusion_type, conclusion_key, conclusion_label, note }) {
  const user = await base44.auth.me().catch(() => ({}));
  return base44.entities.EvidenceDisagreement.create({
    user_id: user?.id,
    conclusion_type,
    conclusion_key,
    conclusion_label: conclusion_label || '',
    note: (note || '').trim() || undefined,
    status: 'open',
    flagged_at: new Date().toISOString(),
  });
}