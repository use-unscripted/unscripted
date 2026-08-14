import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { decisionIntelligence, experimentEffectiveness } from '../../shared/decision-intelligence.js';

/**
 * Aggregate product learning, for the team only.
 *
 * Two reasons this is a backend function rather than a page query. First, it has
 * to read across students, which needs the service role, and the service role
 * must never be reachable from a student's session. Second, the suppression rule
 * has to be applied BEFORE anything leaves the server: a page that received raw
 * rows and hid them in the UI would still have shipped them to the browser.
 *
 * So the response contains counts and averages only. No user ids, no names, no
 * reflection text, no per-student rows.
 */
const CAP = 2000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const [experiments, measurements, reflections, proof, updates, dimensionEvidence, overrides, profiles] = await Promise.all([
      svc.Experiments.list('-created_date', CAP).catch(() => []),
      svc.ExperimentMeasurement.list('-created_date', CAP).catch(() => []),
      svc.WeeklyReflections.list('-created_date', CAP).catch(() => []),
      svc.ProofOfWork.list('-created_date', CAP).catch(() => []),
      svc.HypothesisUpdate.list('-created_date', CAP).catch(() => []),
      svc.CareerDimensionEvidence.list('-created_date', CAP).catch(() => []),
      svc.RecommendationOverride.list('-created_date', CAP).catch(() => []),
      svc.StudentProfile.list('-created_date', CAP).catch(() => []),
    ]);

    const data = {
      experiments: Array.isArray(experiments) ? experiments : [],
      measurements: Array.isArray(measurements) ? measurements : [],
      reflections: Array.isArray(reflections) ? reflections : [],
      proof: Array.isArray(proof) ? proof : [],
      updates: Array.isArray(updates) ? updates : [],
      dimensionEvidence: Array.isArray(dimensionEvidence) ? dimensionEvidence : [],
      overrides: Array.isArray(overrides) ? overrides : [],
      profiles: Array.isArray(profiles) ? profiles : [],
    };

    const payload = decisionIntelligence(data);

    // Persist the per-experience rows so effectiveness can be compared over time
    // rather than only as of this request. Only rows that pass suppression are
    // stored, and they hold no per-student anything.
    const rows = experimentEffectiveness(data).filter((r) => !r.suppressed);
    if (rows.length) {
      const existing = await base44.asServiceRole.entities.ExperimentEffectiveness.list('-computed_at', 500).catch(() => []);
      const byKey = new Map((Array.isArray(existing) ? existing : []).map((r) => [r.blueprint_key, r]));
      for (const row of rows) {
        const { suppressed, students, reason, ...clean } = row;
        const prior = byKey.get(row.blueprint_key);
        if (prior) await base44.asServiceRole.entities.ExperimentEffectiveness.update(prior.id, clean).catch(() => null);
        else await base44.asServiceRole.entities.ExperimentEffectiveness.create(clean).catch(() => null);
      }
    }

    return Response.json({ ...payload, stored_rows: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}