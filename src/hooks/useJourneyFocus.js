import { useQuery } from '@tanstack/react-query';
import { loadJourneyFocus } from '@/lib/journey-focus';
import useCycleStage from '@/hooks/useCycleStage';

/**
 * The focus view model (what we know, what is unknown, the other paths, the
 * clarity record) for whichever path the cycle says is being tested.
 *
 * Same derivation My Journey used when it carried all of these panels itself —
 * the stage screens now read it here instead, so nothing is computed twice.
 */
export default function useJourneyFocus() {
  const journey = useCycleStage();
  const currentPathName = journey?.currentPath?.path_name;

  const { data, isLoading } = useQuery({
    queryKey: ['journey-focus', currentPathName || 'none'],
    staleTime: 60_000,
    queryFn: () => loadJourneyFocus({ currentPathName }),
  });

  return { journey, focus: data?.focus || null, data: data || null, isLoading };
}