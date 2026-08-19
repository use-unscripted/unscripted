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
import { dimensionProgress, nextTestForPath } from '@/lib/dimension-progress';
import { decideReadiness, readinessMessage } from '@/lib/decide-readiness';
import { confidenceBand } from '@/lib/journey-focus';

export async function loadConvictionLab(pathId) {
  const profile = await loadEvidenceProfile();
  const entry = (profile.hypotheses || []).find(h => h.path?.id === pathId) || null;
  if (!entry) return null;

  const { path, hypothesis } = entry;
  const progress = dimensionProgress({ hypothesis, signals: profile.signals || [] });
  const readiness = decideReadiness(progress);

  return {
    path,
    hypothesis,
    progress,
    readiness,
    message: readinessMessage(readiness),
    confidenceBand: confidenceBand(hypothesis.fit_confidence_score),
    confidence: hypothesis.fit_confidence_score ?? null,
    nextTest: progress ? nextTestForPath({ path, hypothesis, progress }) : null,
  };
}