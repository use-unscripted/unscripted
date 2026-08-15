/**
 * Early Signals: what the intake produced, with no label attached.
 *
 * Two columns of meaning, never mixed: what the student told us, and what they
 * have actually tested. Early on the second column is empty, and saying so
 * plainly is the point of the panel.
 */
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';
import { DIMENSION_BY_ID } from '@/lib/career-dimensions';

export default function EarlySignals({ responses = [], answeredScenarios = [], testedCount = 0 }) {
  /* The guest intake has no stored rows yet, so signals can also be handed in
     directly as answered scenarios: [{ scenario, option_id }]. */
  const fromDraft = answeredScenarios
    .map(({ scenario, option_id }) => (scenario.options || []).find(o => o.id === option_id))
    .filter(Boolean)
    .flatMap(o => o.dimension_signal_mapping || []);

  const rows = responses.length
    ? scenarioEvidence(responses)
    : [...new Set(fromDraft.map(m => m.dimension))]
      .filter(id => DIMENSION_BY_ID.has(id))
      .map(dimension => ({
        dimension,
        dimension_label: DIMENSION_BY_ID.get(dimension).label,
        direction: fromDraft.find(m => m.dimension === dimension)?.signal_direction,
      }));

  if (!rows.length) return null;

  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>Early Signals</h2>
      <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        Your responses provide some early clues, but we still need real experiences before drawing strong conclusions.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--background-tertiary)' }}>
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-900)' }}>What you told us</p>
          <ul className="mt-2 space-y-1.5">
            {rows.slice(0, 6).map(r => (
              <li key={r.dimension} className="tp-meta" style={{ color: 'var(--text-secondary)' }}>
                {r.direction === 'draws_away'
                  ? `Initial signal away from ${r.dimension_label.toLowerCase()}`
                  : r.direction === 'unclear'
                    ? `${r.dimension_label} still uncertain`
                    : `Initial signal toward ${r.dimension_label.toLowerCase()}`}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-900)' }}>What you have actually tested</p>
          <p className="tp-meta mt-2" style={{ color: 'var(--text-secondary)' }}>
            {testedCount > 0
              ? `${testedCount} experience${testedCount === 1 ? '' : 's'} so far. Those are what move your Career Decision Matrix.`
              : 'Nothing yet. Your first experiment is what turns any of this into real evidence.'}
          </p>
        </div>
      </div>
    </section>
  );
}