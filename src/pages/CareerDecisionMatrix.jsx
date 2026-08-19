import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useDecisionMatrix from '@/hooks/useDecisionMatrix';
import PageHeader from '@/components/PageHeader';
import PageSkeleton, { SkCards, Sk } from '@/components/PageSkeleton';
import HowThisWorks from '@/components/matrix/HowThisWorks';
import StrongestHypothesis from '@/components/matrix/StrongestHypothesis';
import MatrixTable from '@/components/matrix/MatrixTable';
import MatrixCards from '@/components/matrix/MatrixCards';
import ConvictionInMatrix from '@/components/matrix/ConvictionInMatrix';
import QuadrantChart from '@/components/matrix/QuadrantChart';
import PathConvictionCard from '@/components/matrix/PathConvictionCard';
import { plotPaths } from '@/lib/matrix-quadrant';
import MetricPanel from '@/components/matrix/MetricPanel';
import ConfidenceHistoryChart from '@/components/matrix/ConfidenceHistoryChart';
import WorkstyleMatrix from '@/components/matrix/WorkstyleMatrix';
import WorkstyleDetail from '@/components/matrix/WorkstyleDetail';
import ChangedMind from '@/components/matrix/ChangedMind';
import ClaritySummary from '@/components/matrix/ClaritySummary';
import JourneyHistory from '@/components/matrix/JourneyHistory';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
import ScenarioEvidenceInMatrix from '@/components/matrix/ScenarioEvidenceInMatrix';
import { loadEvidenceConfig } from '@/lib/evidence-weights';
import { withScenarioSignals } from '@/lib/matrix-workstyle-scenarios';
import { withHumanReality } from '@/lib/matrix-human-reality';
import HumanExposurePanel from '@/components/matrix/HumanExposurePanel';
import { loadConversations } from '@/lib/human-reality';
import { Reveal } from '@/components/motion';

const track = (eventName, properties) => base44.analytics.track({ eventName, properties });

/** The one thing to do when there is not enough recorded work to draw a matrix. */
function EmptyState({ title, body, ctaLabel, ctaTo }) {
  return (
    <section className="app-card p-8 text-center">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      <p className="tp-body mx-auto mt-3 max-w-[52ch]" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      {ctaTo && <Link to={ctaTo} className="app-cta tp-control mt-6 inline-flex">{ctaLabel}</Link>}
    </section>
  );
}

export default function CareerDecisionMatrix() {
  const { loading, data } = useDecisionMatrix();
  // Which metric on which hypothesis is being inspected. The metric matters:
  // a student who clicked Evidence Coverage is asking about coverage, not for
  // every number on the row at once.
  const [scored, setScored] = useState(null);
  const [dimension, setDimension] = useState(null);
  const [view, setView] = useState('active');
  // Which path's marker was tapped on the quadrant chart.
  const [plotted, setPlotted] = useState(null);
  const [scenarioResponses, setScenarioResponses] = useState([]);
  const [conversations, setConversations] = useState([]);

  useEffect(() => { track('career_matrix_viewed'); }, []);

  // The student's hypothetical answers, for the provenance panels, plus any
  // admin-tuned weights this page should read the evidence under.
  useEffect(() => {
    let alive = true;
    loadEvidenceConfig().catch(() => null);
    base44.entities.ScenarioResponse.list('-completed_at', 200)
      .then(rows => { if (alive) setScenarioResponses(Array.isArray(rows) ? rows : []); })
      .catch(() => {});
    loadConversations().then(rows => { if (alive) setConversations(rows); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <PageSkeleton title description action={false}>
        <Sk h={140} r={16} />
        <div className="mt-6"><SkCards count={3} h={160} /></div>
      </PageSkeleton>
    );
  }

  const openScore = (row, metric) => {
    setScored({ row, metric });
    track('hypothesis_score_opened', { metric, hypothesis: row.name });
    if (metric === 'confidence') track('score_explanation_opened', { hypothesis: row.name });
    if (metric === 'expectation') track('expectation_reality_viewed', { hypothesis: row.name });
    if (metric === 'uncertainty') track('uncertainty_opened', { hypothesis: row.name });
  };

  const openDimension = (row) => {
    setDimension(row);
    track('workstyle_dimension_opened', { dimension: row.dimension });
  };

  const rows = view === 'active' ? (data?.active || []) : (data?.history || []);

  return (
    <main className="app-page">
      <PageHeader
        title="Career Decision Matrix"
        description="See how real experiences are shaping your paths over time."
      />
      <p className="tp-body -mt-6" style={{ color: 'var(--text-muted)', maxWidth: '60ch' }}>
        These scores reflect the evidence you have collected so far. They are not predictions of career success or
        guarantees of fit.
      </p>
      <HowThisWorks onOpen={() => track('score_explanation_opened', { source: 'how_this_works' })} />

      {!data || !data.hasHypotheses ? (
        <div className="mt-8">
          <EmptyState
            title="Complete onboarding to begin building your Career Decision Matrix"
            body="Once you have paths to test, this page shows how real experiences change them."
            ctaLabel="Start onboarding"
            ctaTo="/onboarding"
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {data.measuredExperiments === 0 && (
            <EmptyState
              title="Your paths are based mostly on what you've told us so far"
              body="Test one of them to begin collecting real evidence. Confidence stays as an early signal until then."
              ctaLabel="Choose something to test"
              ctaTo="/choose"
            />
          )}

          {data.measuredExperiments === 1 && (
            <p className="app-card tp-body p-5" style={{ color: 'var(--text-secondary)' }}>
              Your first real evidence is in. Keep testing before drawing strong conclusions.
            </p>
          )}

          <Reveal y={16}>
            <StrongestHypothesis strongest={data.strongest} />
          </Reveal>

          {/* The whole matrix in one glance: path confidence against evidence
              coverage, using the readings the table below already shows. Tapping
              a marker reveals that path's existing conviction card. */}
          {(() => {
            const { points, unplaced } = plotPaths({ rows: data.active || [], conviction: data.conviction });
            if (!points.length && !unplaced.length) return null;
            const selected = points.find(p => p.pathId === plotted) || null;
            return (
              <Reveal y={16}>
                <QuadrantChart
                  points={points}
                  unplaced={unplaced}
                  selectedId={plotted}
                  onSelect={(p) => {
                    setPlotted(prev => (prev === p.pathId ? null : p.pathId));
                    track('matrix_quadrant_path_opened', { hypothesis: p.name, quadrant: p.quadrant.key });
                  }}
                />
                {selected && (
                  <div className="mt-4">
                    <PathConvictionCard
                      row={selected.row}
                      conviction={data.conviction?.[selected.pathId]}
                      onOpen={openScore}
                    />
                  </div>
                )}
              </Reveal>
            );
          })()}

          {/* The story first: how the thinking has moved, and what the work has
              shown about this student. The per-path table follows it. */}
          <Reveal y={16}>
            <ConfidenceHistoryChart rows={data.active} />
          </Reveal>

          <Reveal y={16}>
            <WorkstyleMatrix
              rows={withHumanReality(withScenarioSignals(data.workstyle, scenarioResponses), conversations)}
              onOpen={openDimension}
            />
          </Reveal>

          {/* Its own metric, deliberately outside the fit and confidence scores:
              a conversation changes what the student expects, never what their
              own work has shown. */}
          <Reveal y={16}>
            <HumanExposurePanel conversations={conversations} />
          </Reveal>

          <div>
            <div role="tablist" aria-label="Which paths to show" className="mb-4 flex gap-2">
              {[['active', 'Active paths'], ['history', 'Journey history']].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={view === key}
                  onClick={() => setView(key)}
                  className="touch-target tp-control rounded-full px-4 py-2"
                  style={view === key
                    ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)' }
                    : { background: 'var(--ink-100)', color: 'var(--text-secondary)' }}>
                  {label}
                </button>
              ))}
            </div>

            {view === 'history' ? (
              <JourneyHistory rows={rows} />
            ) : rows.length ? (
              <>
                <MatrixTable rows={rows} onOpen={openScore} />
                <MatrixCards rows={rows} onOpen={openScore} />
                {/* Conviction per path, in the matrix rather than on its own
                    dashboard: status, action readiness, the biggest remaining
                    gap and the next best test, each next to the scores it was
                    read from. */}
                <div className="mt-8">
                  <ConvictionInMatrix rows={rows} conviction={data.conviction} onOpen={openScore} />
                </div>
              </>
            ) : (
              <EmptyState
                title="No active paths right now"
                body="Pick a direction to test and it will appear here with the evidence behind it."
                ctaLabel="Choose something to test"
                ctaTo="/choose"
              />
            )}
          </div>

          <ChangedMind items={data.changed} />

          {/* What the hypothetical answers contributed per path, and performance
              beside experienced fit. Both stay separate from the scores above. */}
          <ScenarioEvidenceInMatrix />

          <div>
            <h2 className="tp-section mb-4" style={{ color: 'var(--text-primary)' }}>What should you test next?</h2>
            <div onClick={() => track('next_test_clicked')}>
              <NextBestExperimentPanel />
            </div>
          </div>

          <ClaritySummary clarity={data.clarity} />

          <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>
            This page is private to you. Nobody else sees your confidence scores, evidence, reflections or conversation notes
            unless you share them.
          </p>
        </div>
      )}

      <MetricPanel row={scored?.row} metric={scored?.metric} onClose={() => setScored(null)} />
      <WorkstyleDetail row={dimension} scenarioResponses={scenarioResponses} onClose={() => setDimension(null)} />
    </main>
  );
}