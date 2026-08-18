/**
 * One place that decides whether an experiment is finished, and which one the
 * student is on.
 *
 * The Test screen and the Reflect screen each used to answer that question their
 * own way — Test looked only at the `status` field, Reflect looked at the cycle's
 * experiment id — so with two or three experiments running they pointed at
 * different ones, and an experiment whose steps were all done still read as
 * unfinished. Both screens now read this module.
 *
 * Nothing is written here. Completion is derived from records the student already
 * has: the experiment's status, its guide's step progress, and whether a
 * conclusion has been written for it.
 */
import { base44 } from '@/api/base44Client';
import { readProgress } from '@/lib/guide-progress';

const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r?.deletion_status !== 'deleted');
const OPEN = ['draft', 'planned', 'in_progress'];

/** One experiment with everything needed to say where it stands. */
function shape(experiment, guides, reflections) {
  const own = guides.filter(g => g.experiment_id === experiment.id);
  const guide = own.find(g => g.is_active) || own[0] || null;
  const progress = guide ? readProgress(guide) : { steps: [], completed: [], total: 0 };
  const stepsTotal = progress.total || 0;
  const stepsDone = Math.min(progress.completed?.length || 0, stepsTotal || Infinity) || 0;
  const stepsComplete = stepsTotal > 0 && stepsDone >= stepsTotal;
  const hasReflection = reflections.some(r => r.experiment_id === experiment.id && r.is_experiment_conclusion);
  /* A written conclusion counts as the work being done. A student who has already
     reflected on a test must never be told that test is still unfinished. */
  const workDone = experiment.status === 'completed' || experiment.status === 'skipped' || stepsComplete || hasReflection;

  return {
    experiment,
    id: experiment.id,
    title: experiment.title,
    pathName: experiment.path_name || '',
    status: experiment.status,
    guide,
    stepsTotal,
    stepsDone,
    percent: stepsTotal ? Math.round((stepsDone / stepsTotal) * 100) : (workDone ? 100 : 0),
    hasReflection,
    workDone,
    /** Finished the work, still owes a reflection. This is what Reflect is for. */
    awaitingReflection: workDone && !hasReflection,
    /** Started, and still has work left to do. A generated but never-opened
        experiment is a suggestion, not something the student is carrying. */
    open: !workDone && experiment.status === 'in_progress',
    planned: !workDone && OPEN.includes(experiment.status) && experiment.status !== 'in_progress',
  };
}

/** In progress first, then planned work, then anything owed a reflection. */
function order(rows) {
  const rank = (r) => (r.open ? 0 : r.awaitingReflection ? 1 : r.planned ? 2 : 3);
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

/**
 * Every experiment the student has, with its real progress, plus the single one
 * both screens should be pointing at.
 *
 * @param {{pathName?: string}} opts limit to one career, or omit for all of them
 */
export async function loadExperimentProgress({ pathName } = {}) {
  const [expRows, guideRows, reflRows] = await Promise.all([
    base44.entities.Experiments.list('-created_date', 100).catch(() => []),
    base44.entities.MissionGuides.list('-created_date', 200).catch(() => []),
    base44.entities.WeeklyReflections.list('-created_date', 200).catch(() => []),
  ]);
  const guides = alive(guideRows);
  const reflections = alive(reflRows);

  const all = order(alive(expRows).map(e => shape(e, guides, reflections)));
  const rows = pathName ? all.filter(r => r.pathName === pathName) : all;

  /* Anything the student is still carrying: work in progress, or work finished
     that has not been concluded. Completed and reflected experiments are done. */
  const started = rows.find(r => r.open) || null;
  const planned = rows.find(r => r.planned) || null;
  const testing = started || planned;
  const awaitingReflection = rows.filter(r => r.awaitingReflection);

  /* The test the student is on. Deliberately the same rule My Journey has always
     used — the experiment whose status is in_progress, then work set up and
     waiting — so the headline test is identical wherever it is shown. A student
     can carry several open experiments, but only one is "the test you are on".
     Only when nothing is under way does a reflection that is owed take over. */
  const current = rows.find(r => r.status === 'in_progress') || planned || awaitingReflection[0] || null;

  /* Anything the student is still carrying, with the current test always in it
     even if its own steps are already finished. */
  const active = rows
    .filter(r => r.open || r.awaitingReflection || r.id === current?.id)
    .sort((a, b) => (a.id === current?.id ? -1 : b.id === current?.id ? 1 : 0));

  return {
    rows,
    all,
    active,
    testing,
    awaitingReflection,
    current,
  };
}