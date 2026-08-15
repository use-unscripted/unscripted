/**
 * Quick Decision Scenario, offered while choosing.
 *
 * Shown only when a dimension is genuinely untested and a scenario exists for it.
 * It may sharpen which experiment is recommended next. It cannot rule a path out,
 * and nothing here changes a path's status.
 */
import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import ScenarioRunner from '@/components/scenarios/ScenarioRunner';
import { scenariosForDimension } from '@/lib/scenarios/scenario-library';
import { loadResponses, byScenarioKey } from '@/lib/scenarios/scenario-answers';
import { loadDimensionEvidence } from '@/lib/career-dimensions-store';
import { CAREER_DIMENSIONS, NEXT_TEST_PRIORITY } from '@/lib/career-dimensions';

export default function QuickScenarioPrompt({ path }) {
  const [pick, setPick] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadDimensionEvidence().catch(() => ({})), loadResponses()]).then(([stored, responses]) => {
      if (!alive) return;
      const answered = byScenarioKey(responses);

      // Untested first, by how much testing it would tell us.
      const candidates = CAREER_DIMENSIONS
        .map(d => {
          const level = stored[d.id]?.current_evidence_level || 'unknown';
          return { dimension: d, level, priority: NEXT_TEST_PRIORITY[level] ?? 0 };
        })
        .filter(c => ['unknown', 'weak'].includes(c.level))
        .sort((a, b) => b.priority - a.priority);

      for (const c of candidates) {
        const [scenario] = scenariosForDimension(c.dimension.id, { careerName: path?.path_name, limit: 1 });
        if (scenario && !answered[scenario.scenario_key]) {
          setPick({ scenario, dimension: c.dimension });
          return;
        }
      }
    });
    return () => { alive = false; };
  }, [path?.path_name]);

  if (!pick) return null;

  return (
    <section className="app-card-flat p-5">
      <p className="tp-eyebrow inline-flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <Timer size={12} /> Quick decision scenario · 2 minutes
      </p>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        We still do not know how you naturally approach {pick.dimension.noun}. Try this before choosing your next experiment.
      </p>

      {open ? (
        <div className="mt-4">
          <ScenarioRunner
            scenarios={[pick.scenario]}
            context={{ response_context: 'path_review', path_id: path?.id, path_name: path?.path_name, seed_key: 'choose' }}
            whyThis="It may sharpen which experiment we suggest next. It cannot rule a path out on its own."
            doneLabel="Save this signal"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="app-cta-secondary tp-body mt-4 font-bold"
          style={{ minHeight: '48px' }}
        >
          Try the scenario
        </button>
      )}
    </section>
  );
}