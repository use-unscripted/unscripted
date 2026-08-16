/**
 * One path, test by test. The point of this list is that the path EVOLVES: each
 * entry says what was tested and what it changed, including when it lowered the
 * case for the career.
 */
const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

const OUTCOME = {
  strengthened: 'Strengthened the case',
  weakened: 'Weakened the case',
  mixed: 'Pointed both ways',
  resolved_and_revealed: 'Answered one thing, raised another',
  modified: 'Changed what you are claiming',
  insufficient_information: 'Not enough to draw from',
};

export default function PathTestTimeline({ timeline = [], pathName }) {
  if (!timeline.length) return null;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Tests you have completed</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        How your picture of {pathName || 'this path'} has moved, in order.
      </p>

      <ol className="mt-4">
        {timeline.map(t => (
          <li key={t.id} className="relative border-l pl-5 pb-5 last:pb-0" style={{ borderColor: 'var(--border-light)' }}>
            <span
              aria-hidden="true"
              className="absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full"
              style={{ background: 'var(--brand-gold-500)' }}
            />
            <p className="tp-meta font-semibold" style={{ color: 'var(--text-muted)' }}>
              Test {t.number}{t.date ? ` · ${fmt(t.date)}` : ''}
            </p>
            <p className="tp-card mt-1" style={{ color: 'var(--text-primary)' }}>{t.experimentTitle}</p>
            {t.tested && (
              <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>Tested: {t.tested}</p>
            )}
            {t.learned && (
              <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{t.learned}</p>
            )}
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {OUTCOME[t.outcome] || 'Recorded as evidence'}
              {t.confidenceBefore !== null && t.confidenceAfter !== null
                ? ` · confidence ${t.confidenceBefore} → ${t.confidenceAfter}`
                : ''}
            </p>
            {t.remaining.length > 0 && (
              <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
                Still open: {t.remaining.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}