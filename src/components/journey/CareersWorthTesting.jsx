import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DimensionProgress from '@/components/paths/DimensionProgress';
import NextTestCard from '@/components/paths/NextTestCard';

/**
 * Careers worth testing — the student's current career hypotheses.
 *
 * Two numbers, never combined: how promising the career currently looks, and
 * how much evidence stands behind that estimate. The wording is deliberately
 * provisional; nothing here tells anyone what to become.
 */
export default function CareersWorthTesting({ hypotheses }) {
  if (!hypotheses?.length) return null;
  // The next test is shown once, on the career it belongs to, rather than three
  // competing calls to action.
  const lead = hypotheses.find(h => h.nextTest);

  return (
    <section className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Careers worth testing</h2>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
        These are hypotheses, not recommendations. Each one moves as you test it.
      </p>

      <ul className="mt-5 space-y-3">
        {hypotheses.slice(0, 3).map(h => (
          <li key={h.id} className="rounded-[14px] border border-[color:var(--ink-200)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="tp-card" style={{ color: 'var(--text-primary)' }}>{h.name}</h3>
              <span
                className="tp-meta rounded-full px-2.5 py-0.5 font-bold"
                style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}
              >
                {h.statusLabel}
              </span>
            </div>
            <div className="tp-meta mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
              <span>Current fit <strong style={{ color: 'var(--text-primary)' }}>{h.fit}%</strong></span>
              <span>Confidence <strong style={{ color: 'var(--text-primary)' }}>{h.confidence}%</strong></span>
              {h.progress && (
                <span>Evidence <strong style={{ color: 'var(--text-primary)' }}>{h.progress.evidenceStatus.label}</strong></span>
              )}
            </div>
            {h.progress && (
              <div className="mt-3">
                <DimensionProgress progress={h.progress} compact />
              </div>
            )}
          </li>
        ))}
      </ul>

      {lead && (
        <div className="mt-5">
          <NextTestCard next={lead.nextTest} careerName={lead.name} />
        </div>
      )}

      <Link
        to="/paths"
        className="tp-meta mt-5 inline-flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        Continue testing <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}