import { useQuery } from '@tanstack/react-query';
import { loadSupportIndex, supportFor } from '@/lib/path-support';

/**
 * The support index, loaded once per session and shared by every screen that
 * needs to know whether a direction can carry a cycle. Library content, so it is
 * cached for a long time and never mixed with student records.
 */
export function useSupportIndex() {
  return useQuery({
    queryKey: ['path-support-index'],
    queryFn: loadSupportIndex,
    staleTime: 30 * 60 * 1000,
  });
}

/** The support reading for one path. `support` is null until the index arrives. */
export default function usePathSupport(pathName) {
  const { data: index, isLoading } = useSupportIndex();
  return {
    index: index || null,
    loading: isLoading,
    support: index && pathName ? supportFor(pathName, index) : null,
  };
}