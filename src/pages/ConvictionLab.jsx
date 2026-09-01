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
import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import ConvictionSummary from '@/components/conviction/ConvictionSummary';
import LabDeck from '@/components/conviction/LabDeck';
import ConvictionRecord from '@/components/conviction/ConvictionRecord';
import DecisionReadinessCard from '@/components/conviction/DecisionReadinessCard';
import PathDecisionStrengthCard from '@/components/conviction/PathDecisionStrengthCard';
import ConvictionReview from '@/components/conviction/ConvictionReview';
import ConvictionPassport from '@/components/conviction/ConvictionPassport';
import ConvictionGap from '@/components/conviction/ConvictionGap';
import ConvictionGapRoster from '@/components/conviction/ConvictionGapRoster';
import ChangeYourMind from '@/components/conviction/ChangeYourMind';
import WorthTesting from '@/components/conviction/WorthTesting';
import TradeoffsSection from '@/components/conviction/TradeoffsSection';
import ComparativeTest from '@/components/conviction/ComparativeTest';
import ExpectationEvidence from '@/components/conviction/ExpectationEvidence';
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
  /* Which of the eight gaps the student chose to aim the next test at. Null
     means the recommendation stands: the single biggest gap. */
  const [chosenGap, setChosenGap] = useState(null);

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
        description="What this path still needs evidence on."
      />
      <div className="app-stack">
        {isLoading || !lab ? (
          <>
            <Sk h={220} r={16} />
            <Sk h={280} r={16} />
          </>
        ) : (
          <>
            {/* Always on screen: where the path stands, and the one thing to
                do next. Everything else is one click away in the deck below. */}
            <ConvictionSummary lab={lab} />
            <ConvictionGapRoster
              roster={lab.gapRoster}
              selectedId={chosenGap?.id || null}
              onStartTest={setChosenGap}
            />
            {/* Two readings, side by side: is there enough to decide, and how
                much weight the evidence actually carries. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <DecisionReadinessCard readiness={lab.decisionReadiness} />
              <PathDecisionStrengthCard strength={lab.decisionStrength} />
            </div>
            <NextBestExperimentPanel
              key={chosenGap?.id || 'recommended'}
              pathId={lab.path.id}
              preferVariable={(chosenGap || lab.gap)?.variable || null}
              gap={chosenGap || lab.gap || null}
            />
            {/* The same panels as before, one at a time. Empty ones are left out
                rather than shown as a blank step. */}
            <LabDeck
              items={[
                lab.gap && {
                  key: 'gap', label: 'Biggest gap',
                  node: <ConvictionGap gap={lab.gap} />,
                },
                lab.changeOfMind && {
                  key: 'change', label: 'Change your mind',
                  node: <ChangeYourMind change={lab.changeOfMind} />,
                },
                lab.tensions?.length && {
                  key: 'tensions', label: 'Worth testing',
                  node: <WorthTesting tensions={lab.tensions} />,
                },
                lab.tradeoffs?.length && {
                  key: 'tradeoffs', label: 'Tradeoffs',
                  node: (
                    <TradeoffsSection
                      tradeoffs={lab.tradeoffs}
                      path={lab.path}
                      onChanged={() => queryClient.invalidateQueries({ queryKey: ['conviction-lab', pathId] })}
                    />
                  ),
                },
                lab.comparison && {
                  key: 'comparison', label: 'This path vs another',
                  node: <ComparativeTest comparison={lab.comparison} />,
                },
                lab.record && {
                  key: 'record', label: 'Evidence so far',
                  node: <ConvictionRecord record={lab.record} />,
                },
                lab.expectations && {
                  key: 'expectations', label: 'Expected vs actual',
                  node: <ExpectationEvidence evidence={lab.expectations} pathId={lab.path.id} />,
                },
                lab.review && {
                  key: 'review', label: 'Full read',
                  node: <ConvictionReview review={lab.review} />,
                },
                {
                  key: 'history', label: 'History',
                  node: <PathHistoryPanel pathId={lab.path.id} />,
                },
                {
                  key: 'passport', label: 'Passport',
                  node: (
                    <ConvictionPassport
                      path={lab.path}
                      review={lab.review}
                      ready={lab.decisionReadiness?.key === 'ready'}
                    />
                  ),
                },
              ].filter(Boolean)}
            />
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