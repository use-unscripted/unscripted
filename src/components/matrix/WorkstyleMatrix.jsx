/**
 * What we are learning about how the student likes to work — across careers,
 * not inside one. These describe evidence gathered so far, never a personality
 * type, which is why every line is worded as "evidence currently suggests".
 */
const STYLE = {
  strong_positive: { color: 'var(--success-700)', bg: 'var(--success-50)', mark: '++' },
  positive: { color: 'var(--success-700)', bg: 'var(--success-50)', mark: '+' },
  mixed: { color: 'var(--warning-700)', bg: 'var(--warning-50)', mark: '~' },
  negative: { color: 'var(--brand-navy-700)', bg: 'var(--ink-100)', mark: '–' },
  strong_negative: { color: 'var(--brand-navy-700)', bg: 'var(--ink-100)', mark: '––' },
  unknown: { color: 'var(--ink-500)', bg: 'var(--ink-50)', mark: '?' },
};

export default function WorkstyleMatrix({ rows, onOpen }) {
  const shown = rows.filter(r => r.evidenceCount > 0 || r.selfReported || r.scenarioLabel || r.humanLabel).slice(0, 12);

  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>What we&apos;re learning about how you work</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        Read across every direction you have tested. These describe the evidence so far, not who you are.
      </p>

      {shown.length === 0 ? (
        <p className="tp-body mt-5" style={{ color: 'var(--text-secondary)' }}>
          Nothing here yet. Complete an experiment and rate the work afterwards to start building this.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {shown.map(r => {
            const s = STYLE[r.levelKey];
            return (
              <li key={r.dimension}>
                <button type="button" onClick={() => onOpen(r)}
                  className="touch-target ui-lift app-card-flat flex w-full items-center gap-4 p-3.5 text-left">
                  <span className="tp-control min-w-0 flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{r.label}</span>
                  <span className="tp-meta shrink-0 rounded-full px-2.5 py-1 font-semibold"
                    style={{ color: s.color, background: s.bg }}>
                    <span aria-hidden="true" className="mr-1.5 font-mono">{s.mark}</span>{r.levelLabel}
                  </span>
                  {/* Scenario answers, in their own badge and their own words, so
                      a hypothetical signal is never read as tested evidence. */}
                  {r.scenarioLabel && (
                    <span className="tp-meta hidden shrink-0 rounded-full px-2.5 py-1 font-semibold sm:inline"
                      style={{ color: 'var(--brand-navy-700)', background: 'var(--info-50)' }}>
                      {r.scenarioLabel}
                    </span>
                  )}
                  {/* Human Reality conversations, in their own words: context
                      about the field, never a reading of the student. */}
                  {r.humanLabel && (
                    <span className="tp-meta hidden shrink-0 rounded-full px-2.5 py-1 font-semibold sm:inline"
                      style={{ color: 'var(--brand-gold-700)', background: 'var(--warning-50)' }}>
                      {r.humanLabel}
                    </span>
                  )}
                  <span className="hidden w-[120px] shrink-0 items-center gap-2 sm:flex">
                    <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--ink-100)' }}>
                      <span className="progress-fill block h-full rounded-full" style={{ width: `${r.confidence}%`, background: s.color }} />
                    </span>
                    <span className="tp-meta tabular-nums" style={{ color: 'var(--text-secondary)' }}>{r.confidence}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}