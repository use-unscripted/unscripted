import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { classifyUsers, REAL_CLASSES, INTERNAL_CLASSES, ANALYTICS_CLASSES } from '../../shared/decision-funnel.js';
import {
  validationQueue, validationShortlist, pathCoverage,
  PRIORITY_FACTORS, MAJOR_DIMENSIONS, DIMENSION_GROUPS,
} from '../../shared/validation-priority.js';

/**
 * Which existing experiments to professionally validate next. Team only.
 *
 * Service role, because the ranking depends on what every student was
 * recommended, selected and ran, and no admin browser may read those rows
 * directly. What leaves this function is counts, scores and library metadata —
 * no student id, no name, no reflection text, no answer anyone typed.
 *
 * Internal and unclassified accounts are excluded from every usage count by
 * default and reported separately, so a founder running an experiment repeatedly
 * cannot make it look important.
 *
 * POST body: { include?: string[] } to widen the account classes counted.
 */
const CAP = 5000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let include = REAL_CLASSES;
    try {
      const body = await req.json();
      if (Array.isArray(body?.include) && body.include.length) {
        include = body.include.filter((c: string) => ANALYTICS_CLASSES.includes(c));
      }
    } catch { /* no body: real students only */ }

    const svc = base44.asServiceRole.entities;
    const [users, validations, sources, reviews, blueprints, paths, experiments, feedback, events] = await Promise.all([
      svc.User.list('-created_date', CAP).catch(() => []),
      svc.ExperimentValidation.list('-created_date', 500).catch(() => []),
      svc.CareerSource.list('-source_verified_at', 800).catch(() => []),
      svc.ProfessionalExperimentReview.list('-review_date', 800).catch(() => []),
      svc.RoleBlueprint.list('-created_date', 300).catch(() => []),
      svc.PathRecommendations.list('-created_date', CAP).catch(() => []),
      svc.Experiments.list('-created_date', CAP).catch(() => []),
      svc.ExperimentFeedback.list('-submitted_at', CAP).catch(() => []),
      svc.PilotEvent.list('-occurred_at', CAP).catch(() => []),
    ]);

    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const userRows = arr(users);
    const { byId, counts } = classifyUsers(userRows);
    const idsFor = (classes: string[]) => new Set(
      userRows.filter(u => classes.includes(byId.get(u.id) || 'unclassified')).map(u => u.id));

    const realUserIds = idsFor(include);
    const { rows, unattributed_experiments } = validationQueue({
      validations: arr(validations),
      sources: arr(sources),
      reviews: arr(reviews),
      paths: arr(paths),
      experiments: arr(experiments),
      feedback: arr(feedback),
      events: arr(events),
      blueprints: arr(blueprints),
      realUserIds,
    });

    // The same ranking over internal accounts only, so the team can see how much
    // of an experiment's apparent popularity was their own testing.
    const internalIds = idsFor(INTERNAL_CLASSES);
    const internal = validationQueue({
      validations: arr(validations),
      sources: arr(sources),
      reviews: arr(reviews),
      paths: arr(paths),
      experiments: arr(experiments),
      feedback: arr(feedback),
      events: arr(events),
      blueprints: arr(blueprints),
      realUserIds: internalIds,
    });

    return Response.json({
      generated_at: new Date().toISOString(),
      included_classes: include,
      class_counts: counts,
      factors: PRIORITY_FACTORS,
      dimension_groups: DIMENSION_GROUPS,
      major_dimensions: MAJOR_DIMENSIONS.map(d => ({ id: d.id, label: d.label, group: d.group })),
      shortlist: validationShortlist(rows),
      queue: rows,
      path_coverage: pathCoverage(rows),
      internal_usage: internal.rows
        .filter(r => r.counts.selected_students || r.counts.recommended_students)
        .map(r => ({
          validation_id: r.validation_id,
          title: r.title,
          recommended_students: r.counts.recommended_students,
          selected_students: r.counts.selected_students,
        })),
      unattributed_experiments,
      note: 'Usage counts come from PilotEvent and cover only real students, so they begin when the instrumentation shipped. A student experiment that cannot be linked to a validation record by id, blueprint key or title is counted as unattributed rather than assigned to a guess.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}