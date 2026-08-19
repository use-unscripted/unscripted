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
  const alternatives = (profile.hypotheses || [])
    .filter(h => h.path?.id !== pathId)
    .map(h => ({
      name: h.path.path_name,
      testedCount: dimensionProgress({ hypothesis: h.hypothesis, signals })?.testedCount || 0,
    }));

  const record = buildConvictionRecord({ path, hypothesis, progress, readiness, context, alternatives });
  const nextTest = progress ? nextTestForPath({ path, hypothesis, progress }) : null;

  return {
    path,
    hypothesis,
    progress,
    readiness,
    record,
    /* The one thing this path most needs next, read off the record above. Its
       dimension is handed to the Next Best Test engine so both agree. */
    gap: pickConvictionGap({ record, progress, nextTest }),
    message: readinessMessage(readiness),
    confidenceBand: confidenceBand(hypothesis.fit_confidence_score),
    confidence: hypothesis.fit_confidence_score ?? null,
    nextTest,
  };
}