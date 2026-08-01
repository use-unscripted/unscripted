/**
 * Journey stage resolution.
 *
 * One centralized six-stage journey: Explore → Choose → Test → Prove → Reflect → Decide.
 * Stage is DERIVED from records the student already has — nothing new is stored, so this
 * reads correctly for existing accounts with legacy data.
 */

export const STAGES = [
  { key: 'explore', label: 'Explore', question: 'Which directions are worth my time?' },
  { key: 'choose',  label: 'Choose',  question: 'Which one am I testing first?' },
  { key: 'test',    label: 'Test',    question: 'What am I actually doing this week?' },
  { key: 'prove',   label: 'Prove',   question: 'What evidence did I create?' },
  { key: 'reflect', label: 'Reflect', question: 'What did I learn about the fit?' },
  { key: 'decide',  label: 'Decide',  question: 'Do I continue, or test something else?' },
];

export const STAGE_INDEX = STAGES.reduce((a, s, i) => ({ ...a, [s.key]: i }), {});

const ACTIVE_PATH_STATUSES = ['active', 'exploring', 'draft'];

/**
 * @returns {{
 *   stage: string, currentPath: object|null, nextExperiment: object|null,
 *   counts: object, action: {label: string, to?: string, anchor?: string, sub: string}
 * }}
 */
export function resolveJourney({ paths = [], experiments = [], proof = [], reflections = [] }) {
  const livePaths = paths.filter(p => !['archived'].includes(p.status));
  const currentPath =
    livePaths.find(p => p.is_primary_focus) ||
    livePaths.find(p => p.status === 'active') ||
    null;

  const scoped = currentPath
    ? experiments.filter(e => e.path_name === currentPath.path_name)
    : experiments;
  const liveExps = scoped.filter(e => e.deletion_status !== 'deleted');

  const inProgress = liveExps.filter(e => e.status === 'in_progress');
  const planned    = liveExps.filter(e => e.status === 'planned');
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
  if (livePaths.length === 0) stage = 'explore';
  else if (!currentPath) stage = 'choose';
  else if (liveExps.length === 0) stage = 'test';
  else if (liveProof.length === 0) stage = doneExps.length > 0 ? 'prove' : 'test';
  else if (liveRefl.length === 0) stage = 'reflect';
  else if (doneExps.length > 0) stage = 'decide';
  else stage = 'test';

  const ACTIONS = {
    explore: {
      label: 'Compare My Paths',
      to: '/paths',
      sub: 'Review the directions built from your onboarding answers, side by side.',
    },
    choose: {
      label: 'Choose This Path',
      to: '/paths',
      sub: 'Pick the one direction you will test first. Nothing is permanent.',
    },
    test: nextExperiment
      ? {
          label: 'Complete My Next Mission',
          to: `/experiments?experimentId=${nextExperiment.id}`,
          sub: nextExperiment.title,
        }
      : {
          label: 'Begin My Experiment',
          to: `/experiments/new${currentPath ? `?pathName=${encodeURIComponent(currentPath.path_name)}` : ''}`,
          sub: 'A 30-day test that shows you what this path actually feels like.',
        },
    prove: {
      label: 'Submit Evidence',
      to: '/evidence?tab=proof',
      sub: 'Turn what you finished into proof you can show someone.',
    },
    reflect: {
      label: 'Reflect on My Experiment',
      to: '/evidence?tab=reflect',
      sub: 'Five minutes. What gave you energy, what drained it, what surprised you.',
    },
    decide: {
      label: 'Decide What Comes Next',
      anchor: 'decision',
      sub: 'Commit to this direction, or take what you learned into a new test.',
    },
  };

  return { stage, currentPath, nextExperiment, counts, action: ACTIONS[stage], livePaths };
}

export function isActivePathStatus(status) {
  return ACTIVE_PATH_STATUSES.includes(status);
}