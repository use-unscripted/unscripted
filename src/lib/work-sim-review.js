/**
 * The one model call in the whole work simulation slice.
 *
 * Two rubric criteria, and nothing else: whether the problem statement names a
 * problem rather than a feature, and whether the reply to sales is honest
 * without being a dodge and gives no date the sprint cannot support. The other
 * three criteria are arithmetic and text comparison in work-sim-checks.js, and
 * they run whether or not a model answers.
 *
 * No summary, no strengths, no improvement areas, no score out of ten, no
 * comment on the career. Two booleans and two sentences. The research puts
 * model to human agreement on short answers well below measurement grade, so
 * these two are presented as a reader's note in the read-out and never as a
 * score, and they are the two that vanish when the model is gone.
 *
 * ## The two sentences are held to the read-out's rules
 *
 * They are the only strings in the whole slice that a student reads and nobody
 * on this team wrote, and they land in the same block as copy the read-out
 * enforces rule 4 on. So `validateReview` runs each `detail` through
 * `bannedLanguageIn` from work-sim-readout.js, the same list, and a hit is a
 * rejection rather than a repair. The retry is told which words to drop; a
 * second failure takes the degraded path, which is three counted checks and a
 * read-out that names the two it could not score. The prompt asks for the same
 * thing, and a prompt is not a guarantee.
 *
 * ## What happens when the model is unavailable
 *
 * This is called after the run row is already saved, never before, so a failure
 * here cannot lose a student's work. Every failure resolves to `null`, logged
 * through the shared failure path in ai-generate.js. `check_results` is then
 * written with only the three computed criteria, each stamped
 * `scored_by: 'checks'`, and the read-out's degraded branch names the two that
 * are missing. Nothing is fabricated, nothing is silently dropped, and three
 * checks are never passed off as five.
 *
 * `system_evaluated_at` on the measurement row is left absent in that state,
 * which is the same "already done" guard evaluateExperimentWork uses, so a
 * later backfill fills it correctly with no special casing.
 *
 * The rows this returns are the shape `WorkSimulationRun.check_results` holds:
 * `{ criterion, passed, detail, scored_by }`, where `criterion` is the rubric
 * id from the content module and not the sentence. The read-out looks the
 * sentence up. work-sim-checks.js writes the same shape with
 * `scored_by: 'checks'`.
 */
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText } from '@/lib/ai-validation';
import { generateValidated } from '@/lib/ai-generate';
import { NORTHGATE_PM } from '@/lib/work-sims/northgate-pm';
import { runWorkSimChecks, pointsFor } from '@/lib/work-sim-checks';
import { bannedLanguageIn } from '@/lib/work-sim-readout';

/** Must be in AI_FEATURES in ai-failures.js and in the enum in AiFailure.jsonc. */
export const REVIEW_FEATURE = 'work_sim_review';

/** The two rubric ids this call scores, in the order the prompt asks for them. */
export const MODEL_SCORED_CRITERIA = ['problem_not_feature', 'honest_reply'];

/**
 * A `detail` runs to one or two sentences. The ceiling is generous and it is a
 * rejection rather than a trim: a paragraph back means the model ignored the
 * brief, and cutting it mid-sentence would hide that while still printing it to
 * a student.
 */
const MAX_DETAIL = 400;

/** Enough of the student's own text to judge, capped so the prompt stays bounded. */
const MAX_INPUT = 2000;

const text = (v) => (typeof v === 'string' ? v : '');
const list = (v) => (Array.isArray(v) ? v : []);

const clip = (s) => {
  const t = text(s).trim();
  return t.length > MAX_INPUT ? t.slice(0, MAX_INPUT) : t;
};

/**
 * Long dashes out of anything a student reads.
 *
 * The house rule is checked against the built bundle, which cannot see a
 * sentence a model writes at runtime. The prompt bans them and the model
 * usually obeys, so this is the belt on top of the braces. Repairing rather
 * than rejecting on purpose: losing the whole review over one punctuation mark
 * costs the student two criteria and buys nothing.
 *
 * The two characters are written as escapes, not typed. The house count is run
 * against the built bundle, so a literal pair here would read as two more
 * dashes in shipped text the day this module is first imported by a page.
 */
const stripLongDashes = (s) =>
  text(s)
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

const normalise = (s) => text(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The rubric id a returned row is talking about. The id is what we asked for.
 * A model that echoes the criterion sentence instead is still answering the
 * question, so that maps too. Anything else is unmatched, and an unmatched row
 * is a rejection rather than a guess: filling in by position is how a review of
 * the wrong field ends up printed under the right heading.
 */
function criterionId(value, sim) {
  const raw = text(value).trim();
  if (MODEL_SCORED_CRITERIA.includes(raw)) return raw;
  const wanted = normalise(raw);
  if (!wanted) return '';
  const match = list(sim?.rubric).find(
    entry => MODEL_SCORED_CRITERIA.includes(entry.id)
      && (normalise(entry.id) === wanted || normalise(entry.criterion) === wanted),
  );
  return match?.id || '';
}

/** Models answer a boolean field with the word sometimes. Both are the answer. */
function toBool(value) {
  if (typeof value === 'boolean') return value;
  const v = text(value).trim().toLowerCase();
  if (v === 'true' || v === 'yes') return true;
  if (v === 'false' || v === 'no') return false;
  return null;
}

/**
 * Accept only a complete, unambiguous answer to both criteria. Everything else
 * is rejected with reasons the retry hands back, and a second rejection leaves
 * the run with three checks and an honest hole.
 */
export function validateReview(raw, sim = NORTHGATE_PM) {
  const rows = list(raw?.criteria);
  const errors = [];
  const codes = [];

  if (!Array.isArray(raw?.criteria)) {
    return {
      ok: false,
      data: null,
      errors: ['Return a "criteria" array holding one entry for each of the two criterion ids.'],
      codes: ['review_criteria_not_a_list'],
    };
  }

  if (rows.length !== MODEL_SCORED_CRITERIA.length) {
    errors.push(`Return exactly ${MODEL_SCORED_CRITERIA.length} entries in "criteria", one per criterion id, and no others.`);
    codes.push('review_wrong_criteria_count');
  }

  const byId = new Map();
  rows.forEach(row => {
    const id = criterionId(row?.criterion, sim);
    if (!id) {
      if (!codes.includes('review_unknown_criterion')) {
        errors.push(`Use one of these exact strings as "criterion": ${MODEL_SCORED_CRITERIA.join(', ')}.`);
        codes.push('review_unknown_criterion');
      }
      return;
    }
    if (!byId.has(id)) byId.set(id, row);
  });

  const data = [];
  MODEL_SCORED_CRITERIA.forEach(id => {
    const row = byId.get(id);
    if (!row) {
      errors.push(`There is no entry for the criterion "${id}". Judge it and return it.`);
      codes.push('review_missing_criterion');
      return;
    }

    const passed = toBool(row.passed);
    if (passed === null) {
      errors.push(`"passed" for "${id}" must be true or false.`);
      codes.push('review_passed_not_boolean');
    }

    const detail = stripLongDashes(toText(row.detail));
    let banned = [];
    if (!detail) {
      errors.push(`"detail" for "${id}" is empty. Write one or two sentences to the student about what they wrote.`);
      codes.push('review_detail_missing');
    } else if (detail.length > MAX_DETAIL) {
      errors.push(`"detail" for "${id}" runs to ${detail.length} characters. Keep it to one or two sentences.`);
      codes.push('review_detail_too_long');
    } else {
      // Rule 4 of the read-out, applied to the model's own sentences.
      // "This shows real strategic instinct" answers the question and is still
      // a horoscope, and the prompt asking for it not to happen is not a
      // guarantee. A hit is a rejection: the retry is told which words to drop,
      // and a second failure leaves the run with its three counted checks and
      // the read-out saying plainly that two are missing. Nothing is trimmed or
      // reworded, because a sentence we edited is no longer the review and
      // still gets printed to a student as though it were.
      banned = bannedLanguageIn(detail);
      if (banned.length) {
        errors.push(
          `"detail" for "${id}" describes the student rather than what they wrote, or carries something the read-out will not print. Rewrite it without these: ${[...new Set(banned.map(b => b.term))].join(', ')}.`
        );
        codes.push('review_detail_banned_language');
      }
    }

    if (passed !== null && detail && detail.length <= MAX_DETAIL && !banned.length) {
      data.push({ criterion: id, passed, detail, scored_by: 'model' });
    }
  });

  // Any complaint at all is a rejection. An answer carrying a third criterion
  // is complete on the two that were asked for, and taking it anyway would mean
  // shipping a review of something nobody asked the model to judge.
  if (codes.length || data.length !== MODEL_SCORED_CRITERIA.length) {
    return { ok: false, data: null, errors, codes: [...new Set(codes)] };
  }
  return { ok: true, data, errors: [], codes: [] };
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string' },
          passed: { type: 'boolean' },
          detail: { type: 'string' },
        },
        required: ['criterion', 'passed', 'detail'],
      },
    },
  },
  required: ['criteria'],
};

/** The fixed scenario facts the two judgements need, and nothing more. */
function scenario(run, sim) {
  const salesEmail = list(sim?.read_in).find(item => item.id === 'sales_email');
  const items = list(sim?.backlog?.items);
  const recurring = items.find(item => item.id === 'recurring_jobs');
  const capacity = Number(sim?.backlog?.capacity) || 0;

  const finalIds = Array.isArray(run?.selected_items_final)
    ? run.selected_items_final
    : list(run?.selected_items);
  const known = new Set(items.map(item => item.id));
  const chosen = finalIds.filter(id => known.has(id));
  const total = chosen.reduce((sum, id) => sum + pointsFor(id, sim), 0);
  const titleOf = (id) => items.find(item => item.id === id)?.title || id;

  // The setup is written in the second person, to the student. It is labelled
  // here so the model does not read "you are the product manager" as its own
  // brief and start answering the simulation instead of judging it.
  return [
    `This is what the student was told: ${text(sim?.setup)}`,
    `The sprint holds ${capacity} points. Priya Raman, the engineering lead, re-estimated the duplicate job fix at 5 points after the first plan was written, and asked the student what to tell Mark.`,
    salesEmail
      ? `Mark Deshpande in sales had emailed: "${text(salesEmail.body)}"`
      : '',
    recurring
      ? `Recurring jobs, the thing Mark wants, is ${recurring.points} points of work. It does not fit in this sprint alongside anything else.`
      : '',
    chosen.length
      ? `The sprint the student settled on is ${total} ${total === 1 ? 'point' : 'points'}: ${chosen.map(titleOf).join('; ')}.`
      : 'The student left the sprint empty.',
    `Recurring jobs ${chosen.includes('recurring_jobs') ? 'is' : 'is not'} in that sprint.`,
  ].filter(Boolean).join('\n');
}

function buildPrompt(run, sim, correction) {
  const rubric = list(sim?.rubric);
  const sentenceFor = (id) => text(rubric.find(entry => entry.id === id)?.criterion);

  return `You are checking two things a college student wrote during a 30 minute product management simulation. Judge those two things only. Do not mention the career, do not say whether this work suits them, do not encourage or discourage them, do not guess at how good they would be at this job, and do not give any score.

THE SITUATION, the same for every student:
${scenario(run, sim)}

CRITERION 1, use the id "problem_not_feature".
${sentenceFor('problem_not_feature')}
This is what the student wrote as the problem statement:
"""
${clip(run?.problem_statement)}
"""
It passes when the sentence says what is going wrong and for whom. It fails when it names a thing to build, a feature, or a piece of work, because that is an answer and not a problem. A sentence that names the problem and then also names the fix still passes.

CRITERION 2, use the id "honest_reply".
${sentenceFor('honest_reply')}
This is the message the student sent Mark:
"""
${clip(run?.sales_reply)}
"""
It passes when it tells Mark plainly what is happening and what is not, and gives no date, quarter or deadline the sprint cannot support. It fails when it avoids the question, leaves Mark thinking the thing is coming when it is not, or commits to a date. Saying no is not a failure and neither is saying it kindly.

Return exactly two entries in "criteria", one for each id above, in that order. Put the id in "criterion", spelled exactly as it appears here.
"passed": true or false.
"detail": one or two sentences, written to the student, about what they wrote. Quote their own words when it helps. Say what is there and what is missing. Describe the writing, never the person: no sentence about what kind of thinker they are.
${PLAIN_PROSE_RULES}${correction}`;
}

/**
 * Score the two model criteria for one saved run.
 *
 * @param {object} run a WorkSimulationRun row, already written
 * @param {object} [options]
 * @param {object} [options.sim] simulation content, defaults to the Northgate sprint
 * @returns {Promise<Array<{criterion: string, passed: boolean, detail: string, scored_by: 'model'}>|null>}
 *   Two rows, or `null` when the model could not be reached, answered
 *   unusably twice, or there was nothing to judge. Never rejects.
 */
export async function reviewSimulationWork(run, options = {}) {
  const sim = options.sim || NORTHGATE_PM;

  // No work, no score. Both criteria read a specific piece of student writing,
  // and a run that stopped before either one exists has a hole, not a failure,
  // so nothing is logged and nothing is invented.
  if (!text(run?.problem_statement).trim() || !text(run?.sales_reply).trim()) return null;

  try {
    const result = await generateValidated({
      feature: REVIEW_FEATURE,
      model: 'gemini_3_1_pro',
      context: { experiment_id: run?.experiment_id },
      validate: (raw) => validateReview(raw, sim),
      call: async (correction) => unwrapLLM(await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_1_pro',
        prompt: buildPrompt(run, sim, correction),
        response_json_schema: RESPONSE_SCHEMA,
      })),
    });
    return result.ok ? result.data : null;
  } catch {
    // generateValidated recorded the invoke failure before rethrowing. From
    // here it is the same outcome as an unusable answer: three checks, and the
    // read-out says which two are missing.
    return null;
  }
}

/**
 * Everything `check_results` should hold for a run, model or no model.
 *
 * The three computed checks always run first and are always kept. The two model
 * rows are appended only when they came back complete, so the array is either
 * three rows or five and never a mixture with a hole in it. The read-out counts
 * against the rubric, so three rows print as three of five with both missing
 * criteria named.
 */
export async function scoreSimulationRun(run, options = {}) {
  const sim = options.sim || NORTHGATE_PM;
  const computed = runWorkSimChecks(run, sim);
  const reviewed = await reviewSimulationWork(run, options);
  return {
    check_results: reviewed ? [...computed, ...reviewed] : computed,
    model_scored: Array.isArray(reviewed),
  };
}

export default reviewSimulationWork;
