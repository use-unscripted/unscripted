import { Check } from 'lucide-react';
import { Reveal } from '@/components/motion';

/**
 * One step of the reflection and decision flow, separated and labelled.
 *
 * The flow used to be a run of panels with no sense of order or of how much was
 * left. Each step now says which number it is, what it is for, and whether it is
 * finished, and arrives on its own rather than with everything else at once.
 */
export default function ReflectionStep({ index, total, title, purpose, done, delay = 0, children }) {
  return (
    <Reveal y={18} delay={delay}>
      <section className="rounded-[var(--r-surface)] p-5 sm:p-6"
        style={{ background: 'var(--background-primary)', border: '1px solid var(--border-light)', boxShadow: 'var(--elev-rest)' }}>
        <div className="flex items-start gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold"
            style={done
              ? { background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }
              : { background: 'var(--brand-navy-900)', color: '#FFFFFF' }}>
            {done ? <Check size={13} strokeWidth={3.5} aria-hidden="true" /> : index}
          </span>
          <div className="min-w-0 flex-1">
            <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Step {index} of {total}</p>
            <h2 className="tp-card mt-1" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            {purpose && <p className="tp-prose mt-1.5" style={{ color: 'var(--text-secondary)', maxWidth: '58ch' }}>{purpose}</p>}
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </Reveal>
  );
}