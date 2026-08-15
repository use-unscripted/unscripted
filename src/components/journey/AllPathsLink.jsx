import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * The way out of My Journey to the full path list. It used to expand inline,
 * which put the whole library and the merge tool underneath the one instruction
 * this page is meant to carry.
 */
export default function AllPathsLink({ count = 0 }) {
  if (!count) return null;
  return (
    <Link
      to="/all-paths"
      className="app-card-flat touch-target flex items-center justify-between gap-3 p-5 text-left"
    >
      <span>
        <span className="tp-card block" style={{ color: 'var(--text-primary)' }}>
          See all paths available to me
        </span>
        <span className="tp-meta mt-0.5 block" style={{ color: 'var(--text-muted)' }}>
          {count} path{count === 1 ? '' : 's'} of your own, plus every other path you could explore.
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
    </Link>
  );
}