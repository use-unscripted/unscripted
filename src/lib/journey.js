/**
 * Journey stage resolution.
 *
 * One centralized six-stage journey: Explore → Choose → Test → Prove → Reflect → Decide.
 * Stage is DERIVED from records the student already has — nothing new is stored, so this
 * reads correctly for existing accounts with legacy data.
 */

import { resolveCurrentPath } from '@/lib/current-path';

export const STAGES = [
  /* Explore and Choose used to be two screens showing the same three paths with
     the same button, so they are one stage: read them, pick one. */
  /* `instruction` is the one thing to do on this screen, in plain words. It sits
     at the top of the stage as the "you are here, do this next" line, so a
     student never has to work out which of the panels below is the real task. */
  { key: 'choose',  label: 'Choose',  question: 'Which path am I testing first?',            instruction: 'Pick the one path you want to test first.' },
  { key: 'test',    label: 'Test',    question: 'What am I actually doing this week?',        instruction: 'Do the work in your experiment.' },
  { key: 'prove',   label: 'Prove',   question: 'What evidence did I create?',                instruction: 'Record what you produced.' },
  { key: 'reflect', label: 'Reflect', question: 'What did I learn about the fit?',            instruction: 'Say what you learned about the fit.' },
  { key: 'decide',  label: 'Decide',  question: 'Do I continue, or test something else?',     instruction: 'Decide whether to continue on this path.' },
];

export const STAGE_INDEX = STAGES.reduce((a, s, i) => ({ ...a, [s.key]: i }), {});

const ACTIVE_PATH_STATUSES = ['active', 'exploring', 'draft'];

/**
 * @returns {{
 *   stage: string, currentPath: object|null, nextExperiment: object|null,
 *   counts: object, action: {label: string, to?: string, anchor?: string, sub: string}
 * }}
 */
export function resolveJourney({ paths = [], experiments = [], proof = [], reflections = [], cycle = null }) {
  const livePaths = paths.filter(p => !['archived'].includes(p.status) && p.integrity_status !== 'merged');
  /* Source of truth: the active cycle's selected_path_id. is_primary_focus is
     derived display state and is used only as the fallback for an account with
     no cycle. See src/lib/current-path.js for the rule. */
  const currentPath = resolveCurrentPath(cycle, livePaths);

  const scoped = currentPath
    ? experiments.filter(e => e.path_name === currentPath.path_name)
    : experiments;
  const liveExps = scoped.filter(e => e.deletion_status !== 'deleted');

  /* An experiment with a written conclusion is finished, whatever its status
     field says. Otherwise a reflected test is handed back as the next thing to
     do, and the student repeats a test they have already recorded. */
  const concluded = new Set(
    reflections.filter(r => r.is_experiment_conclusion && r.experiment_id).map(r => r.experiment_id)
  );
  const inProgress = liveExps.filter(e => e.status === 'in_progress' && !concluded.has(e.id));
  const planned    = liveExps.filter(e => e.status === 'planned' && !concluded.has(e.id));
  const doneExps   = liveExps.filter(e => e.status === 'completed');
  const nextExperiment = inProgress[0] || planned[0] || null;

  const scopedProof = currentPath
    ? proof.filter(p => p.path_tested === currentPath.path_name || liveExps.some(e => e.id === p.experiment_id))
    : proof;
  const liveProof = scopedProof.filter(p => p.deletion_status !== 'deleted');

  const scopedRefl = currentPath
    ? reflections.filter(r => r.path_name === currentPath.path_name || liveExps.some(e => e.id === r.experiment_id))
    : reflections;
  const liveRefl = scopedRefl.filter(r => r.deletion_status !== 'deleted');

  const counts = {
    paths: livePaths.length,
    experiments: liveExps.length,
    experimentsDone: doneExps.length,
    proof: liveProof.length,
    reflections: liveRefl.length,
  };

  let stage;
  if (!currentPath) stage = 'choose';
  else if (liveExps.length === 0) stage = 'test';
  else if (liveProof.length === 0) stage = doneExps.length > 0 ? 'prove' : 'test';
  else if (liveRefl.length === 0) stage = 'reflect';
  else if (doneExps.length > 0) stage = 'decide';
  else stage = 'test';

  const ACTIONS = {
    choose: {
      label: 'Choose My Path',
      to: '/choose',
      sub: 'Read your paths one at a time, then pick the one you will test first.',
    },
    test: nextExperiment
      ? {
          label: 'Complete My Next Mission',
          to: `/experiment?experimentId=${nextExperiment.id}`,
          sub: nextExperiment.title,
        }
      : {
          label: 'Begin My Experiment',
          to: `/experiments/new${currentPath ? `?pathName=${encodeURIComponent(currentPath.path_name)}` : ''}`,
          sub: 'A 30-day test that shows you what this path actually feels like.',
        },
    prove: {
      label: 'Submit Evidence',
      to: '/experiment',
      sub: 'Turn what you finished into proof you can show someone, inside the experiment it belongs to.',
    },
    reflect: {
      label: 'Reflect on My Experiment',
      to: '/reflect',
      sub: 'Conclude the experiment: what you learned, what surprised you, what comes next.',
    },
    decide: {
      label: 'Decide What Comes Next',
      to: '/reflect',
      sub: 'Commit to this direction, or take what you learned into a new test.',
    },
  };

  return { stage, currentPath, nextExperiment, counts, action: ACTIONS[stage], livePaths };
}

export function isActivePathStatus(status) {
  return ACTIVE_PATH_STATUSES.includes(status);
}