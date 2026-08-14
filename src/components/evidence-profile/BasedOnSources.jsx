import { basedOnParts } from '@/lib/experiment-depth';

/**
 * What a conclusion is actually built from, in the student's own terms:
 * "Based on 4 Quick Tests · 1 Deep Dive · 1 Proof".
 */
export default function BasedOnSources({ counts, className = 'mt-2' }) {
  const parts = basedOnParts(counts || {});
  if (!parts.length) return null;
  return (
    <p className={`tp-meta ${className}`} style={{ color: 'var(--ink-500)' }}>
      Based on{' '}
      <span className="font-semibold" style={{ color: 'var(--ink-700)' }}>{parts.join(' · ')}</span>
    </p>
  );
}