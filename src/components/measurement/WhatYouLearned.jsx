/**
 * "What You Learned" — the expectation-vs-reality comparison, wherever the
 * product already showed this card (the workspace, the reflection, the evidence
 * profile, old cycle records).
 *
 * The comparison itself lives in ExpectationReality so that one view is the only
 * place these numbers are read, and every call site keeps the props it had.
 */
import ExpectationReality from '@/components/measurement/ExpectationReality';
import { hasPost } from '@/lib/expectation-reality';

export default function WhatYouLearned({ m, behavioral, compact = false }) {
  if (!hasPost(m)) return null;

  return (
    <div className={compact ? '' : 'rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-4'}>
      <ExpectationReality m={m} behavioral={behavioral} />
      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
        Evidence suggests what this work was like for you. Unscripted uses it to update what it knows, never to rule a path out on its own.
      </p>
    </div>
  );
}