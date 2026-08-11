import { Link } from 'react-router-dom';
import { ArrowRight, Clock, FlaskConical } from 'lucide-react';

/**
 * Your next test, inside a career.
 *
 * States the open question, what it would tell us, and how long it takes. It
 * never claims how much a score would move, because that is not knowable before
 * the work is done.
 */
export default function NextTestCard({ next, careerName }) {
  if (!next) return null;

  return (
    <section className="rounded-[var(--r-surface)] border p-5" style={{ borderColor: 'var(--brand-gold-500)', background: 'var(--warning-50)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-gold-700)' }}>
        <FlaskConical size={12} aria-hidden="true" /> Your next test
      </p>

      <h3 className="tp-card mt-2" style={{ color: 'var(--surface-dark-900)' }}>{next.question}</h3>
      {careerName && <p className="tp-meta mt-1" style={{ color: 'var(--ink-500)' }}>For {careerName}</p>}

      <p className="tp-meta mt-3 flex items-center gap-1.5" style={{ color: 'var(--ink-500)' }}>
        <Clock size={12} aria-hidden="true" /> Estimated time: <strong style={{ color: 'var(--surface-dark-900)' }}>{next.minutes} min</strong>
      </p>

      <p className="tp-label mt-3" style={{ color: 'var(--ink-500)' }}>Why we are testing this</p>
      <p className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>{next.why}</p>

      <Link
        to={next.to}
        className="ui-press tp-body mt-4 inline-flex items-center gap-2 rounded-[var(--r-control)] px-5 py-3 font-semibold text-white"
        style={{ background: 'var(--brand-navy-900)' }}
      >
        Test it <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}