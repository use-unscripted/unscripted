import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { STAGES, STAGE_INDEX } from '@/lib/journey';

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

  const btn = (
    <>
      {action.label}
      <ArrowRight size={18} className="shrink-0" aria-hidden="true" />
    </>
  );
  const btnClass =
    'ui-press journey-now-cta inline-flex w-full items-center justify-center gap-2 rounded-[12px] px-8 tp-card sm:w-auto';

  return (
    <section
      className="relative overflow-hidden rounded-[22px] px-6 py-8 sm:px-10 sm:py-11"
      style={{
        background: 'linear-gradient(148deg, var(--brand-navy-900) 0%, var(--brand-navy-700) 100%)',
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

      <div className="max-w-2xl">
        <p className="tp-eyebrow" style={{ color: 'var(--brand-gold-500)' }}>
          Now · {current.label}
        </p>

        <h2
          id="journey-now-subject"
          className="tp-hero mt-4 text-white"
          style={{ overflowWrap: 'anywhere' }}
        >
          {subject}
        </h2>

        {detail && (
          <p className="tp-lead mt-4" style={{ color: 'var(--ink-300)' }}>
            {detail}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          {action.to ? (
            <Link to={action.to} className={btnClass}>{btn}</Link>
          ) : (
            <button type="button" onClick={onAnchorClick} className={btnClass}>{btn}</button>
          )}
          {effort && (
            <p className="tp-meta" style={{ color: 'var(--ink-300)' }}>{effort}</p>
          )}
        </div>
      </div>
    </section>
  );
}
