/**
 * The two question kinds inside an experiment, in two separate panels so their
 * results can never read as one number.
 *
 * The decision scenarios observe how the student approaches tradeoffs this kind
 * of work is full of. The performance question checks a calculation. Neither
 * panel claims the other's meaning, and neither decides whether the career fits.
 */
import ScenarioRunner from '@/components/scenarios/ScenarioRunner';
import { scenariosForCareer, performanceForCareer } from '@/lib/scenarios/scenario-library';

export default function ExperimentScenarios({ experiment, careerName, pathId }) {
  const name = careerName || experiment?.career_name || experiment?.path_name;
  const scenarios = scenariosForCareer(name, { limit: 2 });
  const performance = performanceForCareer(name);
  if (!scenarios.length && !performance) return null;

  const context = {
    response_context: 'experiment',
    experiment_id: experiment?.id || null,
    path_id: pathId || experiment?.path_id || null,
    path_name: name || null,
    seed_key: experiment?.id || 'experiment',
  };

  return (
    <>
      {scenarios.length > 0 && (
        <section className="app-card-flat p-5">
          <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Decision scenarios</h2>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
            Workstyle and decision evidence. No right answers.
          </p>
          <div className="mt-4">
            <ScenarioRunner
              scenarios={scenarios}
              context={context}
              whyThis="This scenario helps us observe how you approach tradeoffs common in this type of work."
              doneLabel="Save these signals"
            />
          </div>
        </section>
      )}

      {performance && (
        <section className="app-card-flat p-5">
          <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Performance question</h2>
          <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
            Task performance. Scored, and kept separate from everything above.
          </p>
          <div className="mt-4">
            <ScenarioRunner
              scenarios={[performance]}
              context={{ ...context, seed_key: 'performance' }}
              whyThis="This checks one calculation used in this kind of role. It does not say whether the career suits you."
              doneLabel="Submit answer"
            />
          </div>
        </section>
      )}
    </>
  );
}