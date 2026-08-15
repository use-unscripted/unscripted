/**
 * What an experiment IS, in this product.
 *
 * One rule holds this file together: every experiment exists to reduce ONE
 * career uncertainty. Not "you picked investment banking, here is an investment
 * banking experiment" — instead "you are exploring investment banking, the
 * biggest remaining unknown is whether detailed analytical work under precision
 * pressure energises you, so let's test that".
 *
 * Nothing here creates a new entity. It supplies the vocabulary the existing
 * Experiments records and Mission Guides are written against: the eight kinds of
 * test, the effort scale (the smallest useful test, not a default 30 days), and
 * the mapping from an uncertainty to the decision dimensions it would move.
 */
import { CAREER_DIMENSIONS, DIMENSION_BY_ID } from '@/lib/career-dimensions';

/** The eight kinds of test. `id` is what gets stored on the experiment. */
export const EXPERIMENT_TYPES = [
  { id: 'work_sample', label: 'Work sample', blurb: 'Complete a realistic piece of the actual work.', acts: ['doing', 'producing'], effort: '2-3 hours' },
  { id: 'human_reality', label: 'Human reality', blurb: 'Speak with someone doing the work now.', acts: ['speaking'], effort: '1 hour' },
  { id: 'environment_test', label: 'Environment test', blurb: 'Put yourself in a relevant environment and watch your own reaction.', acts: ['observing'], effort: 'several days' },
  { id: 'decision_simulation', label: 'Decision simulation', blurb: 'Make the decisions the role actually requires.', acts: ['doing'], effort: '15-30 minutes' },
  { id: 'workstyle_test', label: 'Skill and workstyle test', blurb: 'Test one underlying characteristic that carries across careers.', acts: ['doing'], effort: '1 hour' },
  { id: 'research_test', label: 'Research test', blurb: 'Investigate an industry, problem or market.', acts: ['observing', 'producing'], effort: '2-3 hours' },
  { id: 'creation_test', label: 'Creation test', blurb: 'Build or produce something of your own.', acts: ['producing'], effort: 'several days' },
  { id: 'combined', label: 'Combined experiment', blurb: 'Several of the above, when one alone would not answer it.', acts: ['doing', 'speaking', 'producing'], effort: '1 week' },
];

export const TYPE_BY_ID = new Map(EXPERIMENT_TYPES.map(t => [t.id, t]));

/**
 * Effort, in the words a student thinks in. No experiment is assumed to take a
 * month; multi-week is last and is only for uncertainties nothing shorter can
 * reach.
 */
export const EFFORT_SCALE = [
  { id: '15-30 minutes', label: '15 to 30 minutes', hours: 0.5, order: 1 },
  { id: '1 hour', label: 'About an hour', hours: 1, order: 2 },
  { id: '2-3 hours', label: '2 to 3 hours', hours: 3, order: 3 },
  { id: 'several days', label: 'Several days', hours: 6, order: 4 },
  { id: '1 week', label: 'About a week', hours: 10, order: 5 },
  { id: 'multi-week', label: 'Multiple weeks', hours: 25, order: 6 },
];

export const EFFORT_BY_ID = new Map(EFFORT_SCALE.map(e => [e.id, e]));

export const normalizeEffort = (v) => (EFFORT_BY_ID.has(v) ? v : null);
export const effortLabel = (v) => EFFORT_BY_ID.get(v)?.label || null;
export const effortHours = (v) => EFFORT_BY_ID.get(v)?.hours || null;

/** The smallest useful test of a given kind. Used when a design omits effort. */
export const smallestUsefulEffort = (typeId) => TYPE_BY_ID.get(typeId)?.effort || '1 hour';

/** The four acts a set of missions should cover between them, where relevant. */
export const MISSION_ACTS = ['doing', 'observing', 'speaking', 'producing'];

const ACT_WORDS = {
  doing: [/\bdo\b/i, /complete/i, /work through/i, /decide/i, /analy[sz]e/i, /build the/i],
  observing: [/observ/i, /watch/i, /attend/i, /sit in/i, /notice/i, /shadow/i],
  speaking: [/ask/i, /speak/i, /call/i, /interview/i, /message/i, /email/i, /conversation/i],
  producing: [/write/i, /produce/i, /draft/i, /build/i, /create/i, /deliver/i, /publish/i],
};

/**
 * Which of the four acts a mission list already covers. Used to keep guides from
 * becoming busywork that only ever asks the student to read.
 */
export function missionCoverage(steps = []) {
  const text = steps.map(s => (typeof s === 'string' ? s : s?.step || s?.title || s?.description || '')).join(' \n ');
  const covered = MISSION_ACTS.filter(act => ACT_WORDS[act].some(re => re.test(text)));
  return { covered, missing: MISSION_ACTS.filter(a => !covered.includes(a)), ok: covered.length > 0 };
}

/** Which decision dimensions an uncertainty (a work variable id) would move. */
export function dimensionsForUncertainty(variableId) {
  if (!variableId) return [];
  return CAREER_DIMENSIONS.filter(d => d.signals.includes(variableId)).map(d => d.id);
}

export const dimensionLabels = (ids = []) => ids.map(id => DIMENSION_BY_ID.get(id)?.label).filter(Boolean);

/**
 * Which kind of test can actually answer a given uncertainty. A lifestyle
 * tradeoff cannot be answered by doing a work sample alone; somebody living it
 * has to be asked. Anything not listed is answered by doing the work.
 */
const TYPE_FOR_VARIABLE = {
  lifestyle_tradeoff: 'human_reality',
  income_reality: 'human_reality',
  progression: 'human_reality',
  risk_tolerance: 'human_reality',
  culture: 'environment_test',
  pace: 'decision_simulation',
  stakeholder_conflict: 'decision_simulation',
  ambiguity_tolerance: 'decision_simulation',
  teamwork: 'environment_test',
  competition: 'environment_test',
  research: 'research_test',
  creativity: 'creation_test',
  building_orientation: 'creation_test',
  writing: 'creation_test',
  independent_work: 'workstyle_test',
  repetitive_tolerance: 'workstyle_test',
  attention_to_detail: 'work_sample',
};

export const typeForUncertainty = (variableId) => TYPE_FOR_VARIABLE[variableId] || 'work_sample';

/**
 * The selection screen's content for one hypothesis: the biggest current
 * unknown, why it matters, the test recommended for it, what that test would
 * tell us, and the effort it takes. Returns null when there is nothing open —
 * we never invent an unknown so the screen has something to show.
 *
 * `target` is a row from dimension-progress (the untested or unsettled
 * dimension); `path` is the career hypothesis record.
 */
export function testBrief({ path, target, careerName }) {
  if (!target?.id) return null;
  const type = typeForUncertainty(target.id);
  const t = TYPE_BY_ID.get(type);
  const dimensionIds = dimensionsForUncertainty(target.id);
  const name = careerName || path?.path_name || 'this career';

  return {
    uncertainty_id: target.id,
    uncertainty_label: target.label,
    // "You are exploring X. The biggest remaining uncertainty is Y."
    framing: `You are exploring ${name}.`,
    biggest_unknown: target.question || `Do you actually enjoy ${String(target.label || '').toLowerCase()} in this kind of work?`,
    why_it_matters: target.contradicted
      ? `Your readings on ${String(target.label || '').toLowerCase()} have gone both ways, so this is the part of ${name} we cannot yet stand behind.`
      : `${name} asks for this constantly, and we have little evidence about how you respond to it.`,
    recommended_test: t?.blurb || '',
    experiment_type: type,
    experiment_type_label: t?.label || '',
    what_you_learn: dimensionLabels(dimensionIds),
    decision_dimension_ids: dimensionIds,
    effort: smallestUsefulEffort(type),
    effort_label: effortLabel(smallestUsefulEffort(type)),
  };
}

/**
 * The reminder shown inside the step-by-step run. The point of an experiment is
 * the reaction, not the performance, and students forget that under a rubric.
 */
export const PERFORMANCE_REMINDER =
  'Remember: we are testing whether this type of work is energizing, not whether you can perform it perfectly.';

/** The line that ties one step back to the uncertainty being tested. */
export function stepUncertaintyLine(experiment) {
  const q = experiment?.test_question || experiment?.unresolved_question;
  if (!q) return null;
  return `This step is here to answer one question: ${q}`;
}

/** Outreach that tests something specific, rather than "talk to a banker". */
export function outreachBrief(experiment) {
  const q = experiment?.test_question || experiment?.unresolved_question;
  if (!q) return null;
  return {
    purpose: q,
    instruction: `You are uncertain about this: ${q} Ask about their actual week, the periods that are hardest, and what makes the tradeoff worthwhile for them.`,
  };
}

/** Evidence requirements always answer the same question, in plain words. */
export function evidenceRequirementFallback(experiment) {
  const q = experiment?.test_question || experiment?.unresolved_question;
  return q
    ? `Anything that shows how you actually responded while working on this, so we can update our answer to: ${q}`
    : 'Anything that shows what you produced and how the work felt while you did it.';
}