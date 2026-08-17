/**
 * The early read, shown once between question 5 and question 6 of the intake.
 *
 * Without it, the first thing the product gives a student back arrives on the
 * far side of the whole intake, the review screen and half a minute of a
 * loading spinner. This lands five questions in, costs nothing and runs no
 * model: everything on it is derived in src/lib/onboarding-early-read.js from
 * answers already sitting in the guest draft.
 *
 * It is an interstitial, not a question. The page keeps its step index while
 * this is up, so the counter does not move and the total does not grow.
 *
 * Body only, and it takes the derived read rather than deriving it. The page
 * owns the footer the same way it does for the review screen, because the page
 * owns navigation, and it holds the read so the funnel event counts the same
 * object the student is looking at.
 */
const blockCls = 'rounded-[var(--r-surface)] border p-4 sm:p-5';
const blockStyle = { borderColor: 'var(--border-light)', background: 'var(--background-secondary)' };

function Block({ title, children, delay }) {
  return (
    <section className={`early-block ${blockCls}`} style={{ ...blockStyle, animationDelay: `${delay}ms` }}>
      <h2 className="tp-eyebrow" style={{ color: 'var(--text-secondary)' }}>{title}</h2>
      {children}
    </section>
  );
}

export default function OnboardingEarlyRead({ read, headingRef }) {
  return (
    <div>
      {/* One keyframe, one guard. Everything else on this screen is static, and
          the pane it sits in already fades rather than travels when the student
          has asked their system to reduce motion. */}
      <style>{`
        @keyframes earlyBlockIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .early-block { animation: earlyBlockIn var(--dur-base) var(--ease-out) both; }
        @media (prefers-reduced-motion: reduce) { .early-block { animation: none; } }
      `}</style>

      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
        From your first five answers
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="tp-page mt-2.5 outline-none" style={{ color: 'var(--text-primary)' }}>
        {read.sparse ? 'There is not much here yet.' : 'Here is what we can see so far.'}
      </h1>
      <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)' }}>
        {read.sparse
          ? 'You skipped most of the first five, which is allowed. We are not going to invent a read out of one number, so here is the little we have.'
          : 'You are five questions in, so this is a read on partial answers, not a result. Nothing here is a recommendation and nothing is decided.'}
      </p>

      <div className="mt-6 space-y-3">
        {read.reflection.length > 0 && (
          <Block title="What you told us" delay={40}>
            <ul className="mt-2.5 space-y-2">
              {read.reflection.map(line => (
                <li key={line} className="tp-body flex gap-2.5" style={{ color: 'var(--text-primary)' }}>
                  <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full"
                    style={{ background: 'var(--ink-300)' }} />
                  <span className="break-words">{line}</span>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {read.directions.length > 0 && (
          <Block title="Worth testing" delay={110}>
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              These came off your own answers. There is no order to them and no score behind them.
            </p>
            <ul className="mt-3 space-y-2">
              {read.directions.map(d => (
                <li key={d.name} className="rounded-[var(--r-control)] border px-3.5 py-2.5"
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--brand-white)' }}>
                  <p className="tp-body break-words font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {d.name}
                  </p>
                  <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.label}</p>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {/* A heading promising directions over a line saying there are none
            reads as a broken render, so the empty case gets its own. */}
        {read.directionsNote && (
          <Block title="Nothing to point at yet" delay={110}>
            <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>{read.directionsNote}</p>
          </Block>
        )}

        {read.unknown && (
          <Block title="What we cannot tell yet" delay={180}>
            <p className="tp-body mt-2 break-words" style={{ color: 'var(--text-primary)' }}>{read.unknown}</p>
          </Block>
        )}
      </div>
    </div>
  );
}
