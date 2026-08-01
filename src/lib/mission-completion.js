/**
 * Mission completion with contextual proof.
 *
 * One call takes the student's answer to "what demonstrates that you completed
 * this?" and does everything: creates the proof already linked to user + cycle +
 * path + experiment + mission, marks the mission complete, and rolls the
 * experiment forward when its last mission lands.
 *
 * Idempotency, by construction:
 *   · the whole sequence runs once per mission even under double-clicks
 *   · the completion proof carries submission_key `complete:<missionId>`, and an
 *     existing record with that key is REUSED rather than duplicated
 *   · an already-completed mission is never re-completed
 *   · uploads happen in the caller and are passed in, so a retry re-uses the
 *     already-uploaded file rather than uploading it again
 * Nothing here deletes or rewrites existing proof history.
 */
import { base44 } from '@/api/base44Client';
import { onceInFlight, linksForExperiment } from '@/lib/career-cycle';
import { trackPilotEvent } from '@/lib/pilot-metrics';

export const EVIDENCE_TYPES = [
  { key: 'file', label: 'File', category: 'other' },
  { key: 'screenshot', label: 'Screenshot', category: 'screenshot' },
  { key: 'link', label: 'Link', category: 'other' },
  { key: 'interview_notes', label: 'Interview notes', category: 'interview_notes' },
  { key: 'presentation', label: 'Presentation', category: 'presentation' },
  { key: 'spreadsheet', label: 'Spreadsheet', category: 'spreadsheet' },
  { key: 'report', label: 'Report', category: 'report' },
  { key: 'written_summary', label: 'Written summary', category: 'written_summary' },
  { key: 'other', label: 'Other', category: 'other' },
];

export function categoryForEvidence(typeKey) {
  return EVIDENCE_TYPES.find(t => t.key === typeKey)?.category || 'other';
}

/** The one completion proof for a mission, if it already exists. */
async function existingCompletionProof(missionId) {
  const rows = await base44.entities.ProofOfWork
    .filter({ submission_key: `complete:${missionId}` }, '-created_date', 5)
    .catch(() => []);
  return (Array.isArray(rows) ? rows : []).find(r => r.deletion_status !== 'deleted') || null;
}

/**
 * @param {object} p
 * @param {object} p.mission
 * @param {object} p.experiment
 * @param {object} [p.path]
 * @param {object} p.evidence { type, title, description, external_url, file }
 *        file: { file_url, file_name, file_size, mime_type } already uploaded
 * @returns {Promise<{proof: object, mission: object, experimentCompleted: boolean, reused: boolean}>}
 */
export function completeMissionWithProof({ mission, experiment, path, evidence }) {
  if (!mission?.id) throw new Error('No mission to complete.');
  if (!evidence?.type) throw new Error('Choose what demonstrates this.');

  return onceInFlight(`complete-mission:${mission.id}`, async () => {
    const links = await linksForExperiment(experiment, mission);

    // 1 — proof, reused if this mission was already evidenced.
    let proof = await existingCompletionProof(mission.id);
    const reused = !!proof;
    if (!proof) {
      proof = await base44.entities.ProofOfWork.create({
        ...links,
        path_id: links.path_id || path?.id,
        submission_key: `complete:${mission.id}`,
        title: evidence.title || mission.title,
        category: categoryForEvidence(evidence.type),
        path_tested: experiment?.path_name || path?.path_name,
        description: evidence.description || undefined,
        external_url: evidence.external_url || undefined,
        file_url: evidence.file?.file_url,
        file_name: evidence.file?.file_name,
        file_size: evidence.file?.file_size,
        mime_type: evidence.file?.mime_type,
        completion_note: evidence.description || undefined,
        completed_at: new Date().toISOString().split('T')[0],
      });
    }

    // 2 — mission status, only if it isn't already complete.
    let updatedMission = mission;
    if (mission.status !== 'completed') {
      updatedMission = await base44.entities.Missions.update(mission.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    // 3 — experiment progress: it completes when no open mission is left.
    let experimentCompleted = false;
    if (experiment?.id) {
      const siblings = await base44.entities.Missions
        .filter({ experiment_id: experiment.id }, '-created_date', 100)
        .catch(() => []);
      const open = (Array.isArray(siblings) ? siblings : []).filter(
        m => m.deletion_status !== 'deleted'
          && m.id !== mission.id
          && !['completed', 'skipped'].includes(m.status)
      );
      if (open.length === 0 && experiment.status !== 'completed') {
        await base44.entities.Experiments.update(experiment.id, { status: 'completed' });
        experimentCompleted = true;
      } else if (experiment.status === 'planned') {
        await base44.entities.Experiments.update(experiment.id, { status: 'in_progress' });
      }
    }

    // Measurement — ids only, once per mission and once per proof.
    await trackPilotEvent('proof_submitted', {
      cycle_id: links.cycle_id, path_id: links.path_id, experiment_id: experiment?.id,
      mission_id: mission.id, dedupe_key: proof.id,
    });
    await trackPilotEvent('mission_completed', {
      cycle_id: links.cycle_id, path_id: links.path_id, experiment_id: experiment?.id,
      mission_id: mission.id, dedupe_key: mission.id,
    });

    return { proof, mission: updatedMission, experimentCompleted, reused };
  });
}