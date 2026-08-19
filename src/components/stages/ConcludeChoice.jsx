/**
 * What "conclude this test" means, as a choice rather than a redirect.
 *
 * Two ways out, side by side: look at where this path's decision now stands, or
 * open the path back up and keep testing it. The reflection is still reachable
 * underneath, because that is where the decision itself is written down.
 */
import { Link } from 'react-router-dom';
import { BarChart3, FlaskConical, PenLine } from 'lucide-react';
import FocusOverlay from '@/components/FocusOverlay';

function Choice({ to, Icon, title, body, primary }) {
  return (
    <Link
      to={to}
      className="ui-press flex flex-1 flex-col rounded-[var(--r-surface)] p-5 text-left"
      style={primary
        ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)', boxShadow: 'var(--elev-cta)' }
        : { background: 'var(--background-primary)', border: '1px solid var(--border-light)' }}
    >
      <Icon size={18} style={{ color: primary ? 'var(--brand-gold-500)' : 'var(--brand-navy-700)' }} />
      <span className="tp-body mt-3 font-bold" style={{ color: primary ? 'var(--brand-white)' : 'var(--text-primary)' }}>
        {title}
      </span>
      <span className="tp-meta mt-1.5" style={{ color: primary ? 'rgba(255,255,255,0.78)' : 'var(--text-secondary)' }}>
        {body}
      </span>
    </Link>
  );
}

export default function ConcludeChoice({ pathId, pathName, onClose }) {
  const q = pathId ? `?pathId=${pathId}` : '';

  return (
    <FocusOverlay onClose={onClose} label="Close">
      <section className="app-card p-6 sm:p-8">
        <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
          Where do you want to go with {pathName || 'this path'}?
        </h2>
        <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
          You can look at what the evidence now says about this path, or open it back up and test it
          further. Neither one closes anything off.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Choice
            primary
            to={`/matrix${q}`}
            Icon={BarChart3}
            title="See the decision on this path"
            body="Its place in your Career Decision Matrix, with the evidence behind it."
          />
          <Choice
            to={`/conviction-lab${q}`}
            Icon={FlaskConical}
            title="Open this path back up to test"
            body="Its Conviction Lab: what still has thin evidence, and the next test for it."
          />
        </div>

        <Link
          to="/reflect"
          className="tp-meta mt-5 inline-flex items-center gap-1.5 font-bold"
          style={{ color: 'var(--brand-navy-700)', minHeight: '44px' }}
        >
          <PenLine size={13} /> Record or edit my reflection on this test
        </Link>
      </section>
    </FocusOverlay>
  );
}