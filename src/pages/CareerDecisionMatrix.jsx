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
import ScoreExplainer from '@/components/matrix/ScoreExplainer';
import ConfidenceHistoryChart from '@/components/matrix/ConfidenceHistoryChart';
import WorkstyleMatrix from '@/components/matrix/WorkstyleMatrix';
import WorkstyleDetail from '@/components/matrix/WorkstyleDetail';
import ChangedMind from '@/components/matrix/ChangedMind';
import ClaritySummary from '@/components/matrix/ClaritySummary';
import JourneyHistory from '@/components/matrix/JourneyHistory';
import NextBestExperimentPanel from '@/components/next-test/NextBestExperimentPanel';
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
  const [scored, setScored] = useState(null);
  const [dimension, setDimension] = useState(null);
  const [view, setView] = useState('active');

  useEffect(() => { track('career_matrix_viewed'); }, []);

  if (loading) {
    return (
      <PageSkeleton title description action={false}>
        <Sk h={140} r={16} />
        <div className="mt-6"><SkCards count={3} h={160} /></div>
      </PageSkeleton>
    );
  }

  const openScore = (row, metric) => {
    setScored(row);
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

          <Reveal y={16}>
            <ConfidenceHistoryChart rows={data.active} />
          </Reveal>

          <Reveal y={16}>
            <WorkstyleMatrix rows={data.workstyle} onOpen={openDimension} />
          </Reveal>

          <ChangedMind items={data.changed} />

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

      <ScoreExplainer row={scored} onClose={() => setScored(null)} />
      <WorkstyleDetail row={dimension} onClose={() => setDimension(null)} />
    </main>
  );
}