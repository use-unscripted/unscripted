/**
 * One read pass for the Career Decision Matrix.
 *
 * Everything comes from records that already exist: the Career Evidence Profile
 * loader supplies the hypotheses, measurements, experiments and proof; the
 * HypothesisUpdate chain supplies
 * the history the graph and the trend are read from. Nothing is written.
 */
import { base44 } from '@/api/base44Client';
import { loadEvidenceProfile } from '@/lib/evidence-profile';
import { deriveDimensions } from '@/lib/career-dimensions';
import { scoreHypothesis, workstyleRows, changedMind, claritySummary, strongestOf } from '@/lib/decision-matrix';

const ELIMINATED = ['eliminated', 'archived', 'modified'];

export async function loadDecisionMatrix() {
  const [profileData, reflections, updates] = await Promise.all([
    loadEvidenceProfile(),
    base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
    base44.entities.HypothesisUpdate.list('-created_date', 300).catch(() => []),
  ]);

  const { hypotheses, experiments, measurements, proof, profile, signals } = profileData;
  const dimensions = deriveDimensions({ signals, profile });
  const data = { experiments, measurements, proof, reflections };

  const rows = hypotheses.map(({ path, hypothesis }) => scoreHypothesis({
    path,
    hypothesis,
    dimensions,
    updates: (Array.isArray(updates) ? updates : []).filter(u => u.path_id === path.id),
    data,
  }));

  const active = rows.filter(r => !ELIMINATED.includes(r.status));
  const history = rows.filter(r => ELIMINATED.includes(r.status));

  return {
    onboarded: Boolean(profile?.name) || rows.length > 0,
    hasHypotheses: rows.length > 0,
    completedExperiments: profileData.counts.completedExperiments,
    measuredExperiments: profileData.counts.measuredExperiments,
    rows,
    active,
    history,
    workstyle: workstyleRows(dimensions),
    changed: changedMind({ measurements, experiments }),
    clarity: claritySummary({ profile, reflections, rows, dimensions }),
    strongest: strongestOf(active),
  };
}

export default loadDecisionMatrix;