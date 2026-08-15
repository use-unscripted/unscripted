/**
 * Everything the scenarios have produced, in one place inside Evidence: the early
 * signals, the per-dimension scenario readings, any contradiction worth a real
 * experiment, and scored task performance kept apart from all of it.
 *
 * Never its own item in the main navigation: this is not a test the student
 * takes, it is evidence about them.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import EarlySignals from '@/components/scenarios/EarlySignals';
import ScenarioSignalsPanel from '@/components/scenarios/ScenarioSignalsPanel';
import ScenarioContradictions from '@/components/scenarios/ScenarioContradictions';
import { loadResponses } from '@/lib/scenarios/scenario-answers';
import { scenarioContradictions } from '@/lib/scenarios/scenario-contradictions';
import { taskPerformance } from '@/lib/scenarios/scenario-performance';
import { loadDimensionEvidence } from '@/lib/career-dimensions-store';
import { Sk } from '@/components/PageSkeleton';

export default function ScenarioEvidenceSection() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadResponses(),
      loadDimensionEvidence().catch(() => ({})),
      base44.entities.StudentProfile.list('-created_date', 1).catch(() => []),
      base44.entities.Experiments.filter({ status: 'completed' }, '-created_date', 50).catch(() => []),
    ]).then(([responses, dimensionMap, profiles, completed]) => {
      if (!alive) return;
      setState({
        responses,
        dimensions: Object.values(dimensionMap || {}),
        profile: (Array.isArray(profiles) ? profiles : [])[0] || {},
        testedCount: (Array.isArray(completed) ? completed : []).length,
      });
    });
    return () => { alive = false; };
  }, []);

  if (!state) return <Sk h={220} r={16} />;

  const { responses, dimensions, profile, testedCount } = state;
  if (!responses.length) {
    return (
      <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
        No decision scenarios answered yet. They appear as short prompts while you are choosing a path, and inside your experiments.
      </p>
    );
  }

  const performance = taskPerformance(responses);
  const contradictions = scenarioContradictions({ profile, responses, dimensions });

  return (
    <div className="app-stack">
      <EarlySignals responses={responses} testedCount={testedCount} />
      <ScenarioSignalsPanel responses={responses} />
      <ScenarioContradictions contradictions={contradictions} />

      {performance.answered > 0 && (
        <section className="app-card-flat p-5">
          <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Task performance</h2>
          <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            {performance.answered} scored question{performance.answered === 1 ? '' : 's'}
            {performance.accuracy !== null ? ` · ${performance.accuracy}% correct` : ''}
          </p>
          <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>{performance.note}</p>
        </section>
      )}
    </div>
  );
}