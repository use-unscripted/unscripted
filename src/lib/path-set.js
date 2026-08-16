/**
 * Authoritative path-set resolution.
 *
 * A student's personalised paths are the rows PathRecommendations holds for
 * them. Nothing in here generates, deletes or rewrites anything — it only reads
 * and groups, so a page can always tell the difference between
 * "this student has no paths" and "this student's paths failed to load".
 *
 * Grouping: newer rows carry `path_set_id`, written at generation time. Legacy
 * rows predate that field, and every generation wrote its rows in one
 * bulkCreate, so rows sharing a created_date minute are one generation. That
 * minute bucket is the ONLY inference made here, and it is exposed as a
 * synthetic id prefixed `legacy:` so a caller can tell it apart from a real one.
 */
import { base44 } from '@/api/base44Client';

const minuteKey = (row) => String(row.created_date || '').slice(0, 16);

export function setIdOf(row) {
  return row.path_set_id || `legacy:${minuteKey(row)}`;
}

/** Every path row this user owns. Ownership is asserted client-side too, so a
 *  future RLS regression cannot put another student's path on screen. */
export async function loadOwnedPaths() {
  /* Both reads at once. The path rows never depended on the user object — the
     ownership assertion below only needs both to have arrived — and awaiting
     them in sequence cost a whole extra round trip on every screen that loads
     paths. */
  const [user, rows] = await Promise.all([
    base44.auth.me(),
    base44.entities.PathRecommendations.list('-created_date', 500),
  ]);
  const paths = (Array.isArray(rows) ? rows : []).filter(
    r => r && (r.created_by_id === user.id || r.user_id === user.id)
      // A row merged into another by the data-integrity pass is history, not a
      // hypothesis. Filtering it at the one loader every screen and engine reads
      // means nothing can offer it, select it, or count it twice.
      && r.integrity_status !== 'merged'
  );
  return { user, paths };
}

/** Groups, newest first. Each: { setId, generatedAt, status, paths }. */
export function resolvePathSets(paths) {
  const groups = new Map();
  for (const row of paths) {
    const id = setIdOf(row);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return [...groups.entries()]
    .map(([setId, rows]) => ({
      setId,
      generatedAt: rows[0].generated_at || rows[0].created_date || null,
      status: rows[0].generation_status || (rows.length === 3 ? 'complete' : 'incomplete'),
      paths: rows,
    }))
    .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
}

/** The set to present as "your original three": the newest complete set if one
 *  exists, otherwise the newest set at all — never a fabricated one. */
export function authoritativeSet(paths) {
  const sets = resolvePathSets(paths);
  if (!sets.length) return null;
  return sets.find(s => s.paths.length === 3) || sets[0];
}

/** Did this student finish onboarding? A saved profile is the record of it. */
export async function loadOnboardingSubmission() {
  const rows = await base44.entities.StudentProfile.list('-created_date', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}