/**
 * Language Level: the same experiment, described in the register the student can
 * actually read.
 *
 * What this is NOT: a second copy of the work. There is one authoritative
 * MissionGuides record, one set of steps, one required action per step, one
 * `done_when`, one `proof_capture`. Nothing in this file or in
 * language-transform.js writes to any of them. The level changes the words on
 * screen and nothing else, which is why switching it mid-experiment cannot move
 * a student's step, reset progress, or alter what they have to hand in.
 *
 * Where the preference lives: one LanguagePreference row per user per path, plus
 * an optional row with scope 'global' as the fallback. Per path on purpose. A
 * student can be fluent in banking and completely new to product management, and
 * a single site-wide setting would force them to pick which of those to be wrong
 * about. Rows are the student's own under RLS, so nobody can read or change
 * anybody else's.
 */
import { base44 } from '@/api/base44Client';
import { onceInFlight } from '@/lib/career-cycle';

export const LEVELS = ['plain', 'balanced', 'industry'];
export const DEFAULT_LEVEL = 'balanced';

export const LEVEL_LABELS = {
  plain: 'Plain language',
  balanced: 'Balanced',
  industry: 'Industry language',
};

export const LEVEL_HINTS = {
  plain: 'Simple wording, with the important terms taught rather than dropped.',
  balanced: 'Normal industry wording, with specialist terms explained once.',
  industry: 'The wording professionals in the field actually use.',
};

/** The optional question at the start of an experiment, and what it maps to. */
export const FAMILIARITY_OPTIONS = [
  { level: 'plain', label: "I'm completely new to it" },
  { level: 'balanced', label: 'I know some of the terminology' },
  { level: 'industry', label: "I'm already comfortable with industry terminology" },
];

export const isLevel = (value) => LEVELS.includes(value);

/** Fire-and-forget, privacy safe: level names and ids only, never student words. */
export function trackLanguage(eventName, properties = {}) {
  try {
    base44.analytics.track({ eventName, properties });
  } catch {
    // Analytics must never break a student's flow.
  }
}

/** Every LanguagePreference row for the signed-in student. */
export async function loadLanguagePreferences() {
  const rows = await base44.entities.LanguagePreference.list('-created_date', 100).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

const matchesPath = (row, pathId) => Boolean(pathId) && row?.scope !== 'global' && row?.path_id === pathId;

/** The row that governs this path: its own, else the global one, else none. */
export function rowFor(rows, pathId) {
  const list = Array.isArray(rows) ? rows : [];
  return list.find(r => matchesPath(r, pathId)) || list.find(r => r?.scope === 'global') || null;
}

/** The level in force for a path. Balanced when the student has never chosen. */
export function levelFor(rows, pathId) {
  const level = rowFor(rows, pathId)?.level;
  return isLevel(level) ? level : DEFAULT_LEVEL;
}

/** True when this path has never been answered for, so it is worth asking once. */
export function shouldAskFamiliarity(rows, pathId) {
  if (!pathId) return false;
  return !(Array.isArray(rows) ? rows : []).some(r => matchesPath(r, pathId));
}

/**
 * Save the level for a path (or globally when no path is known). Upsert, never
 * insert-again: one row per user per path, so repeated switching cannot pile up
 * duplicates.
 */
export async function saveLanguageLevel({ pathId, pathName, careerName, level, source = 'manual', extra = {} }) {
  if (!isLevel(level)) return null;
  const scope = pathId ? 'path' : 'global';
  const key = `language-level:${scope}:${pathId || 'global'}`;

  return onceInFlight(key, async () => {
    const me = await base44.auth.me().catch(() => null);
    const rows = await loadLanguagePreferences();
    const existing = pathId
      ? rows.find(r => matchesPath(r, pathId))
      : rows.find(r => r?.scope === 'global');

    const payload = {
      user_id: me?.id,
      scope,
      path_id: pathId || undefined,
      path_name: pathName || undefined,
      career_name: careerName || pathName || undefined,
      level,
      source,
      updated_at: new Date().toISOString(),
      ...(source === 'asked' ? { asked_at: new Date().toISOString() } : {}),
      ...extra,
    };

    return existing?.id
      ? base44.entities.LanguagePreference.update(existing.id, payload)
      : base44.entities.LanguagePreference.create(payload);
  });
}

const termKey = (term) => String(term || '').trim().toLowerCase().slice(0, 60);

/**
 * "My Career Vocabulary": one row per term the student chose to keep. Saving the
 * same term twice updates that row instead of adding another.
 */
export async function saveVocabularyTerm({ term, definition, why_it_matters, example, field, path, experiment, guideId, stepNumber }) {
  const key = termKey(term);
  if (!key || !definition) return null;

  return onceInFlight(`vocab:${key}`, async () => {
    const me = await base44.auth.me().catch(() => null);
    const payload = {
      user_id: me?.id,
      term: String(term).trim(),
      term_key: key,
      definition,
      why_it_matters: why_it_matters || undefined,
      example: example || undefined,
      field: field || undefined,
      path_id: path?.id || undefined,
      path_name: path?.path_name || undefined,
      experiment_id: experiment?.id || undefined,
      guide_id: guideId || undefined,
      step_number: Number.isFinite(stepNumber) ? stepNumber : undefined,
      learned_at: new Date().toISOString(),
    };
    const rows = await base44.entities.CareerVocabulary.filter({ term_key: key }, '-created_date', 5).catch(() => []);
    const found = (Array.isArray(rows) ? rows : [])[0];
    return found?.id
      ? base44.entities.CareerVocabulary.update(found.id, payload)
      : base44.entities.CareerVocabulary.create(payload);
  });
}

export async function loadVocabulary() {
  const rows = await base44.entities.CareerVocabulary.list('-created_date', 200).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}