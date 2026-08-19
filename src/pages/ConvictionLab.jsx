/**
 * The Conviction Lab for one Path: what this student still needs to learn before
 * they could make a confident decision about it.
 *
 * Every block on this page is an existing component reading existing records —
 * the uncertainty checklist, the recommendation engine, and the path's own
 * longitudinal history. Because it is keyed on a pathId and every test it offers
 * is a normal Quick Test or experiment on that path, a student can come back and
 * test the same path again as often as they like without touching onboarding.
 */
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import ConvictionSummary from '@/components/conviction/ConvictionSummary';
import ConvictionRecord from '@/components/conviction/ConvictionRecord';
import UnknownsChecklist from '@/components/stages/UnknownsChecklist';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import PathHistoryPanel from '@/components/paths/PathHistoryPanel';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import { loadConvictionLab } from '@/lib/conviction-lab';
import { Sk } from '@/components/PageSkeleton';

export default function ConvictionLab() {
  const [params] = useSearchParams();
  const pathId = params.get('pathId') || '';

  const { data: lab, isLoading } = useQuery({
    queryKey: ['conviction-lab', pathId || 'none'],
    enabled: Boolean(pathId),
    staleTime: 30_000,
    queryFn: () => loadConvictionLab(pathId),
  });

  if (!pathId || (!isLoading && !lab)) {
    return (
      <main className="app-page">
        <PageHeader showBack backLabel="Go back" title="Conviction Lab" />
        <JourneyEmptyState variant="paths" />
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        showBack
        backLabel="Go back"
        title="Conviction Lab"
        description="What this path still needs evidence on before a decision about it would rest on more than a guess."
      />
      <div className="app-stack">
        {isLoading || !lab ? (
          <>
            <Sk h={220} r={16} />
            <Sk h={280} r={16} />
          </>
        ) : (
          <>
            <ConvictionSummary lab={lab} />
            {/* How much real evidence stands behind this path, in eight areas. */}
            <ConvictionRecord record={lab.record} />
            <UnknownsChecklist progress={lab.progress} pathId={lab.path.id} />
            <NextBestExperimentPanel pathId={lab.path.id} />
            <PathHistoryPanel pathId={lab.path.id} />
            <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
              <Link to="/test" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>The test you are on</Link>
              {' · '}
              <Link to="/matrix" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Career Decision Matrix</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}