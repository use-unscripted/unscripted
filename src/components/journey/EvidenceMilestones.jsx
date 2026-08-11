import { Award } from 'lucide-react';

/**
 * Evidence milestones. Each one marks something learned, including learning
 * that a career does not fit — which is a real result, not a failure.
 */
export default function EvidenceMilestones({ milestones }) {
  if (!milestones?.length) return null;

  return (
    <section className="rounded-[20px] border bg-white p-6" style={{ borderColor: 'var(--ink-200)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-gold-700)' }}>
        <Award size={12} aria-hidden="true" /> What you have learned so far
      </p>
      <ul className="mt-3 space-y-3">
        {milestones.map(m => (
          <li key={m.id}>
            <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
            <p className="tp-meta mt-0.5" style={{ color: 'var(--ink-500)' }}>{m.hint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}