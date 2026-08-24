import { useQuery } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import { loadOwnedPaths } from '@/lib/path-set';
import { resolveJourney } from '@/lib/journey';
import { getActiveCycle } from '@/lib/career-cycle';
import { syncPrimaryFocus } from '@/lib/current-path';

/**
 * Where the student is in the current cycle, for the navigation rail.
 *
 * Same derivation as My Journey — resolveJourney over the same records, nothing
 * new stored. Cached for a minute so moving between deep screens does not
 * refetch the whole cycle on every route change.
 *
 * The active cycle is loaded here because it is the authoritative record of
 * which hypothesis is being tested (src/lib/current-path.js). is_primary_focus
 * is brought back in line with it as a side effect, and only when a row
 * actually disagrees.
 */
export const CYCLE_RAIL_KEY = ['cycle-rail'];

/**
 * Force the rail to re-derive the stage.
 *
 * Call this after writing a record the stage is derived FROM — a piece of
 * evidence, a reflection. Without it the cached derivation stands for up to a
 * minute, so a student who has just submitted evidence lands on the reflection
 * with the rail still marking Test, which reads as "nothing was recorded".
 */
export function refreshCycleStage() {
  return queryClientInstance.invalidateQueries({ queryKey: CYCLE_RAIL_KEY });
}

export default function useCycleStage() {
  const { data } = useQuery({
    queryKey: CYCLE_RAIL_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const [owned, cycle, exps, proof, refs] = await Promise.all([
        loadOwnedPaths().catch(() => ({ paths: [] })),
        getActiveCycle().catch(() => null),
        base44.entities.Experiments.list('-created_date', 100).catch(() => []),
        base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []),
        base44.entities.WeeklyReflections.list('-created_date', 50).catch(() => []),
      ]);
      const paths = owned?.paths || [];
      await syncPrimaryFocus(cycle, paths).catch(() => null);
      return resolveJourney({
        paths,
        cycle,
        experiments: Array.isArray(exps) ? exps : [],
        proof: Array.isArray(proof) ? proof : [],
        reflections: Array.isArray(refs) ? refs : [],
      });
    },
  });

  return data || null;
}