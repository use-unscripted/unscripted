import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { STAGES, STAGE_INDEX } from '@/lib/journey';
import { Reveal, WordReveal, EASE } from '@/components/motion';

/**
 * The one instruction on My Journey.
 *
 * Everything a student needs to act on is here: which stage they're in, the
 * concrete thing in front of them, and a single button. The stage readout, the
 * path name and the next action used to be spread across two cards that each
 * restated the other — this panel says each of them exactly once.
 */
export default function JourneyNow({ stage, path, experiment, action, effort, onAnchorClick }) {
  const current = STAGES[STAGE_INDEX[stage] ?? 0];

  // The concrete subject: the mission if there is one, otherwise the direction
  // being tested. At the Test stage `action.sub` *is* the mission title, so it
  // would only repeat the heading — the stage's own question stands in, which
  // is the one line that frames why this mission is in front of them.
  const subject = experiment?.title || path?.path_name || action.label;
  const detail = action.sub === subject ? current.question : action.sub;

  /* The arrow leans on hover, which is what the landing page's primary button
     does and the only movement either button makes. */
  const btn = (
    <>
      {action.label}
      <motion.span
        className="inline-flex"
        initial={false}
        whileHover={{ x: 3 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <ArrowRight size={17} className="shrink-0" aria-hidden="true" />
      </motion.span>
    </>
  );
  /* tp-control, not tp-card: a button carries a label, and the marketing page
     sets every one of its labels at 14/600 in the body face. This was a 17px
     bold heading inside a button. */
  const btnClass =
    'ui-press journey-now-cta tp-control inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] px-7 py-3.5 sm:w-auto';

  return (
    <section
      className="relative overflow-hidden rounded-[var(--r-surface)] px-6 py-10 sm:px-12 sm:py-14"
      style={{
        background: 'linear-gradient(148deg, var(--brand-navy-900) 0%, var(--brand-navy-700) 100%)',
        boxShadow: 'var(--elev-card)',
      }}
      aria-labelledby="journey-now-subject"
    >
      {/* Signature: the gold rail that runs the length of the panel and picks up
          again as the spine below it. Decorative — the stage is stated in text. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: 'var(--brand-gold-500)' }}
      />

      {/* Left-biased and capped for measure, the way the landing fold is —
          not a headline centred over a centred button. */}
      <div className="max-w-3xl">
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-500)' }}>
          Now · {current.label}
        </p>

        {/* The dashboard's headline, and it reveals word by word out of a clip
            mask exactly as the landing headline does. Same primitive, same
            timing, and it degrades to plain text under reduced motion.
            `key` on the subject so a student who finishes a mission sees the
            next one arrive rather than swap silently. */}
        <h2
          id="journey-now-subject"
          className="tp-hero mt-5 text-white"
          style={{ overflowWrap: 'anywhere' }}
        >
          <WordReveal key={subject} text={subject} delay={0.05} />
        </h2>

        {detail && (
          <Reveal delay={420} y={14}>
            <p className="tp-lead mt-5" style={{ color: 'var(--ink-300)' }}>
              {detail}
            </p>
          </Reveal>
        )}

        <Reveal delay={540} y={14}>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            {action.to ? (
              <Link to={action.to} className={btnClass}>{btn}</Link>
            ) : (
              <button type="button" onClick={onAnchorClick} className={btnClass}>{btn}</button>
            )}
            {effort && (
              <p className="tp-meta" style={{ color: 'var(--ink-300)' }}>{effort}</p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
