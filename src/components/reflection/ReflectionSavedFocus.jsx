import { Link } from 'react-router-dom';
import { CheckCircle2, FlaskConical } from 'lucide-react';
import FocusOverlay from '@/components/FocusOverlay';

/**
 * The moment a reflection is saved, said out loud.
 *
 * A saved reflection used to be a small grey line under four more panels, so a
 * student who had just finished writing had no idea it had landed. This singles
 * out the confirmation, then points at the one thing worth doing next: picking
 * the test that will tell them the most.
 *
 * Dismissible on purpose. The rest of this page (what the evidence changed, the
 * decision) is still there behind it.
 */
export default function ReflectionSavedFocus({ onClose }) {
  return (
    <FocusOverlay onClose={onClose} label="Close">
      <section className="app-card p-6 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: 'var(--success-50)' }}>
          <CheckCircle2 size={22} style={{ color: 'var(--success-700)' }} />
        </div>
        <h2 className="tp-section mt-5" style={{ color: 'var(--text-primary)' }}>Your reflection is saved</h2>
        <p className="tp-prose mx-auto mt-2.5 max-w-md" style={{ color: 'var(--text-secondary)' }}>
          It is now part of the evidence on this path.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link to="/test" className="ui-press app-cta tp-control w-full sm:w-auto" style={{ minHeight: '48px' }}>
            <FlaskConical size={16} /> See what to test next
          </Link>
          <button onClick={onClose} className="tp-meta font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
            Stay here and finish this cycle
          </button>
        </div>
      </section>
    </FocusOverlay>
  );
}