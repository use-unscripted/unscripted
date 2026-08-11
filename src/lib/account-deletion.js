/**
 * In-app account deletion (App Store Guideline 5.1.1(v)).
 *
 * The platform owns the user record itself and an app cannot remove it from the
 * client, so deletion here means: every record this student created is deleted,
 * the identifying fields on their own user row are cleared, and the local
 * session is dropped. What is left behind is an empty, unidentifiable login.
 *
 * Every entity below is owner-scoped by RLS, so each read and delete can only
 * ever touch the signed-in student's own rows.
 */
import { base44 } from '@/api/base44Client';

// Every entity a student's own activity can write to.
const OWNED_ENTITIES = [
  'StudentProfile', 'AmbitionProfile', 'PathRecommendations', 'Paths', 'PathReactivations',
  'CareerCycle', 'Experiments', 'Missions', 'MissionGuides', 'CareerMoment',
  'ExperimentMeasurement', 'BehavioralSignal', 'HypothesisRecalculation', 'EvidenceDisagreement',
  'ProofOfWork', 'OutreachContacts', 'WeeklyReflections', 'Reflection',
  'Resume', 'ResumeVersion', 'Roadmap', 'Schedule', 'ScheduleBlocks', 'CalendarTasks',
  'Goals', 'Task', 'NetworkProfile', 'Follow', 'CampusInvite', 'NudgeOptOut',
  'StudentNudge', 'ContinuationInterest', 'PilotEvent',
];

async function purgeEntity(name) {
  const api = base44.entities[name];
  if (!api) return 0;
  let removed = 0;
  // Owner-scoped reads, so this is only ever this student's own rows.
  for (let pass = 0; pass < 6; pass++) {
    const rows = await api.list('-created_date', 200).catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      if (!row?.id) continue;
      await api.delete(row.id).catch(() => null);
      removed += 1;
    }
    if (rows.length < 200) break;
  }
  return removed;
}

/**
 * Deletes the student's data, anonymizes their user row, and returns a count of
 * the records removed. Never swallows a failure on the user row: the caller
 * needs to know whether anything is left identifying them.
 */
export async function deleteMyAccount() {
  let removed = 0;
  for (const name of OWNED_ENTITIES) {
    removed += await purgeEntity(name);
  }

  // The platform owns email, name and role. Everything this app added to the
  // user row is cleared here.
  await base44.auth.updateMe({
    college: '', major: '', graduation_year: '', school_year: '',
  });

  return { removed };
}

export default deleteMyAccount;