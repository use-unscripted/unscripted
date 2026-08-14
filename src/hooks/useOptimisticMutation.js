import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * A mutation that shows its result before the network confirms it.
 *
 * onMutate patches the cached list, so the row changes under the student's
 * finger; a failure puts the previous list back, and either way the list is
 * revalidated once the request settles.
 */
export function useOptimisticMutation({ queryKey, mutationFn, applyOptimistic, onSuccess }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      // An in-flight refetch would otherwise land on top of the patch.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (rows) => applyOptimistic(Array.isArray(rows) ? rows : [], vars));
      return { previous };
    },
    onError: (err, _vars, context) => {
      console.error('[mutation] rolled back:', err?.message || 'unknown');
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess,
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export default useOptimisticMutation;