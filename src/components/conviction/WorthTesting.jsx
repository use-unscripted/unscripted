/**
 * "Something worth testing" — where two pieces of a student's own evidence
 * disagree. Neutral on purpose: each item names the two readings and the open
 * question, and nothing here claims either reading is the true one.
 */
import { HelpCircle } from 'lucide-react';

export default function WorthTesting({ tensions = [] }) {
  if (!tensions.length) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <HelpCircle size={17} style={{ color: 'var(--brand-navy-700)' }} /> Something worth testing
      </h2>
      <p className="tp-prose mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        Two things you have recorded point in different directions. Neither one is wrong, and neither
        settles anything on its own. They are just the parts of your picture that would change most
        with one more reading.
      </p>

      <ul className="mt-4 space-y-3">
        {tensions.map(t => (
          <li
            key={t.id}
            className="rounded-[var(--r-control)] p-4"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
          >
            <p className="tp-meta font-semibold uppercase" style={{ color: 'var(--ink-400)', letterSpacing: '0.06em' }}>
              {t.source}
            </p>
            <p className="tp-body mt-1.5 font-bold" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>{t.detail}</p>
            <p className="tp-meta mt-1.5" style={{ color: 'var(--ink-400)' }}>{t.open_question}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}