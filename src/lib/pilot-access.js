/**
 * Pilot access — who a signed-in user is in the pilot, and what they may start.
 *
 * Three access sources live on the User record:
 *   independent_beta       — one full cycle, then a continuation-interest step
 *   institution_sponsored   — unlimited during the sponsored window, no paywall
 *   internal_admin          — unlimited, and the only source that sees the
 *                             pilot dashboard (alongside the app admin role)
 *
 * No payment processing anywhere in this phase: the second-cycle step records
 * interest and a preferred plan, nothing more.
 */
import { base44 } from '@/api/base44Client';

export const ACCESS_SOURCES = ['independent_beta', 'institution_sponsored', 'internal_admin'];
export const INDEPENDENT_CYCLE_LIMIT = 1;

export class CycleLimitError extends Error {
  constructor(cyclesCompleted) {
    super('Independent beta includes one full cycle.');
    this.name = 'CycleLimitError';
    this.cyclesCompleted = cyclesCompleted;
  }
}

function withinWindow(start, end) {
  const today = new Date().toISOString().split('T')[0];
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

/** How many cycles this student has actually finished. */
export async function completedCycleCount() {
  const rows = await base44.entities.CareerCycle
    .filter({ status: 'completed' }, '-created_date', 50)
    .catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

/**
 * @returns {Promise<{user, accessSource, institutionId, cohortId, sponsoredActive,
 *   paywallExempt, unlimitedCycles, isAdmin, cyclesCompleted, canStartNewCycle}>}
 */
export async function loadPilotAccess() {
  const user = await base44.auth.me().catch(() => null);
  const accessSource = ACCESS_SOURCES.includes(user?.access_source) ? user.access_source : 'independent_beta';
  const sponsoredActive = accessSource === 'institution_sponsored'
    && withinWindow(user?.sponsored_start, user?.sponsored_end);
  const unlimitedCycles = accessSource === 'internal_admin' || sponsoredActive;
  const cyclesCompleted = user?.id ? await completedCycleCount() : 0;

  return {
    user,
    accessSource,
    institutionId: user?.institution_id || null,
    cohortId: user?.cohort_id || null,
    sponsoredActive,
    // Sponsored students never meet a personal subscription paywall during the
    // pilot window; internal admins never do at all.
    paywallExempt: unlimitedCycles,
    unlimitedCycles,
    isAdmin: user?.role === 'admin' || accessSource === 'internal_admin',
    cyclesCompleted,
    canStartNewCycle: unlimitedCycles || cyclesCompleted < INDEPENDENT_CYCLE_LIMIT,
  };
}

/** Throws CycleLimitError when an independent beta user is out of cycles. */
export async function assertCanStartCycle() {
  const access = await loadPilotAccess();
  if (access.canStartNewCycle) return access;
  await import('@/lib/pilot-metrics').then(m =>
    m.trackPilotEvent('second_cycle_attempted', { value: access.cyclesCompleted + 1 })
  );
  throw new CycleLimitError(access.cyclesCompleted);
}

/** The one continuation record per user, if they have already answered. */
export async function loadContinuationInterest() {
  const rows = await base44.entities.ContinuationInterest.list('-created_date', 1).catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

/** Saves (or updates) this student's continuation answer. No payment is taken. */
export async function recordContinuationInterest({ wants_continued_access, preferred_access, note }) {
  const access = await loadPilotAccess();
  const payload = {
    user_id: access.user?.id,
    access_source: access.accessSource,
    institution_id: access.institutionId || undefined,
    cohort_id: access.cohortId || undefined,
    wants_continued_access: !!wants_continued_access,
    preferred_access: preferred_access || 'undecided',
    cycles_completed: access.cyclesCompleted,
    note: note || undefined,
    recorded_at: new Date().toISOString(),
  };
  const existing = await loadContinuationInterest();
  const saved = existing
    ? await base44.entities.ContinuationInterest.update(existing.id, payload)
    : await base44.entities.ContinuationInterest.create(payload);
  const { trackPilotEvent } = await import('@/lib/pilot-metrics');
  await trackPilotEvent('continuation_interest_recorded', {
    stage: payload.preferred_access,
    value: payload.wants_continued_access ? 1 : 0,
  });
  return saved;
}