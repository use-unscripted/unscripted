import { Timer, Layers } from 'lucide-react';
import { depthMeta } from '@/lib/experiment-depth';

/**
 * Quick Test / Deep Dive, with its length. The one label a student needs to know
 * which kind of experiment they are looking at.
 */
export default function DepthBadge({ depth = 'quick_test', showDuration = true, className = '' }) {
  const meta = depthMeta(depth);
  const quick = meta.id === 'quick_test';
  const Icon = quick ? Timer : Layers;
  return (
    <span
      className={`tp-meta inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ${className}`}
      style={quick
        ? { background: 'var(--info-50)', color: 'var(--info-700)' }
        : { background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}
    >
      <Icon size={11} aria-hidden="true" />
      {meta.label}
      {showDuration && <span className="font-semibold opacity-80">· {meta.duration_label}</span>}
    </span>
  );
}