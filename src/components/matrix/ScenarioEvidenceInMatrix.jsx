/**
 * Scenario evidence inside the Career Decision Matrix.
 *
 * Per path: what the hypothetical answers contributed, and the standing reminder
 * when they are doing more work than real experiments are. Plus performance beside
 * experienced fit, because doing something well is not the same finding as wanting
 * to do it.
 *
 * Nothing is recomputed here. The hypothesis layer and the dimension store are
 * read, and the contribution rules live in scenario-path-effect.
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { loadRecalculationContext } from '@/lib/hypothesis-recalculation';
import { deriveHypothesis } from '@/lib/career-hypothesis';
import { loadDimensionEvidence } from '@/lib/career-dimensions-store';
import { scenarioPathEffect } from '@/lib/scenarios/scenario-path-effect';
import { performanceVsFit } from '@/lib/scenarios/dimension-sources';
import { taskPerformance } from '@/lib/scenarios/scenario-performance';
import ScenarioPathEffect from '@/components/matrix/ScenarioPathEffect';
import PerformanceVsFit from '@/components/matrix/PerformanceVsFit';

export default function ScenarioEvidenceInMatrix() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [responses, ctx, dimensionMap] = await Promise.all([
        base44.entities.ScenarioResponse.list('-completed_at', 200).catch(() => []),
        loadRecalculationContext().catch(() => ({ paths: [] })),
        loadDimensionEvidence().catch(() => ({})),
      ]);
      if (!alive) return;
      const rows = Array.isArray(responses) ? responses : [];
      if (!rows.length) { setState({ effects: [], fit: null }); return; }

      const dimensions = Object.values(dimensionMap || {});
      const live = (ctx.paths || []).filter(p => p.status !== 'archived' && p.hypothesis_status !== 'archived');

      const effects = live.map(path => {
        const h = deriveHypothesis(path, ctx);
        const variables = (h?.uncertainty?.variables || []).map(v => v.variable);
        return scenarioPathEffect({ path, variables, responses: rows, dimensions });
      }).filter(Boolean);

      const performance = taskPerformance(rows);
      const leading = live.slice().sort((a, b) => (b.career_fit_score || 0) - (a.career_fit_score || 0))[0];
      const fit = performanceVsFit({
        performanceScore: performance.accuracy,
        experiencedFit: leading?.enjoyment_fit ?? leading?.career_fit_score ?? null,
      });

      setState({ effects, fit });
    })();
    return () => { alive = false; };
  }, []);

  if (!state || (!state.effects.length && !state.fit)) return null;

  return (
    <div className="space-y-4">
      {state.fit && <PerformanceVsFit reading={state.fit} />}
      {state.effects.map(e => <ScenarioPathEffect key={e.path_id || e.path_name} effect={e} />)}
    </div>
  );
}