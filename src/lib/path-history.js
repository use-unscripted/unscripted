/**
 * One Path, many tests — read longitudinally.
 *
 * A Path is a single persistent object that accumulates evidence across as many
 * cycles as the student runs on it. This module answers, for ONE path:
 *
 *   How many tests have been completed? How much of what matters here has
 *   evidence behind it? What is the strongest and the most contradictory thing
 *   we know? What do we still not know? What is worth testing next?
 *
 * It adds no new model. Confidence comes from the Career Hypothesis layer,
 * coverage from the existing dimension progress, history from the hypothesis
 * updates the reflection flow already appends, and the cycle spine from
 * CareerCycle. Nothing is written here.
 */
import { base44 } from '@/api/base44Client';
import { loadRecalculationContext } from '@/lib/hypothesis-recalculation';
import { deriveHypothesis } from '@/lib/career-hypothesis';
import { dimensionProgress } from '@/lib/dimension-progress';

const live = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r?.deletion_status !== 'deleted');
const asc = (a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0);

/** Experiments that belong to this path, however they were linked. */
export function experimentsForPath(experiments, path) {
  return live(experiments).filter(e =>
    e.path_id === path.id
    || e.career_hypothesis_id === path.id
    || e.path_recommendation_id === path.id
    || (path.path_name && e.path_name === path.path_name));
}

/**
 * The full longitudinal view of one path.
 * Returns null when the path is not the student's own.
 */
export async function loadPathHistory(pathId) {
  if (!pathId) return null;
  const [ctx, cycleRows, updateRows] = await Promise.all([
    loadRecalculationContext(),
    base44.entities.CareerCycle.list('-created_date', 100).catch(() => []),
    base44.entities.HypothesisUpdate.list('-created_date', 100).catch(() => []),
  ]);

  const path = (ctx.paths || []).find(p => p.id === pathId);
  if (!path) return null;

  const hypothesis = deriveHypothesis(path, ctx);
  const progress = dimensionProgress({ hypothesis, signals: ctx.signals || [] });
  const experiments = experimentsForPath(ctx.experiments, path);
  const completed = experiments.filter(e => e.status === 'completed');
  const measured = completed.filter(e => ctx.measurements?.[e.id]?.post_completed_at);

  const cycles = (Array.isArray(cycleRows) ? cycleRows : [])
    .filter(c => c.selected_path_id === pathId)
    .sort(asc);
  const updates = (Array.isArray(updateRows) ? updateRows : [])
    .filter(u => u.path_id === pathId && u.stage !== 'initial')
    .sort(asc);

  /* The chronological story: one entry per recorded hypothesis update, which is
     exactly one per concluded test. Each says what was tested and what changed —
     the change is the point, so a test that lowered confidence reads as a
     result, not a setback. */
  const timeline = updates.map((u, i) => ({
    id: u.id,
    number: i + 1,
    date: u.recorded_at || u.created_date,
    experimentTitle: u.experiment_title || 'A test on this path',
    tested: u.test_question || '',
    learned: u.ai_synthesis || u.rationale || u.hypothesis_statement || '',
    outcome: u.evidence_outcome || null,
    decision: u.decision || null,
    confidenceBefore: typeof u.confidence_before === 'number' ? u.confidence_before : null,
    confidenceAfter: typeof u.confidence_after === 'number' ? u.confidence_after : null,
    remaining: (u.remaining_unknowns || []).slice(0, 3),
  }));

  const nextUnknown = progress
    ? (progress.untested[0] || progress.partial[0] || progress.tested.find(t => t.contradicted) || null)
    : null;

  return {
    path,
    hypothesis,
    progress,
    cycles,
    /* Tests the student actually concluded. Recorded updates are the honest
       count: creating or opening an experiment is not a test. */
    testsCompleted: timeline.length || measured.length,
    experimentsCompleted: completed.length,
    coverage: coverageOf(progress),
    confidence: typeof hypothesis.fit_confidence_score === 'number' ? hypothesis.fit_confidence_score : null,
    fit: typeof hypothesis.career_fit_score === 'number' ? hypothesis.career_fit_score : null,
    strongest: (hypothesis.supporting_evidence || []).slice(0, 3),
    contradictory: (hypothesis.contradicting_evidence || []).slice(0, 3),
    unknownRows: progress?.rows || [],
    stillUnknown: [...(progress?.untested || []), ...(progress?.partial || [])].slice(0, 5),
    nextUnknown,
    timeline,
  };
}

/** Share of the dimensions that matter here which now have evidence, 0–100. */
export function coverageOf(progress) {
  if (!progress || !progress.total) return null;
  const partialCredit = progress.partial.length * 0.5;
  return Math.round(((progress.testedCount + partialCredit) / progress.total) * 100);
}

/**
 * The numbers a closing cycle should keep, so the path's history can later be
 * read as a sequence of readings rather than a single current score.
 */
export async function cycleOutcomeFor(pathId) {
  const history = await loadPathHistory(pathId).catch(() => null);
  if (!history) return {};
  return {
    resulting_path_confidence: history.confidence ?? undefined,
    resulting_evidence_coverage: history.coverage ?? undefined,
    next_unknown_id: history.nextUnknown?.id || undefined,
    next_unknown_label: history.nextUnknown?.label || undefined,
  };
}