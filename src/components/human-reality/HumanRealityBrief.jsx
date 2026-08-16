import { Users } from 'lucide-react';

/**
 * What we are trying to learn, and why a person rather than a task.
 * Never "talk to an investment banker": the unknown comes first, and the limit
 * of simulated work is stated plainly.
 */
export default function HumanRealityBrief({ brief, pathName }) {
  if (!brief) return null;
  return (
    <section className="app-card p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <Users size={16} style={{ color: 'var(--brand-gold-700)' }} aria-hidden="true" />
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-700)' }}>Human Reality</p>
      </div>
      <h2 className="tp-section mt-3" style={{ color: 'var(--ink-900)' }}>What we&apos;re trying to learn</h2>
      {pathName && <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>For {pathName}</p>}

      <p className="tp-body mt-4 rounded-[var(--r-control)] px-4 py-3" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>
        {brief.cannot_simulate}
      </p>

      <div className="mt-4">
        <h3 className="tp-label" style={{ color: 'var(--ink-500)' }}>The open question</h3>
        <p className="tp-body mt-2" style={{ color: 'var(--ink-700)' }}>{brief.learning}</p>
      </div>

      <p className="tp-meta mt-4" style={{ color: 'var(--ink-400)' }}>
        A conversation tells you what this work is actually like. It does not tell us how you perform, so it will not
        change what your own experiments have shown.
      </p>
    </section>
  );
}