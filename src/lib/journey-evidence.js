/**
 * The dashboard's read of the Career Evidence Profile.
 *
 * Read-only, and deliberately thin: the profile page already assembles the
 * graph, the hypotheses and the patterns, so My Journey reuses that rather than
 * deriving a second, slightly different version of the same numbers.
 *
 * Every count here comes from records that exist. Nothing is estimated, and a
 * section with nothing behind it is simply not returned.
 */
import { loadEvidenceProfile } from '@/lib/evidence-profile';
import { HYPOTHESIS_STATUS_LABELS } from '@/lib/career-hypothesis';
import { MEANINGFUL_CHANGE } from '@/lib/hypothesis-recalculation';
import {
  dimensionProgress, nextTestForPath, crossCareerPatterns, weeklyEvidence, evidenceMilestones,
} from '@/lib/dimension-progress';

export { HYPOTHESIS_STATUS_LABELS };

export async function loadJourneyEvidence() {
  const p = await loadEvidenceProfile();

  const hypotheses = p.hypotheses.map(({ path, hypothesis }) => {
    // What has and has not been tested, read from the uncertainty map and the
    // rated characteristic signals. Nothing new is modelled here.
    const progress = dimensionProgress({ hypothesis, signals: p.signals || [] });
    return {
      id: path.id,
      name: path.path_name,
      category: path.path_category || '',
      fit: hypothesis.career_fit_score,
      confidence: hypothesis.fit_confidence_score,
      status: hypothesis.hypothesis_status,
      statusLabel: HYPOTHESIS_STATUS_LABELS[hypothesis.hypothesis_status] || 'Testing',
      progress,
      nextTest: progress ? nextTestForPath({ path, hypothesis, progress }) : null,
    };
  });

  // Only careers whose estimate actually moved, most recent first.
  const changes = Object.values(p.recalculations || {})
    .filter(r => typeof r?.before?.career_fit_score === 'number'
      && typeof r?.after?.career_fit_score === 'number'
      && Math.abs(r.after.career_fit_score - r.before.career_fit_score) >= MEANINGFUL_CHANGE)
    .sort((a, b) => new Date(b.recalculated_at || b.created_date) - new Date(a.recalculated_at || a.created_date))
    .map(r => ({
      id: r.id,
      pathName: r.path_name,
      before: r.before.career_fit_score,
      after: r.after.career_fit_score,
      confidenceAfter: r.after.fit_confidence_score ?? null,
    }));

  return {
    hypotheses,
    changes,
    // Only shown when several careers share the same measured characteristic.
    crossCareer: crossCareerPatterns({ signals: p.signals || [] }),
    week: weeklyEvidence({
      experiments: p.experiments,
      measurements: p.measurements,
      signals: p.signals || [],
      recalculations: p.recalculations,
    }),
    milestones: evidenceMilestones({
      progressList: hypotheses,
      recalculations: p.recalculations,
      completedExperiments: p.counts.completedExperiments,
    }),
    counts: {
      // Completed experiments, not started ones.
      experiments: p.counts.completedExperiments,
      // An ability only counts once something the student did put it there.
      strengths: p.abilities.filter(a => (a.sources || []).some(s => s.kind !== 'onboarding')).length,
      // Measured twice or more, so a single rating is never called a preference.
      preferences: p.preferences.filter(x => x.status === 'observed').length,
      openQuestions: p.openQuestions.filter(q => !q.tested).length,
    },
  };
}