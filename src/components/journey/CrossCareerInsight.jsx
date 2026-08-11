import { Sparkles } from 'lucide-react';

/**
 * A cross-career pattern, shown only when the evidence carries it: a
 * characteristic measured more than once, rated positively, on more than one
 * career. Nothing is written here to fill the space.
 */
export default function CrossCareerInsight({ pattern }) {
  if (!pattern?.characteristics?.length) return null;

  return (
    <section className="rounded-[20px] border p-6" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-gold-700)' }}>
        <Sparkles size={12} aria-hidden="true" /> Something interesting is emerging
      </p>
      <h2 className="tp-section mt-2" style={{ color: 'var(--text-primary)' }}>You are showing a consistent pattern</h2>

      <p className="tp-body mt-3" style={{ color: 'var(--ink-700)' }}>You consistently show high enjoyment in:</p>
      <ul className="mt-2 space-y-1">
        {pattern.characteristics.map(c => (
          <li key={c.id} className="tp-body" style={{ color: 'var(--ink-700)' }}>· {c.label.toLowerCase()}</li>
        ))}
      </ul>

      <p className="tp-body mt-3" style={{ color: 'var(--ink-700)' }}>across:</p>
      <ul className="mt-2 space-y-1">
        {pattern.careers.map(name => (
          <li key={name} className="tp-body" style={{ color: 'var(--ink-700)' }}>· {name}</li>
        ))}
      </ul>

      <p className="tp-meta mt-3" style={{ color: 'var(--ink-400)' }}>
        This is a pattern in your own evidence, not a conclusion about what you should do.
      </p>
    </section>
  );
}