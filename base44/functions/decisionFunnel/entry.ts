import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  eventFunnel, cycleMetrics, recordFunnel, classifyUsers,
  RECONSTRUCTION, REAL_CLASSES, INTERNAL_CLASSES, ANALYTICS_CLASSES,
} from '../../shared/decision-funnel.js';

/**
 * The admin decision-cycle funnel. Team only.
 *
 * Service role, because it reads across students, and the service role must
 * never be reachable from a student session. What leaves this function is
 * counts, medians and opaque account ids — no names, no emails, no reflection
 * text, no answer a student typed.
 *
 * Default behaviour excludes internal accounts: founder, admin, internal_test
 * and automated_test_agent never enter the real-student numbers. Unclassified
 * accounts are excluded too and reported separately, because guessing which
 * historical accounts were real would be the exact mistake this endpoint exists
 * to prevent.
 *
 * POST body: { include?: string[] } to widen the classes counted.
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
    const [users, events, profiles, paths, experiments, measurements, proof, reflections, updates] = await Promise.all([
      svc.User.list('-created_date', CAP).catch(() => []),
      svc.PilotEvent.list('-occurred_at', CAP).catch(() => []),
      svc.StudentProfile.list('-created_date', CAP).catch(() => []),
      svc.PathRecommendations.list('-created_date', CAP).catch(() => []),
      svc.Experiments.list('-created_date', CAP).catch(() => []),
      svc.ExperimentMeasurement.list('-created_date', CAP).catch(() => []),
      svc.ProofOfWork.list('-created_date', CAP).catch(() => []),
      svc.WeeklyReflections.list('-created_date', CAP).catch(() => []),
      svc.HypothesisUpdate.list('-created_date', CAP).catch(() => []),
    ]);

    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const userRows = arr(users);
    const eventRows = arr(events);

    const funnel = eventFunnel({ events: eventRows, users: userRows, include });
    const cycles = cycleMetrics({ events: eventRows, users: userRows, include });
    const records = recordFunnel({
      users: userRows,
      profiles: arr(profiles),
      paths: arr(paths),
      experiments: arr(experiments),
      measurements: arr(measurements),
      proof: arr(proof),
      reflections: arr(reflections),
      updates: arr(updates),
      include,
    });

    // Internal activity, counted so the split is visible rather than assumed.
    const internal = eventFunnel({ events: eventRows, users: userRows, include: INTERNAL_CLASSES });
    const { counts } = classifyUsers(userRows);

    return Response.json({
      generated_at: new Date().toISOString(),
      included_classes: include,
      class_counts: counts,
      event_funnel: funnel,
      cycles,
      internal_activity: {
        entry_students: internal.entry_students,
        events_considered: internal.events_considered,
        stages: internal.stages.map(s => ({ key: s.key, students: s.students, records: s.records })),
      },
      record_funnel: records,
      reconstruction: RECONSTRUCTION,
      // Per-account rows, ids only, so the team can classify accounts without
      // the endpoint ever returning a name or an email.
      accounts: userRows.map(u => ({
        id: u.id,
        analytics_class: ANALYTICS_CLASSES.includes(u.analytics_class) ? u.analytics_class : 'unclassified',
        access_source: u.access_source || null,
        role: u.role || null,
        created_date: u.created_date || null,
        events: eventRows.filter(e => (e.user_id || e.created_by_id) === u.id).length,
        backfilled_events: eventRows.filter(e => (e.user_id || e.created_by_id) === u.id && e.analytics_backfill).length,
      })),
      note: 'Event-derived numbers begin when the instrumentation shipped and describe only what students demonstrably did. Record-derived numbers cover all history but cannot prove a student saw, opened or progressed through anything. The two are never merged.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}