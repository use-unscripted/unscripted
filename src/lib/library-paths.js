/**
 * The other paths a student can explore.
 *
 * Their own three come from PathRecommendations. This adds the rest of the
 * validated career library as browsable options, so nobody is limited to three
 * directions. Adding one writes a normal path row, which means every downstream
 * screen (Choose, Test, the matrix, the evidence model) treats it exactly like a
 * generated path — no second kind of path anywhere.
 *
 * The row is deliberately marked so it is never mistaken for a generated set:
 *  - `generation_status: 'manual'` says a person chose it, not the generator.
 *  - a unique `path_set_id` keeps it out of the student's original three, which
 *    stay the authoritative comparison set.
 */
import { base44 } from '@/api/base44Client';
import { CAREERS } from '@/lib/career-library/careers';

const norm = (s) => String(s || '').toLowerCase().trim();

/** Library careers the student does not already have a path for. */
export function libraryCareersNotOwned(ownedPaths = []) {
  const owned = new Set(ownedPaths.map(p => norm(p.path_name)));
  const ownedKeys = new Set(ownedPaths.map(p => norm(p.path_id)));
  return CAREERS.filter(c => !owned.has(norm(c.title)) && !ownedKeys.has(norm(c.key)));
}

/** Free-text filter over title, family and what the work involves. */
export function filterCareers(careers, query) {
  const q = norm(query);
  if (!q) return careers;
  return careers.filter(c =>
    norm(c.title).includes(q)
    || norm(c.family).includes(q)
    || (c.match_terms || []).some(t => norm(t).includes(q))
    || (c.core_tasks || []).some(t => norm(t).includes(q)));
}

/** One line describing the work, for the browse list. */
export function careerSummary(career) {
  return career.core_tasks?.[0] || career.work_environment || '';
}

/** Adds a library career as a path this student can test. Returns the row. */
export async function addLibraryPath(career) {
  const me = await base44.auth.me().catch(() => null);
  return base44.entities.PathRecommendations.create({
    user_id: me?.id || undefined,
    path_set_id: `self:${Date.now()}`,
    path_id: career.key,
    path_name: career.title,
    path_category: career.family,
    generation_status: 'manual',
    generated_at: new Date().toISOString(),
    fit_reason: 'You added this path yourself because you wanted to explore it.',
    description: career.work_environment || undefined,
    main_tradeoffs: career.work_schedule_notes || undefined,
    status: 'exploring',
    hypothesis_status: 'untested',
    confidence_level: 'low',
    confidence_explanation: 'No evidence yet. You added this path to find out whether it fits.',
  });
}