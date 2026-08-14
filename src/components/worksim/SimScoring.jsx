/**
 * The gap between the last question and the read-out.
 *
 * One model call scores two of the five criteria, and it is not instant. The
 * alternative to this screen was drawing the read-out straight away and
 * upgrading it when the review landed, which was rejected: the read-out's own
 * degraded copy is written in the past tense, so it would tell a student we
 * could not run a review that was in fact running, and then change under them.
 * Whatever is on screen first has to be true on its own.
 *
 * Three things keep this from becoming a spinner nobody can get out of:
 *
 * **The run is already saved when this draws.** Every write happened before the
 * model call was issued, so this screen is waiting on two checks and never on
 * the student's work. The heading says exactly that, because after thirty
 * minutes the first thing anybody wants to know is whether it was kept.
 *
 * **There is a deadline.** The page gives up after `REVIEW_WAIT_MS` and draws
 * the read-out with three checks and the module's own account of the two that
 * are missing.
 *
 * **There is a way out.** The button skips the wait immediately. A student who
 * does not care about two more checks should not be held here by a network
 * call.
 */
import { Loader2 } from 'lucide-react';

export default function SimScoring({ onSkip }) {
  return (
    <div aria-live="polite">
      <div className="flex items-start gap-3">
        <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Your run is saved</h2>
          <p className="tp-body tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
            Two of the five checks are read by a model rather than counted, and that is running now.
            Your read-out opens either way.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="tp-control ui-press app-cta-secondary mt-6"
        style={{ minHeight: '48px' }}
      >
        Show my read-out now
      </button>
    </div>
  );
}
