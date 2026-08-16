/**
 * Loads one path's longitudinal record and shows it: the evidence so far, then
 * the tests in order. Renders nothing until there is a path to read.
 */
import { useQuery } from '@tanstack/react-query';
import { loadPathHistory } from '@/lib/path-history';
import PathEvidenceSoFar from '@/components/paths/PathEvidenceSoFar';
import PathTestTimeline from '@/components/paths/PathTestTimeline';
import { Sk } from '@/components/PageSkeleton';

export default function PathHistoryPanel({ pathId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['path-history', pathId || 'none'],
    enabled: Boolean(pathId),
    staleTime: 30_000,
    queryFn: () => loadPathHistory(pathId),
  });

  if (!pathId) return null;
  if (isLoading) return <Sk h={280} r={16} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <PathEvidenceSoFar history={data} />
      <PathTestTimeline timeline={data.timeline} pathName={data.path?.path_name} />
    </div>
  );
}