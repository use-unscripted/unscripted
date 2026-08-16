import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  buildBackfillEvents, withoutExisting, summarise, BACKFILL_EVENTS, NOT_BACKFILLABLE,
} from '../../shared/analytics-backfill.js';

/**
 * Backfills funnel events that stored records PROVE happened. Team only.
 *
 * Nothing is fabricated: every row written carries analytics_backfill: true and
 * a backfill_basis naming the record it came from, and every milestone a record
 * cannot prove is reported as unknown instead of being written.
 *
 * POST { dry_run?: boolean }  — dry_run (the default) reports what WOULD be
 * written and writes nothing. Pass dry_run: false to commit.
 *
 * Idempotent: dedupe keys are derived from the source record, so a second run
 * over the same data writes zero rows.
 */
const CAP = 5000;
const BATCH = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let dryRun = true;
    try {
      const body = await req.json();
      if (body && body.dry_run === false) dryRun = false;
    } catch { /* no body: dry run */ }

    const svc = base44.asServiceRole.entities;
    const [
      profiles, paths, experiments, measurements, proof, reflections, updates,
      cycles, feedback, scenarios, conversations, existing,
    ] = await Promise.all([
      svc.StudentProfile.list('-created_date', CAP).catch(() => []),
      svc.PathRecommendations.list('-created_date', CAP).catch(() => []),
      svc.Experiments.list('-created_date', CAP).catch(() => []),
      svc.ExperimentMeasurement.list('-created_date', CAP).catch(() => []),
      svc.ProofOfWork.list('-created_date', CAP).catch(() => []),
      svc.WeeklyReflections.list('-created_date', CAP).catch(() => []),
      svc.HypothesisUpdate.list('-created_date', CAP).catch(() => []),
      svc.CareerCycle.list('-created_date', CAP).catch(() => []),
      svc.ExperimentFeedback.list('-created_date', CAP).catch(() => []),
      svc.ScenarioResponse.list('-created_date', CAP).catch(() => []),
      svc.HumanRealityConversation.list('-created_date', CAP).catch(() => []),
      svc.PilotEvent.list('-occurred_at', CAP).catch(() => []),
    ]);

    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const built = buildBackfillEvents({
      profiles: arr(profiles), paths: arr(paths), experiments: arr(experiments),
      measurements: arr(measurements), proof: arr(proof), reflections: arr(reflections),
      updates: arr(updates), cycles: arr(cycles), feedback: arr(feedback),
      scenarios: arr(scenarios), conversations: arr(conversations),
    });
    const pending = withoutExisting(built, arr(existing));

    let written = 0;
    if (!dryRun && pending.length) {
      for (let i = 0; i < pending.length; i += BATCH) {
        const slice = pending.slice(i, i + BATCH);
        await svc.PilotEvent.bulkCreate(slice);
        written += slice.length;
      }
    }

    return Response.json({
      generated_at: new Date().toISOString(),
      dry_run: dryRun,
      events_provable: built.length,
      events_already_on_file: built.length - pending.length,
      events_pending: pending.length,
      events_written: written,
      by_event: summarise(pending),
      backfillable_events: BACKFILL_EVENTS,
      left_unknown: NOT_BACKFILLABLE,
      note: 'Every row written is marked analytics_backfill and carries the record it was derived from. Milestones no record can prove are left unknown rather than invented, and no account is retroactively classified.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}