/**
 * Scenario-Based Signals.
 *
 * Its own panel, deliberately separate from tested evidence, and it says out loud
 * that these came from hypothetical decisions and carry less weight in the
 * Career Decision Matrix than a real experiment.
 */
import { scenarioEvidence } from '@/lib/scenarios/scenario-signals';

const TONE = {
  initial_signal: { bg: 'var(--background-tertiary)', fg: 'var(--text-secondary)' },
  some: { bg: 'var(--info-50)', fg: 'var(--info-700)' },
  stronger: { bg: 'var(--info-50)', fg: 'var(--info-700)' },
  conflicting: { bg: 'var(--warning-50)', fg: 'var(--warning-700)' },
};

export default function ScenarioSignalsPanel({ responses = [], title = 'Scenario-Based Signals' }) {
  const rows = scenarioEvidence(responses);
  if (!rows.length) return null;
  const total = rows.reduce((n, r) => n + r.response_count, 0);

  return (
    <section className="app-card-flat p-5">
      <h2 className="tp-card" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        From {total} scenario signal{total === 1 ? '' : 's'}.
      </p>

      <div className="mt-4 space-y-3">
        {rows.map(r => {
          const tone = TONE[r.scenario_level] || TONE.initial_signal;
          return (
            <div key={r.dimension} className="rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{r.dimension_label}</p>
                <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: tone.bg, color: tone.fg }}>
                  {r.scenario_level_label}
                </span>
              </div>
              <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>{r.statement}</p>
            </div>
          );
        })}
      </div>

      <p className="tp-meta mt-4" style={{ color: 'var(--text-muted)' }}>
        These signals come from hypothetical decisions. Real experiments carry more weight in your Career Decision Matrix.
      </p>
    </section>
  );
}