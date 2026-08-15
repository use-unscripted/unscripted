import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { byOwner, linkIndex, planPathDedupe, resolveCycleAuthority } from '../../shared/data-integrity.js';

/**
 * Data-integrity audit and repair. Admin only.
 *
 * payload: { action: 'audit' | 'apply', userId?: string }
 *   audit  — reports duplicates, active-cycle conflicts and legacy dependencies.
 *            Writes nothing.
 *   apply  — performs only the merges the plan calls unambiguous, plus cycle
 *            supersession where authority is clear. Ambiguous rows are stamped
 *            for review instead. Nothing is deleted, ever.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action === 'apply' ? 'apply' : 'audit';
    const onlyUser = body.userId || null;
    const E = base44.asServiceRole.entities;

    const [paths, experiments, proof, reflections, updates, cycles, missions] = await Promise.all([
      E.PathRecommendations.list('-created_date', 2000),
      E.Experiments.list('-created_date', 2000),
      E.ProofOfWork.list('-created_date', 2000),
      E.WeeklyReflections.list('-created_date', 2000),
      E.HypothesisUpdate.list('-created_date', 2000),
      E.CareerCycle.list('-created_date', 2000),
      E.Missions.list('-created_date', 500),
    ]);

    const counts = linkIndex({ experiments, proof, reflections, updates, cycles });
    const liveExperimentIds = new Set(
      experiments.filter((e) => e.deletion_status !== 'deleted').map((e) => e.id)
    );

    const pathsByUser = byOwner(paths);
    const cyclesByUser = byOwner(cycles.filter((c) => c.status === 'active'));

    const merged: any[] = [];
    const review: any[] = [];
    const plannedMerges: any[] = [];
    const cycleConflicts: any[] = [];

    for (const [owner, rows] of pathsByUser) {
      if (onlyUser && owner !== onlyUser) continue;
      const plan = planPathDedupe(rows, counts);
      plan.merges.forEach((m) => plannedMerges.push({ owner, ...m }));
      plan.review.forEach((r) => review.push({ owner, kind: 'duplicate_hypothesis', ...r }));

      if (action === 'apply') {
        for (const m of plan.merges) {
          if (m.remap) {
            const remap = async (rowsToFix: any[], entity: any, field: string) => {
              for (const row of rowsToFix) {
                if (row[field] === m.duplicate_id) {
                  await entity.update(row.id, { [field]: m.keep_id });
                }
              }
            };
            await remap(experiments, E.Experiments, 'path_id');
            await remap(experiments, E.Experiments, 'path_recommendation_id');
            await remap(proof, E.ProofOfWork, 'path_id');
            await remap(reflections, E.WeeklyReflections, 'path_id');
            await remap(updates, E.HypothesisUpdate, 'path_id');
            for (const c of cycles) {
              if (c.selected_path_id === m.duplicate_id) {
                await E.CareerCycle.update(c.id, { selected_path_id: m.keep_id, selected_path_name: m.keep_name });
              }
            }
          }
          await E.PathRecommendations.update(m.duplicate_id, {
            status: 'archived',
            is_primary_focus: false,
            integrity_status: 'merged',
            duplicate_of_id: m.keep_id,
            integrity_note: m.reason,
          });
          merged.push({ owner, ...m });
        }
        for (const r of plan.review) {
          await E.PathRecommendations.update(r.duplicate_id, {
            integrity_status: 'review',
            duplicate_of_id: r.keep_id,
            integrity_note: r.reason,
          });
        }
      }
    }

    for (const [owner, active] of cyclesByUser) {
      if (onlyUser && owner !== onlyUser) continue;
      if (active.length <= 1) continue;
      const res = resolveCycleAuthority(active, liveExperimentIds);
      cycleConflicts.push({
        owner,
        active_count: active.length,
        authoritative_id: res.authoritative?.id || null,
        ambiguous: res.ambiguous,
        reason: res.reason,
        superseded: res.supersede.map((c: any) => c.id),
        flagged: res.review.map((c: any) => c.id),
      });

      if (action === 'apply') {
        for (const c of res.supersede) {
          await E.CareerCycle.update(c.id, { status: 'abandoned', legacy_review: true });
        }
        for (const c of res.review) {
          await E.CareerCycle.update(c.id, { legacy_review: true });
        }
        res.review.forEach((c: any) =>
          review.push({ owner, kind: 'active_cycle_conflict', cycle_id: c.id, reason: res.reason })
        );
      }
    }

    const missionRefs = {
      proof: proof.filter((p) => p.mission_id).length,
      reflections: reflections.filter((r) => r.mission_id).length,
      missions: missions.length,
    };

    return Response.json({
      action,
      scanned: { paths: paths.length, users: pathsByUser.size, cycles: cycles.length },
      duplicates_found: plannedMerges.length + review.filter((r) => r.kind === 'duplicate_hypothesis').length,
      duplicates_merged: merged.length,
      duplicates_planned: plannedMerges,
      manual_review: review,
      active_cycle_conflicts: cycleConflicts,
      legacy_missions: missionRefs,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}