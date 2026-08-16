/**
 * Scenario evidence inside the Career Decision Matrix.
 *
 * Per path: what the hypothetical answers contributed, and the standing reminder
 * when they are doing more work than real experiments are. Plus performance beside
 * experienced fit, because doing something well is not the same finding as wanting
 * to do it.
 *
 * Nothing is recomputed here, and nothing is fetched here: the records arrive as
 * props from the page's single read pass. This component used to load the whole
 * recalculation context, the scenario responses and the dimension rows again for
 * itself, after mounting — which was both a duplicate of what the page already
 * had and a second sequential wave before anything on it could render.
 */
import { useMemo } from 'react';
import { deriveHypothesis } from '@/lib/career-hypothesis';
import { scenarioPathEffect } from '@/lib/scenarios/scenario-path-effect';
import { performanceVsFit } from '@/lib/scenarios/dimension-sources';
import { taskPerformance } from '@/lib/scenarios/scenario-performance';
import ScenarioPathEffect from '@/components/matrix/ScenarioPathEffect';
import PerformanceVsFit from '@/components/matrix/PerformanceVsFit';

export default function ScenarioEvidenceInMatrix({ context = null, responses = [], dimensionMap = {} }) {
  const state = useMemo(() => {
    if (!context) return null;
    const rows = Array.isArray(responses) ? responses : [];
    if (!rows.length) return { effects: [], fit: null };

    const dimensions = Object.values(dimensionMap || {});
    const live = (context.paths || []).filter(p => p.status !== 'archived' && p.hypothesis_status !== 'archived');

    const effects = live.map(path => {
      const h = deriveHypothesis(path, context);
      const variables = (h?.uncertainty?.variables || []).map(v => v.variable);
      return scenarioPathEffect({ path, variables, responses: rows, dimensions });
    }).filter(Boolean);

    const performance = taskPerformance(rows);
    const leading = live.slice().sort((a, b) => (b.career_fit_score || 0) - (a.career_fit_score || 0))[0];
    const fit = performanceVsFit({
      performanceScore: performance.accuracy,
      experiencedFit: leading?.enjoyment_fit ?? leading?.career_fit_score ?? null,
    });

    return { effects, fit };
  }, [context, responses, dimensionMap]);

  if (!state || (!state.effects.length && !state.fit)) return null;

  return (
    <div className="space-y-4">
      {state.fit && <PerformanceVsFit reading={state.fit} />}
      {state.effects.map(e => <ScenarioPathEffect key={e.path_id || e.path_name} effect={e} />)}
    </div>
  );
}