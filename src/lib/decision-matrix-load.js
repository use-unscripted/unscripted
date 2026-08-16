/**
 * One read pass for the Career Decision Matrix.
 *
 * Everything comes from records that already exist: the shared student context
 * supplies the paths, measurements, experiments and proof; the HypothesisUpdate
 * chain supplies the history the graph and the trend are read from. Nothing is
 * written.
 *
 * Everything the page and its panels need is fetched in ONE parallel wave here,
 * including the reads the page and its children each used to fire for
 * themselves: scenario responses, Human Reality conversations, the stored
 * dimension rows and the evidence-weight configuration. That removes four
 * sequential waves and around eighteen duplicate requests, and it also means the
 * weight configuration is applied BEFORE anything is scored rather than racing
 * the scoring.
 */
import { base44 } from '@/api/base44Client';
import { loadStudentContext } from '@/lib/student-context';
import { loadEvidenceProfile } from '@/lib/evidence-profile';
import { deriveDimensions } from '@/lib/career-dimensions';
import { loadConversations } from '@/lib/human-reality';
import { loadDimensionEvidence } from '@/lib/career-dimensions-store';
import { loadEvidenceConfig } from '@/lib/evidence-weights';
import { scoreHypothesis, workstyleRows, changedMind, claritySummary, strongestOf } from '@/lib/decision-matrix';

const ELIMINATED = ['eliminated', 'archived', 'modified'];

export async function loadDecisionMatrix() {
  const [context, updates, scenarioResponses, conversations, dimensionMap] = await Promise.all([
    loadStudentContext(),
    base44.entities.HypothesisUpdate.list('-created_date', 300).catch(() => []),
    base44.entities.ScenarioResponse.list('-completed_at', 200).catch(() => []),
    loadConversations().catch(() => []),
    loadDimensionEvidence().catch(() => ({})),
    // Admin-tuned weights, applied before scoring. Falls back to the coded
    // defaults, which is what every account without a stored row reads under.
    loadEvidenceConfig().catch(() => null),
  ]);

  // No network: the context above is everything it reads.
  const profileData = await loadEvidenceProfile({ context });

  const { hypotheses, experiments, measurements, proof, profile, signals } = profileData;
  const dimensions = deriveDimensions({ signals, profile });
  const reflections = context.reflections;
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
    /* Handed to the panels that used to fetch these for themselves, so the
       scenario, Human Reality and next-test panels render from the same records
       the scores above were read from. */
    scenarioResponses: Array.isArray(scenarioResponses) ? scenarioResponses : [],
    conversations,
    dimensionMap,
    context: { ...context, scenarioResponses: Array.isArray(scenarioResponses) ? scenarioResponses : [] },
  };
}

export default loadDecisionMatrix;