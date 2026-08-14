/**
 * PLACEHOLDER. Replace this with the real read-out.
 *
 * The read-out module (`src/lib/work-sim-readout.js`) and its screen are being
 * built separately. The page routes here after a run completes so the flow ends
 * somewhere honest in the meantime, rather than on a blank screen or on a
 * summary this branch would have had to invent.
 *
 * When the read-out lands: swap this component for it in WorkSimulationPage's
 * `done` stage and hand it the completed run plus the measurement row, both of
 * which that page already holds. Nothing else in the flow needs to change.
 *
 * Do not grow this file. Anything added here is a second read-out that will
 * disagree with the real one.
 */
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export default function SimReadoutPlaceholder() {
  return (
    <div className="space-y-5 py-6 text-center">
      <div
        className="mx-auto grid h-12 w-12 place-items-center rounded-full"
        style={{ background: 'var(--background-tertiary)' }}
      >
        <Check size={20} style={{ color: 'var(--brand-navy-700)' }} />
      </div>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>That is saved</h2>
      <p className="tp-body mx-auto max-w-md" style={{ color: 'var(--text-secondary)' }}>
        Your spec, your sprint and both replies are on your account. The page that puts
        what you predicted next to what happened is not built yet.
      </p>
      <Link to="/journey" className="ui-press app-cta tp-control" style={{ minHeight: '48px' }}>
        Back to My Journey
      </Link>
    </div>
  );
}
