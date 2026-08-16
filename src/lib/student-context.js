/**
 * One read pass for everything derived from a student's own records.
 *
 * Why this exists: the Career Decision Matrix, the Career Evidence Profile, the
 * recalculation engine and the Next Best Experiment engine each used to load the
 * SAME six lists for themselves. On one Matrix load that measured as
 * Experiments x3, PathRecommendations x3, WeeklyReflections x4, ProofOfWork x3,
 * StudentProfile x3, ExperimentMeasurement x3 and User x4 — and because each
 * consumer only started after the component above it had finished, those
 * duplicates arrived as four or five sequential waves rather than one.
 *
 * Nothing here changes what any of those numbers mean. It is the same entities,
 * the same sort orders, the same limits and the same derived `signals`, fetched
 * once in a single parallel wave and handed to every consumer.
 *
 * Two path views are returned on purpose, because the callers genuinely differ:
 *  - `paths` is the newest 200 rows exactly as the recalculation engine read
 *    them (unfiltered): the newest 200 of a newest-500 query is byte-for-byte
 *    what a limit-200 query returns, since both are sorted -created_date.
 *  - `ownedPaths` is the profile's stricter view: rows this user owns, with
 *    rows merged away by the data-integrity pass excluded.
 *
 * Deliberately NOT cached between mounts: these are the student's own scores,
 * and a stale score is worse than a slow one.
 */
import { base44 } from '@/api/base44Client';
import { loadMeasurements } from '@/lib/experiment-measurement';
import { characteristicSignals } from '@/lib/evidence-patterns';

const live = (rows) => (Array.isArray(rows) ? rows : []).filter(
  r => r?.deletion_status !== 'deleted' && r?.deletion_status !== 'permanently_deleted');

/** Every record the evidence engines read, in one parallel wave. */
export async function loadStudentContext() {
  const [user, pathRows, exps, refs, prf, profs, flags, measurements, recalcRows] = await Promise.all([
    base44.auth.me().catch(() => ({})),
    base44.entities.PathRecommendations.list('-created_date', 500).catch(() => []),
    base44.entities.Experiments.list('-created_date', 200).catch(() => []),
    base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
    base44.entities.ProofOfWork.list('-created_date', 200).catch(() => []),
    base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
    base44.entities.EvidenceDisagreement.list('-created_date', 200).catch(() => []),
    loadMeasurements().catch(() => ({})),
    base44.entities.HypothesisRecalculation.list('-created_date', 200).catch(() => []),
  ]);

  const experiments = live(exps);
  const reflections = live(refs);
  const proof = live(prf);
  const rows = Array.isArray(pathRows) ? pathRows : [];

  // The last recorded change per career. Same reduction loadLatestRecalculations
  // performs, over the same query.
  const recalculations = {};
  (Array.isArray(recalcRows) ? recalcRows : []).forEach(r => {
    if (r.path_id && !recalculations[r.path_id]) recalculations[r.path_id] = r;
  });

  return {
    user,
    experiments,
    reflections,
    proof,
    measurements,
    // Rated work characteristics. Every consumer computed this from the same
    // three inputs, so it is computed once.
    signals: characteristicSignals({ experiments, measurements, reflections }),
    profile: (Array.isArray(profs) ? profs[0] : null) || {},
    paths: rows.slice(0, 200),
    ownedPaths: rows.filter(r => r
      && (r.created_by_id === user?.id || r.user_id === user?.id)
      && r.integrity_status !== 'merged'),
    disagreements: Array.isArray(flags) ? flags : [],
    recalculations,
  };
}

export default loadStudentContext;