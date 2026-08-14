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
  'all_paths_viewed', 'path_selected', 'experiment_started', 'mission_guide_opened',
  'mission_completed', 'outreach_attempted', 'professional_conversation_completed',
  'proof_submitted', 'reflection_started', 'reflection_completed',
  'final_decision_submitted', 'cycle_completed', 'second_cycle_attempted',
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
      const key = `${name}:${dedupe_key}`;
      if (writtenThisSession.has(key)) return null;
      writtenThisSession.add(key);
      const existing = await base44.entities.PilotEvent
        .filter({ event_name: name, dedupe_key }, '-created_date', 1)
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