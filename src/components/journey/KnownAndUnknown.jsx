import { Check, HelpCircle } from 'lucide-react';
import { Reveal } from '@/components/motion';

/**
 * What we know, and what we don't know yet, about the hypothesis being tested.
 *
 * Everything on the left came from something the student did. Nothing that is
 * only a stated preference is promoted into a conclusion, so this side is empty
 * for a student who has not tested anything yet, and says so.
 */
export default function KnownAndUnknown({ focus }) {
  if (!focus) return null;
  const { known = [], unknowns = [] } = focus;
  if (!known.length && !unknowns.length) return null;

  return (
    <Reveal y={20}>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="app-card p-6">
          <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What we know</h2>
          {known.length ? (
            <ul className="mt-4 space-y-2.5">
              {known.map((k, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check size={15} className="mt-1 shrink-0" style={{ color: 'var(--success-700)' }} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="tp-body block" style={{ color: 'var(--ink-700)' }}>{k.text}</span>
                    {k.source && <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>{k.source}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tp-body mt-4" style={{ color: 'var(--ink-400)' }}>
Nothing yet. This fills in from what you do, not what you told us.
            </p>
          )}
        </section>

        <section className="app-card p-6">
          <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What we don&rsquo;t know yet</h2>
          <ul className="mt-4 space-y-2.5">
            {unknowns.map(u => (
              <li key={u.key} className="flex items-start gap-2.5">
                <HelpCircle size={15} className="mt-1 shrink-0" style={{ color: 'var(--ink-400)' }} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="tp-body block" style={{ color: 'var(--ink-700)' }}>{u.question}</span>
                  {u.label && <span className="tp-meta block" style={{ color: 'var(--ink-400)' }}>{u.label}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Reveal>
  );
}