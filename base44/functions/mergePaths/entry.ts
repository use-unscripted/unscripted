import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findLookalikePairs, linkIndex } from '../../shared/data-integrity.js';

/**
 * Student-facing path merge.
 *
 * Everything here runs user-scoped, so row-level security already limits it to
 * the caller's own records — a student can only ever merge two of their own
 * paths.
 *
 * payload:
 *   { action: 'find' }                          → look-alike pairs to resolve
 *   { action: 'merge', keep_id, duplicate_id }  → move the duplicate's progress
 *                                                 onto the kept path and archive
 *                                                 the duplicate (reversible: it
 *                                                 is stamped, never deleted)
 */
async function loadOwn(base44) {
  const E = base44.entities;
  const [paths, experiments, proof, reflections, updates, cycles] = await Promise.all([
    E.PathRecommendations.list('-created_date', 200),
    E.Experiments.list('-created_date', 300),
    E.ProofOfWork.list('-created_date', 300),
    E.WeeklyReflections.list('-created_date', 200),
    E.HypothesisUpdate.list('-created_date', 300),
    E.CareerCycle.list('-created_date', 100),
  ]);
  return { paths, experiments, proof, reflections, updates, cycles };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action === 'merge' ? 'merge' : 'find';
    const E = base44.entities;
    const data = await loadOwn(base44);
    const counts = linkIndex(data);

    if (action === 'find') {
      return Response.json({ pairs: findLookalikePairs(data.paths, counts) });
    }

    const keep = data.paths.find((p: any) => p.id === body.keep_id);
    const dup = data.paths.find((p: any) => p.id === body.duplicate_id);
    if (!keep || !dup || keep.id === dup.id) {
      return Response.json({ error: 'Both paths must be your own, and different.' }, { status: 400 });
    }

    // Everything that pointed at the duplicate now points at the kept path.
    const moved = { experiments: 0, proof: 0, reflections: 0, updates: 0, cycles: 0 };

    for (const e of data.experiments) {
      const patch: Record<string, unknown> = {};
      if (e.path_id === dup.id) patch.path_id = keep.id;
      if (e.path_recommendation_id === dup.id) patch.path_recommendation_id = keep.id;
      if (Object.keys(patch).length) {
        patch.path_name = keep.path_name;
        await E.Experiments.update(e.id, patch);
        moved.experiments += 1;
      }
    }
    for (const p of data.proof) {
      if (p.path_id === dup.id) {
        await E.ProofOfWork.update(p.id, { path_id: keep.id });
        moved.proof += 1;
      }
    }
    for (const r of data.reflections) {
      if (r.path_id === dup.id) {
        await E.WeeklyReflections.update(r.id, { path_id: keep.id, path_name: keep.path_name });
        moved.reflections += 1;
      }
    }
    for (const u of data.updates) {
      if (u.path_id === dup.id) {
        await E.HypothesisUpdate.update(u.id, { path_id: keep.id, path_name: keep.path_name });
        moved.updates += 1;
      }
    }
    for (const c of data.cycles) {
      if (c.selected_path_id === dup.id) {
        await E.CareerCycle.update(c.id, { selected_path_id: keep.id, selected_path_name: keep.path_name });
        moved.cycles += 1;
      }
    }

    // The kept path takes over the duplicate's place in the cycle if it had one.
    const keepPatch: Record<string, unknown> = {
      last_active_at: new Date().toISOString().split('T')[0],
    };
    if (dup.is_primary_focus) {
      keepPatch.is_primary_focus = true;
      keepPatch.status = 'active';
    }
    await E.PathRecommendations.update(keep.id, keepPatch);

    await E.PathRecommendations.update(dup.id, {
      status: 'archived',
      is_primary_focus: false,
      integrity_status: 'merged',
      duplicate_of_id: keep.id,
      integrity_note: `Merged into "${keep.path_name}" by the student on ${new Date().toISOString().split('T')[0]}.`,
    });

    return Response.json({
      merged: true,
      keep_id: keep.id,
      keep_name: keep.path_name,
      duplicate_id: dup.id,
      duplicate_name: dup.path_name,
      moved,
      moved_total: moved.experiments + moved.proof + moved.reflections + moved.updates + moved.cycles,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}