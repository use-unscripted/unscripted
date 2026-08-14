/**
 * Student overrides on the recommended next test.
 *
 * The recommendation is advisory. When a student asks for something else, that
 * is product-learning data, not misbehaviour: we record what was offered, what
 * they did instead, and let the engine take the hint next time.
 *
 * Nothing here deletes uncertainty data. An override only changes which open
 * question is put forward first.
 */
import { base44 } from '@/api/base44Client';

export const OVERRIDE_ACTIONS = {
  another_test: 'Asked for a different test of the same question',
  different_uncertainty: 'Asked to test something else',
  save_for_later: 'Saved for later',
  not_relevant: 'Said this does not feel relevant',
  accepted: 'Started the recommended test',
};

/* How long an override holds the question back. "Not relevant" is a real signal
   and lasts; "save for later" is a nudge and expires. Neither is permanent,
   because what matters to a student changes as their hypotheses change. */
const COOLDOWN_DAYS = { not_relevant: 120, save_for_later: 21, different_uncertainty: 14, another_test: 0, accepted: 0 };

export async function recordOverride({ action, candidate, recommendation, note }) {
  if (!action) return null;
  return base44.entities.RecommendationOverride.create({
    action,
    note: note || undefined,
    dimension: candidate?.variable || undefined,
    dimension_label: candidate?.label || undefined,
    test_question: candidate?.question || undefined,
    blueprint_title: recommendation?.title || undefined,
    path_id: recommendation?.path_id || undefined,
    path_name: recommendation?.path_name || undefined,
    learning_value_score: candidate?.learning_value_score ?? undefined,
    // Which rule put this forward, and what the student did about it. This is the
    // pairing the engine can be judged on later: rule → acceptance → the
    // information value of what the student actually learned.
    rule_id: recommendation?.rule_id || undefined,
    rule_version: recommendation?.rule_version || undefined,
    rule_reasons: recommendation?.rule_reasons?.length ? recommendation.rule_reasons : undefined,
    mode: recommendation?.mode || undefined,
    depth: recommendation?.depth || undefined,
    cross_career_count: recommendation?.cross_career_count ?? undefined,
    recorded_at: new Date().toISOString(),
  }).catch(() => null);
}

/** The student started the recommended test. Same row shape, positive action. */
export function recordAcceptance({ candidate, recommendation }) {
  return recordOverride({ action: 'accepted', candidate, recommendation });
}

export async function loadOverrides() {
  const rows = await base44.entities.RecommendationOverride.list('-recorded_at', 200).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * The dimensions currently held back, and why. A dimension the student called
 * irrelevant is suppressed; one they saved is only deprioritised, so it can
 * still surface if it becomes the single most useful thing left to learn.
 */
export function suppressionFrom(overrides = [], now = Date.now()) {
  const suppressed = new Map();
  overrides.forEach(o => {
    if (!o.dimension || !o.action) return;
    const days = COOLDOWN_DAYS[o.action] ?? 0;
    if (!days) return;
    const at = Date.parse(o.recorded_at || o.created_date || '') || 0;
    if (!at || now - at > days * 864e5) return;
    const existing = suppressed.get(o.dimension);
    const hard = o.action === 'not_relevant';
    if (!existing || hard) suppressed.set(o.dimension, { action: o.action, hard, note: o.note || null });
  });
  return suppressed;
}

export default recordOverride;