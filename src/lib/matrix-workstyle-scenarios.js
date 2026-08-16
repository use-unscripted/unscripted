/**
 * Scenario answers laid ALONGSIDE the workstyle rows of the Career Decision
 * Matrix, never folded into them.
 *
 * The rows themselves keep coming from behaviour: `levelKey`, `levelLabel` and
 * `confidence` are untouched here, so a hypothetical answer can never raise a
 * dimension's behavioural reading. What this adds is a separate, clearly labelled
 * scenario badge, and the reason a dimension with only scenario answers appears
 * at all rather than sitting invisibly at "Still Unknown".
 */
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import { behaviourWins } from '@/lib/scenarios/evidence-hierarchy';

export function withScenarioSignals(rows = [], responses = []) {
  const byDimension = new Map(scenarioEvidence(responses).map(s => [s.dimension, s]));
  if (!byDimension.size) return rows;

  return rows.map(r => {
    const s = byDimension.get(r.dimension);
    if (!s) return r;
    return {
      ...r,
      scenario: s,
      scenarioLabel: s.scenario_level_label,
      scenarioStatement: s.statement,
      // Once real work has settled a dimension, the scenario reading is context
      // rather than news, and the row says so instead of competing with it.
      scenarioIsContext: behaviourWins(r.behaviouralLevel || (r.evidenceCount > 1 ? 'moderate' : 'unknown')),
      scenarioCount: s.response_count,
    };
  });
}

export default withScenarioSignals;