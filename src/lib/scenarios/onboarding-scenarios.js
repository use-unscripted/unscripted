/**
 * The intake's scenario answers, written once the student has an account.
 *
 * A guest has no rows to own, so the answers travel in the draft and become
 * ScenarioResponse rows here, at claim time, under the student's own id.
 * Idempotent: scenarios that already have a row are skipped, so a retried claim
 * cannot double a signal.
 */
import { base44 } from '@/api/base44Client';
import { scenarioByKey } from '@/lib/scenarios/scenario-library';
import { buildResponse } from '@/lib/scenarios/scenario-signals';

export async function claimOnboardingScenarios(draft) {
  const answers = Array.isArray(draft?.scenario_answers) ? draft.scenario_answers : [];
  if (!answers.length) return 0;

  const existing = await base44.entities.ScenarioResponse.list('-completed_at', 100).catch(() => []);
  const done = new Set((Array.isArray(existing) ? existing : []).map(r => r.scenario_key));

  const rows = answers
    .filter(a => a.scenario_key && !done.has(a.scenario_key))
    .map(a => {
      const scenario = scenarioByKey(a.scenario_key);
      const option = scenario && (scenario.options || []).find(o => o.id === a.option_id);
      if (!scenario || !option) return null;
      return buildResponse({ scenario, option, context: { response_context: 'onboarding' } });
    })
    .filter(Boolean)
    .map(row => {
      Object.keys(row).forEach(k => { if (row[k] === undefined) delete row[k]; });
      return row;
    });

  if (!rows.length) return 0;
  await base44.entities.ScenarioResponse.bulkCreate(rows);
  return rows.length;
}

export default claimOnboardingScenarios;