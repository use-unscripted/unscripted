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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import ConvictionSummary from '@/components/conviction/ConvictionSummary';
import ConvictionRecord from '@/components/conviction/ConvictionRecord';
import DecisionReadinessCard from '@/components/conviction/DecisionReadinessCard';
import ConvictionReview from '@/components/conviction/ConvictionReview';
import ConvictionPassport from '@/components/conviction/ConvictionPassport';
import ConvictionGap from '@/components/conviction/ConvictionGap';
import ChangeYourMind from '@/components/conviction/ChangeYourMind';
import WorthTesting from '@/components/conviction/WorthTesting';
import TradeoffsSection from '@/components/conviction/TradeoffsSection';
import ComparativeTest from '@/components/conviction/ComparativeTest';
import ExpectationEvidence from '@/components/conviction/ExpectationEvidence';
import UnknownsChecklist from '@/components/stages/UnknownsChecklist';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import PathHistoryPanel from '@/components/paths/PathHistoryPanel';
import JourneyEmptyState from '@/components/journey/JourneyEmptyState';
import { loadConvictionLab } from '@/lib/conviction-lab';
import { loadOwnedPaths } from '@/lib/path-set';
import { getActiveCycle } from '@/lib/career-cycle';
import { resolveCurrentPath } from '@/lib/current-path';
import { Sk } from '@/components/PageSkeleton';

export default function ConvictionLab() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const requestedId = params.get('pathId') || '';

  /* The Lab is a destination in the nav now, so it can be opened without a path
     in the URL. In that case it opens on the path the student is actually
     testing, which is the cycle's own answer to that question. */
  const { data: fallbackId, isLoading: resolving } = useQuery({
    queryKey: ['conviction-lab-current-path'],
    enabled: !requestedId,
    staleTime: 30_000,
    queryFn: async () => {
      const [cycle, owned] = await Promise.all([
        getActiveCycle().catch(() => null),
        loadOwnedPaths().catch(() => ({ paths: [] })),
      ]);
      return resolveCurrentPath(cycle, owned?.paths || [])?.id || '';
    },
  });

  const pathId = requestedId || fallbackId || '';

  const { data: lab, isLoading: loadingLab } = useQuery({
    queryKey: ['conviction-lab', pathId || 'none'],
    enabled: Boolean(pathId),
    staleTime: 30_000,
    queryFn: () => loadConvictionLab(pathId),
  });

  const isLoading = resolving || loadingLab;

  if (!isLoading && (!pathId || !lab)) {
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
            {/* Where this path stands, in states rather than a percentage. */}
            <DecisionReadinessCard readiness={lab.decisionReadiness} />
            {/* One concise read of this path, from the student's own records. */}
            <ConvictionReview review={lab.review} />
            {/* Offered at Decision Ready. A draft until the student approves it. */}
            <ConvictionPassport
              path={lab.path}
              review={lab.review}
              ready={lab.decisionReadiness?.key === 'ready'}
            />
            {/* The one thing this path most needs next, and the recommendation
                below is pointed at it. */}
            <ConvictionGap gap={lab.gap} />
            {/* The assumption worth attacking, linked to the same next test. */}
            <ChangeYourMind change={lab.changeOfMind} />
            {/* Where two pieces of existing evidence disagree. Shown as an open
                question, never as a finding. */}
            <WorthTesting tensions={lab.tensions} />
            {/* How much real evidence stands behind this path, in eight areas. */}
            <ConvictionRecord record={lab.record} />
            {/* What each test on this path was expected to feel like, against
                what it actually felt like. */}
            {/* With a second credible path, the difference worth testing between
                them. Never a preference question. */}
            <ComparativeTest comparison={lab.comparison} />
            {/* The recorded costs of this work, and where the student stands. */}
            <TradeoffsSection
              tradeoffs={lab.tradeoffs}
              path={lab.path}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ['conviction-lab', pathId] })}
            />
            <ExpectationEvidence evidence={lab.expectations} pathId={lab.path.id} />
            <UnknownsChecklist progress={lab.progress} pathId={lab.path.id} />
            <NextBestExperimentPanel
              pathId={lab.path.id}
              preferVariable={lab.gap?.variable || null}
              gap={lab.gap || null}
            />
            <PathHistoryPanel pathId={lab.path.id} />
            <p className="tp-meta text-center" style={{ color: 'var(--text-muted)' }}>
              <Link to="/test" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>The test you are on</Link>
              {' · '}
              <Link to="/all-paths" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Test a different path</Link>
              {' · '}
              <Link to="/matrix" className="font-semibold" style={{ color: 'var(--brand-navy-700)' }}>Career Decision Matrix</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}