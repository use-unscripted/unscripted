/**
 * The Conviction Lab's view model for ONE path.
 *
 * Nothing here is a new system. It reads the Career Evidence Profile that
 * already exists, takes the hypothesis for the requested path out of it, and
 * asks the two questions the Lab exists to answer:
 *
 *   - what does this path still need evidence on (dimension-progress)
 *   - is that enough to decide on yet (decide-readiness, the same gate the
 *     Decide stage uses)
 *
 * No records are written, no scores are recalculated, and no path, experiment,
 * evidence or matrix state is duplicated.
 */
import { loadEvidenceProfile } from '@/lib/evidence-profile';
import { loadStudentContext } from '@/lib/student-context';
import { dimensionProgress, nextTestForPath } from '@/lib/dimension-progress';
import { decideReadiness, readinessMessage } from '@/lib/decide-readiness';
import { confidenceBand } from '@/lib/journey-focus';
import { buildConvictionRecord } from '@/lib/conviction-record';
import { pickConvictionGap } from '@/lib/conviction-gap';
import { buildExpectationEvidence } from '@/lib/conviction-expectations';
import { buildTensions } from '@/lib/tension-signals';
import { buildTradeoffs } from '@/lib/tradeoffs';
import { buildDifferentiator } from '@/lib/path-differentiator';
import { decisionReadinessState } from '@/lib/decision-readiness-state';
import { buildConvictionReview } from '@/lib/conviction-review';
import { buildChangeOfMind } from '@/lib/change-your-mind';
import { buildGapRoster } from '@/lib/conviction-gap-roster';
import { base44 } from '@/api/base44Client';

export async function loadConvictionLab(pathId) {
  /* One read wave, shared: the profile is built from the same context the
     Conviction Record counts its evidence out of. */
  const context = await loadStudentContext();
  const profile = await loadEvidenceProfile({ context });
  const entry = (profile.hypotheses || []).find(h => h.path?.id === pathId) || null;
  if (!entry) return null;

  const { path, hypothesis } = entry;
  const signals = profile.signals || [];
  const progress = dimensionProgress({ hypothesis, signals });
  const readiness = decideReadiness(progress);

  /* The student's other paths, so "compared against your alternatives" reads the
     existing hypotheses rather than a second set of scores. */
  const others = (profile.hypotheses || [])
    .filter(h => h.path?.id !== pathId)
    .map(h => ({
      path: h.path,
      hypothesis: h.hypothesis,
      progress: dimensionProgress({ hypothesis: h.hypothesis, signals }),
    }));
  const alternatives = others.map(o => ({
    name: o.path.path_name,
    testedCount: o.progress?.testedCount || 0,
  }));

  /* With a second credible path on file, the most useful difference to test
     between them, read off both paths' existing dimension readings. */
  const comparison = buildDifferentiator({
    primary: { path, hypothesis, progress },
    others,
  });

  const record = buildConvictionRecord({ path, hypothesis, progress, readiness, context, alternatives });
  const nextTest = progress ? nextTestForPath({ path, hypothesis, progress }) : null;

  /* Where this student's own evidence disagrees with itself. Read-only, and it
     never feeds Path Confidence — that stays with evidence-contradictions.js,
     which caps how far conflicting readings can move it. */
  const [scenarioResponses, dimensions, blueprints, stances, gapOutcomes] = await Promise.all([
    base44.entities.ScenarioResponse.list('-created_date', 200).catch(() => []),
    base44.entities.CareerDimensionEvidence.list('-created_date', 200).catch(() => []),
    base44.entities.RoleBlueprint.list('-created_date', 200).catch(() => []),
    base44.entities.TradeoffStance.filter({ path_id: pathId }, '-updated_at', 100).catch(() => []),
    base44.entities.ConvictionGapOutcome.filter({ path_id: pathId }, '-targeted_at', 200).catch(() => []),
  ]);
  const tensions = buildTensions({
    path,
    context,
    scenarioResponses: Array.isArray(scenarioResponses) ? scenarioResponses : [],
    dimensions: Array.isArray(dimensions) ? dimensions : [],
  });

  const norm = (s) => String(s || '').toLowerCase().trim();
  const blueprint = (Array.isArray(blueprints) ? blueprints : []).find(
    b => b.path_id === pathId || norm(b.career_title) === norm(path.path_name),
  ) || null;
  const tradeoffs = buildTradeoffs({
    path,
    blueprint,
    stances: Array.isArray(stances) ? stances : [],
  });

  const decisionReadiness = decisionReadinessState({ record, progress, tensions, tradeoffs });

  return {
    path,
    hypothesis,
    progress,
    readiness,
    /* The raw per-characteristic readings, so a consumer can ask the existing
       contradiction check about them rather than re-deriving anything. */
    signals,
    /* One concise read of this path, assembled from the blocks above. */
    review: buildConvictionReview({
      path, hypothesis, progress, tradeoffs, tensions, nextTest,
      readiness: decisionReadiness, context,
    }),
    record,
    /* What this path's tests said they would feel like, against what they did. */
    expectations: buildExpectationEvidence({ pathName: path.path_name, context }),
    /* The one thing this path most needs next, read off the record above. Its
       dimension is handed to the Next Best Test engine so both agree. */
    tensions,
    /* The costs and conditions recorded for this work, and where the student
       stands on each. Grounded only in the blueprint or the path's own record. */
    tradeoffs,
    comparison,
    /* Where this path stands on Decision Readiness: a state read off the
       diversity of the evidence above, never one percentage threshold. */
    decisionReadiness,
    gap: pickConvictionGap({ record, progress, nextTest, tensions, tradeoffs }),
    /* All eight student-facing gaps with a derived state each. Nothing stored. */
    gapRoster: buildGapRoster({
      progress,
      record,
      outcomes: Array.isArray(gapOutcomes) ? gapOutcomes : [],
    }),
    /* The assumption most likely to weaken this path if tested, pointed at the
       same next test. Challenges the leading path rather than confirming it. */
    changeOfMind: buildChangeOfMind({ progress, tensions, tradeoffs, nextTest }),
    message: readinessMessage(readiness),
    confidenceBand: confidenceBand(hypothesis.fit_confidence_score),
    confidence: hypothesis.fit_confidence_score ?? null,
    nextTest,
  };
}