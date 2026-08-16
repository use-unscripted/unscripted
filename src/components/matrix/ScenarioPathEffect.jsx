/**
 * "How scenario evidence affected this path."
 *
 * States the contribution in words and keeps the limits visible: the warning about
 * thin real-world evidence stays on screen for as long as hypothetical answers
 * outnumber real readings on this path's dimensions.
 */
import { Compass } from 'lucide-react';

export default function ScenarioPathEffect({ effect }) {
  if (!effect || !effect.contributions.length) return null;

  return (
    <section className="app-card-flat p-5">
      <h3 className="tp-card inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Compass size={15} style={{ color: 'var(--brand-navy-700)' }} /> How scenario evidence affected this path
      </h3>
      <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        Scenario evidence {effect.effect_label}
        {effect.path_name ? ` for ${effect.path_name}` : ''} because:
      </p>

      <ul className="mt-3 space-y-1.5">
        {effect.contributions.map(c => (
          <li key={c.dimension} className="tp-body flex items-start gap-2" style={{ color: 'var(--ink-700)' }}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--brand-navy-700)' }} />
            <span>
              {c.note}
              {c.overridden_by_behaviour && (
                <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>
                  Your real experiments already answer this, so this scenario reading changed nothing.
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {effect.behavioural_note && (
        <p className="tp-body mt-3 rounded-[var(--r-control)] p-3" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
          {effect.behavioural_note}
        </p>
      )}
      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>{effect.caveat}</p>
    </section>
  );
}