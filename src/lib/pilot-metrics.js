/**
 * Pilot measurement — one place that writes every tracked event.
 *
 * Two sinks per event: product analytics (base44.analytics) and a PilotEvent row
 * (so the admin pilot dashboard can aggregate without reading a single private
 * record). PilotEvent stores ids and numbers ONLY — never reflection text, proof
 * contents, contact notes, resume content or onboarding answers.
 *
 * Never throws. A measurement failure must never break a student's flow, so
 * every call is fire-and-forget and swallows its own errors.
 */
import { base44 } from '@/api/base44Client';
import { entityTime } from '@/lib/dates';

export const PILOT_EVENTS = [
  'signup_completed', 'onboarding_started', 'onboarding_completed', 'paths_generated',
  // The decision-cycle funnel. These exist because an Experiments row proves a
  // record was created and nothing more: it cannot say whether a student saw a
  // recommendation, opened it, started, got a quarter through, or finished.
  // Emitters live in src/lib/analytics/decision-funnel-events.js.
  'path_investigated', 'experiment_generated', 'experiment_recommended',
  'experiment_card_viewed', 'experiment_detail_viewed', 'experiment_selected',
  'pre_expectation_started', 'pre_expectation_completed', 'experiment_step_completed',
  'experiment_progress_25', 'experiment_progress_50', 'experiment_progress_75',
  'experiment_completed', 'evidence_started', 'evidence_completed',
  'post_experiment_completed', 'path_updated', 'decision_completed',
  'next_experiment_recommended', 'repeat_path_test_started',
  'all_paths_viewed', 'path_selected', 'experiment_started', 'mission_guide_opened',
  'mission_completed', 'outreach_attempted', 'professional_conversation_completed',
  // Human Reality and outreach. Emitters live in
  // src/lib/analytics/human-reality-events.js. Same privacy rule as everything
  // else here: ids, counts and fixed-choice values, never a contact's name or
  // address and never a word the student typed.
  'human_reality_recommended', 'outreach_started', 'outreach_drafted', 'contact_logged',
  'professional_contacted', 'response_received', 'conversation_scheduled',
  'human_evidence_started', 'human_evidence_submitted', 'human_evidence_reflected',
  'human_evidence_matrix_updated',
  // Scenarios and the experiment quality survey. A scenario that was rendered
  // and a scenario that was answered are different facts, and only the second
  // one was ever stored on a record.
  'scenario_shown', 'scenario_answered', 'experiment_feedback_submitted',
  'proof_submitted', 'reflection_started', 'reflection_completed',
  'final_decision_submitted', 'cycle_completed', 'repeat_cycle_completed',
  'second_cycle_attempted',
  'continuation_interest_recorded', 'seven_day_return', 'thirty_day_return',
  // Work simulations. These four are the completion count, and they are read
  // off PilotEvent rather than off WorkSimulationRun because that entity is
  // student owned with no admin read and should stay that way. `value` on the
  // abandoned event carries the step they left at, which is what says whether a
  // low completion rate is the concept or one hard step.
  'simulation_started', 'simulation_completed', 'simulation_abandoned',
  'simulation_second_started',
];

/** Cheap in-tab guard so a re-render cannot double-write the same once-only event. */
const writtenThisSession = new Set();
// Two concurrent callers of the same once-only event (two mounts in the same
// tick) would both pass the "does a row exist?" check, so they share one write.
const inFlight = new Map();

async function context() {
  const me = await base44.auth.me().catch(() => null);
  if (!me?.id) return null;
  return {
    user_id: me.id,
    access_source: me.access_source || 'independent_beta',
    // Stamped on the row so an event keeps the classification it was recorded
    // under. Reclassifying an account later must not rewrite what its past
    // events counted as. 'unclassified' is the honest default: nothing here
    // guesses whether an account is a real student.
    analytics_class: me.analytics_class || 'unclassified',
    institution_id: me.institution_id || undefined,
    cohort_id: me.cohort_id || undefined,
  };
}

/**
 * Records one event.
 * @param {string} name one of PILOT_EVENTS
 * @param {object} [props] { cycle_id, path_id, experiment_id, mission_id, stage, value, cycle_index, dedupe_key }
 */
export function trackPilotEvent(name, props = {}) {
  if (!PILOT_EVENTS.includes(name)) return Promise.resolve(null);
  if (!props.dedupe_key) return writeEvent(name, props);
  const key = `${name}:${props.dedupe_key}`;
  if (!inFlight.has(key)) {
    inFlight.set(key, writeEvent(name, props).finally(() => inFlight.delete(key)));
  }
  return inFlight.get(key);
}

async function writeEvent(name, props) {
  try {
    const ctx = await context();
    if (!ctx) return null; // guest / signed out — nothing to attribute it to

    const { dedupe_key, ...rest } = props;
    if (dedupe_key) {
      const key = `${ctx.user_id}:${name}:${dedupe_key}`;
      if (writtenThisSession.has(key)) return null;
      writtenThisSession.add(key);
      /* Scoped to this account, not just to the key. Several keys are per-path
         or literally 'account', and an admin reads every student's rows, so an
         unscoped check let one student's event block another's — which is the
         reason internal test accounts recorded almost nothing. */
      const existing = await base44.entities.PilotEvent
        .filter({ event_name: name, dedupe_key, user_id: ctx.user_id }, '-created_date', 1)
        .catch(() => []);
      if (Array.isArray(existing) && existing.length) return null;
    }

    base44.analytics.track({
      eventName: name,
      properties: {
        access_source: ctx.access_source,
        institution_id: ctx.institution_id || '',
        cohort_id: ctx.cohort_id || '',
        stage: rest.stage || '',
      },
    });

    return await base44.entities.PilotEvent.create({
      ...ctx,
      ...rest,
      dedupe_key: dedupe_key || undefined,
      event_name: name,
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[pilot] event not recorded:', name, err?.message || err);
    return null;
  }
}

/** Records an event at most once per user (across sessions). */
export function trackPilotEventOnce(name, suffix, props = {}) {
  return trackPilotEvent(name, { ...props, dedupe_key: suffix });
}

const DAY = 86400000;

/**
 * signup_completed plus the two return-engagement markers, all once per user.
 * Called on app shell mount; safe to call on every navigation.
 */
export async function trackEngagementMarkers() {
  const me = await base44.auth.me().catch(() => null);
  if (!me?.id) return;
  // Compared against Date.now(), so the two sides have to be the same kind of
  // number. Base44 returns created_date without its `Z`; `new Date()` would
  // read that as local time and make the account look four hours younger than
  // it is, which fires the return markers four hours late.
  const joined = entityTime(me.created_date);

  await trackPilotEventOnce('signup_completed', me.id);
  if (!Number.isFinite(joined)) return;
  const age = Date.now() - joined;
  if (age >= 7 * DAY) await trackPilotEventOnce('seven_day_return', me.id);
  if (age >= 30 * DAY) await trackPilotEventOnce('thirty_day_return', me.id);
}