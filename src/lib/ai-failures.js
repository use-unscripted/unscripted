/**
 * One place that records an AI generation failing, for the admin triage view.
 *
 * ## Why this exists
 *
 * Until now an AI failure produced a message for the student and a console line
 * nobody reads. Twelve call sites, no way to answer "is this happening, how
 * often, and to which feature." A generation that fails silently and recovers
 * on retry left no trace at all, which is exactly the signal that says a model
 * is drifting before the funnel shows any damage.
 *
 * ## What it is allowed to store
 *
 * Diagnostics only: which feature, which stage, fixed cause codes, counts, ids,
 * timestamps. Never a prompt, never a model response, never a student's own
 * words, never a raw server message.
 *
 * That is not a convention here, it is enforced. Every stage and code is
 * matched against `SLUG` before it is written, and anything that fails is
 * dropped and replaced with a marker. So a call site that one day passes
 * `codes: [error.message]` writes `unslugged_value`, not the message. The
 * table stays safe to read even when a caller is wrong.
 *
 * The prompts at these call sites are built from what students told us about
 * their lives, and this is a table staff read. It is also the kind of table a
 * university's counsel asks about, so "we log the failure, not the content" has
 * to be true of the code and not just the intention.
 *
 * ## It never throws and never blocks
 *
 * Same contract as pilot-metrics: a logging failure must never break a
 * student's flow, so every call is fire-and-forget and swallows its own errors.
 */
import { base44 } from '@/api/base44Client';

/** Must match the enum in base44/entities/AiFailure.jsonc. */
export const AI_FEATURES = [
  'path_generation',
  'mission_guide',
  'mission_guide_prefilled',
  'outreach_plan',
  'risk_assessment',
  'blueprint',
  'create_path',
  'reactivation',
  'resume_bullet',
  'weekly_reflection',
  'campus_event_ranking',
];

/**
 * The shape of everything this table is allowed to hold as text.
 *
 * Lowercase, digits and underscores. Deliberately narrow: no spaces, no
 * punctuation, no capitals. A sentence cannot pass it, and neither can a path
 * name, an email, or a server error.
 */
const SLUG = /^[a-z0-9_]{1,48}$/;

/** Cap so one pathological response cannot write an unbounded row. */
const MAX_CODES = 8;

function slug(value, fallback) {
  return typeof value === 'string' && SLUG.test(value) ? value : fallback;
}

function slugList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_CODES)
    .map(v => slug(v, 'unslugged_value'))
    .filter(Boolean);
}

function id(value) {
  // Entity ids only. Anything with a space or that runs long is not an id.
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}

function count(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1000 ? Math.round(value) : undefined;
}

/**
 * Record one AI failure.
 *
 * @param {string} feature one of AI_FEATURES
 * @param {object} [props]
 * @param {string} [props.stage] lowercase slug for where it stopped
 * @param {string[]} [props.codes] content-free cause codes
 * @param {number} [props.attempts] model calls made, including retries
 * @param {boolean} [props.recovered] true when a later retry succeeded
 * @param {string} [props.model] the pinned model id
 * @param {string} [props.path_id]
 * @param {string} [props.experiment_id]
 * @returns {Promise<object|null>} never rejects
 */
export async function logAiFailure(feature, props = {}) {
  try {
    if (!AI_FEATURES.includes(feature)) return null;

    const me = await base44.auth.me().catch(() => null);
    // A signed-out visitor has no row to attribute this to. The generation
    // steps that run signed out are guest drafts, which fail loudly in front of
    // the person anyway.
    if (!me?.id) return null;

    return await base44.entities.AiFailure.create({
      user_id: me.id,
      feature,
      stage: slug(props.stage, 'unknown'),
      codes: slugList(props.codes),
      attempts: count(props.attempts) ?? 1,
      recovered: props.recovered === true,
      model: slug(props.model, undefined),
      path_id: id(props.path_id),
      experiment_id: id(props.experiment_id),
      occurred_at: new Date().toISOString(),
      reviewed: false,
    });
  } catch {
    // Never let triage break the thing it is watching.
    return null;
  }
}

/**
 * Log and print in one call, so a site cannot record one and forget the other.
 * The console line carries the same slugs the row does and nothing more.
 */
export function reportAiFailure(feature, props = {}) {
  // The feature is checked here as well as in logAiFailure, because the console
  // line is printed first and the guarantee is that nothing unslugged is ever
  // printed or stored, not that the row is clean.
  const name = AI_FEATURES.includes(feature) ? feature : 'unknown_feature';
  const stage = slug(props.stage, 'unknown');
  const codes = slugList(props.codes);
  console.error(`[ai:${name}] failed at stage=${stage}${codes.length ? ` codes=${codes.join(',')}` : ''}`);
  return logAiFailure(feature, props);
}
