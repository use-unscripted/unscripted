import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { loadOwnedPaths } from '@/lib/path-set';
import { resolveJourney } from '@/lib/journey';

/**
 * Where the student is in the current cycle, for the navigation rail.
 *
 * Same derivation as My Journey — resolveJourney over the same records, nothing
 * new stored. Cached for a minute so moving between deep screens does not
 * refetch the whole cycle on every route change.
 */
export default function useCycleStage() {
  const { data } = useQuery({
    queryKey: ['cycle-rail'],
    staleTime: 60_000,
    queryFn: async () => {
      const [owned, exps, proof, refs] = await Promise.all([
        loadOwnedPaths().catch(() => ({ paths: [] })),
        base44.entities.Experiments.list('-created_date', 100).catch(() => []),
        base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []),
        base44.entities.WeeklyReflections.list('-created_date', 50).catch(() => []),
      ]);
      return resolveJourney({
        paths: owned?.paths || [],
        experiments: Array.isArray(exps) ? exps : [],
        proof: Array.isArray(proof) ? proof : [],
        reflections: Array.isArray(refs) ? refs : [],
      });
    },
  });

  return data || null;
}