/**
 * The scenario share of one dimension's evidence, inside a provenance panel.
 *
 * Always labelled as hypothetical, and always followed by the reminder that real
 * experiments carry more weight. If no scenario touched this dimension the block
 * says so rather than disappearing, so a student can tell the difference between
 * "no scenario evidence" and "we did not mention it".
 */
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import { scenarioProvenance } from '@/lib/scenarios/dimension-sources';
import { ONBOARDING_SCENARIOS, ROLE_SCENARIOS } from '@/lib/scenarios/scenario-library';
import { format } from 'date-fns';

const LIBRARY = [...ONBOARDING_SCENARIOS, ...ROLE_SCENARIOS];

export default function ScenarioSourceBlock({ dimension, responses = [] }) {
  const reading = scenarioEvidence(responses).find(s => s.dimension === dimension) || null;
  const provenance = scenarioProvenance({ dimension, responses, scenarios: LIBRARY });

  return (
    <section className="mt-6">
      <h3 className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>From decision scenarios</h3>
      {!reading ? (
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          No scenario answers touch this. Everything above came from what you told us or from work you did.
        </p>
      ) : (
        <>
          <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
            {reading.scenario_level_label} · {reading.statement}
          </p>
          <ul className="mt-2 space-y-1">
            {provenance.map((p, i) => (
              <li key={i} className="tp-meta" style={{ color: 'var(--ink-500)' }}>
                {p.title}
                {p.answered_at ? ` · ${format(new Date(p.answered_at), 'd MMM yyyy')}` : ''}
                {p.revised ? ' · answer changed' : ''}
              </li>
            ))}
          </ul>
          <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
            These come from hypothetical decisions. Real experiments carry more weight in your Career Decision Matrix.
          </p>
        </>
      )}
    </section>
  );
}