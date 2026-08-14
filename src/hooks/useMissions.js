import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { completeMissionWithProof } from '@/lib/mission-completion';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

export const missionsKey = (experimentId) => ['Missions', experimentId || 'none'];

const alive = (rows) => (Array.isArray(rows) ? rows : []).filter(r => r.deletion_status !== 'deleted');

/** The missions of one experiment, cached so a mutation can patch them. */
export function useMissions(experimentId) {
  return useQuery({
    queryKey: missionsKey(experimentId),
    enabled: !!experimentId,
    queryFn: async () => alive(
      await base44.entities.Missions.filter({ experiment_id: experimentId }, 'created_date', 100).catch(() => [])
    ),
  });
}

/**
 * Completing a mission with its evidence. The row reads as completed the moment
 * the student saves, and rolls back if the write fails.
 */
export function useCompleteMission(experimentId) {
  return useOptimisticMutation({
    queryKey: missionsKey(experimentId),
    mutationFn: (vars) => completeMissionWithProof(vars),
    applyOptimistic: (rows, vars) => rows.map(m => (
      m.id === vars?.mission?.id
        ? { ...m, status: 'completed', completed_at: new Date().toISOString() }
        : m
    )),
  });
}