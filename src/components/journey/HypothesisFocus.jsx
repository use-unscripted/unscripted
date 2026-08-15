import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Reveal, WordReveal, EASE } from '@/components/motion';

/**
 * The top of My Journey: the one hypothesis being tested, how it currently
 * stands, the test running against it, and a single dominant action.
 *
 * Mobile order is deliberate and is the reason for the order-* classes. A phone
 * viewport has to carry the hypothesis, what is being tested and the button, so
 * the longer "why this is still worth testing" paragraph moves below the button
 * there and returns to its reading position at 640px and up.
 */
function Field({ label, value }) {
  return (
    <div>
      <dt className="tp-eyebrow" style={{ color: 'var(--ink-300)' }}>{label}</dt>
      <dd className="tp-card mt-1 font-bold text-white">{value}</dd>
    </div>
  );
}

export default function HypothesisFocus({ focus, experiment, action, effort, onAnchorClick }) {
  const testQuestion = experiment?.test_question || experiment?.unresolved_question || focus?.unknowns?.[0]?.question;
  const progress = focus?.progress;

  /* One destination, always the Test stage. The label used to change with the
     resolved stage ("Submit Evidence"), which told the student to do a thing
     without saying where in the cycle they were, and sent them into an
     experiment screen rather than the stage they were reading about. */
  const btn = (
    <>
      Go to My Test
      <motion.span className="inline-flex" initial={false} whileHover={{ x: 3 }} transition={{ duration: 0.3, ease: EASE }}>
        <ArrowRight size={17} className="shrink-0" aria-hidden="true" />
      </motion.span>
    </>
  );
  const btnClass =
    'ui-press journey-now-cta tp-control inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] px-7 py-3.5 sm:w-auto';

  return (
    <section
      className="relative overflow-hidden rounded-[var(--r-surface)] px-6 py-5 sm:px-12 sm:py-12"
      style={{
        background: 'linear-gradient(148deg, var(--brand-navy-900) 0%, var(--brand-navy-700) 100%)',
        boxShadow: 'var(--elev-card)',
      }}
      aria-labelledby="journey-hypothesis-name"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: 'var(--brand-gold-500)' }} />

      <div className="flex max-w-3xl flex-col">
        <p className="tp-eyebrow order-1" style={{ color: 'var(--brand-gold-500)' }}>Path you are testing</p>

        <h2
          id="journey-hypothesis-name"
          className="journey-hypothesis-name tp-hero order-2 mt-2 text-white"
          style={{ overflowWrap: 'anywhere' }}
        >
          <WordReveal key={focus?.name || action.label} text={focus?.name || action.label} delay={0.05} />
        </h2>

        {focus && (
          <dl className="order-3 mt-4 flex flex-wrap gap-x-8 gap-y-3 sm:mt-5">
            <Field label="Path status" value={focus.statusLabel} />
            <Field label="Confidence" value={focus.confidenceBand} />
          </dl>
        )}

        {focus?.why && (
          <div className="order-6 mt-6 sm:order-4">
            <p className="tp-eyebrow" style={{ color: 'var(--ink-300)' }}>Why this is still worth testing</p>
            <p className="tp-body mt-1.5" style={{ color: 'var(--ink-300)' }}>{focus.why}</p>
          </div>
        )}

        {(testQuestion || experiment) && (
          <div
            className="order-4 mt-3 rounded-[var(--r-control)] p-4 sm:order-5 sm:mt-6"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-500)' }}>What you are testing right now</p>
            {testQuestion && <p className="tp-body mt-1.5 font-bold text-white">{testQuestion}</p>}
            {experiment?.title && <p className="tp-body mt-1" style={{ color: 'var(--ink-300)' }}>{experiment.title}</p>}
            {/* Effort and progress read as one line: three stacked metadata
                lines was most of what pushed the button off a phone screen. */}
            {(effort || progress) && (
              <p className="tp-meta mt-2" style={{ color: 'var(--ink-300)' }}>
                {[
                  effort,
                  progress && `Evidence ${progress.evidenceStatus.label}`,
                  progress && `${progress.testedCount} of ${progress.total} dimensions tested`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}

        <Reveal delay={320} y={14} className="order-5 sm:order-6">
          <div className="mt-4 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-5">
            <Link to="/test" className={btnClass}>{btn}</Link>
            <p className="tp-meta" style={{ color: 'var(--ink-300)' }}>{action.sub}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}