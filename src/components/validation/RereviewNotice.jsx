import { AlertCircle } from 'lucide-react';
import { REREVIEW_LABEL, REREVIEW_NOTE } from '@/lib/experiment-revision';

/**
 * Shown when the experiment on screen was materially updated after its last
 * professional approval. The point is honesty: the previous version's reviews
 * are still on file, but they described different work, so this version cannot
 * borrow their badge.
 */
export default function RereviewNotice({ strength, validation }) {
  if (!strength?.rereview_pending) return null;
  const labels = validation?.rereview_change_labels || [];

  return (
    <div
      className="app-inset mt-4 flex gap-2.5 p-4"
      style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)' }}
    >
      <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--warning-700)' }} aria-hidden="true" />
      <div>
        <p className="tp-control" style={{ color: 'var(--warning-700)' }}>{REREVIEW_LABEL}</p>
        <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{REREVIEW_NOTE}</p>
        {labels.length > 0 && (
          <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
            What changed: {labels.join(', ')}.
          </p>
        )}
      </div>
    </div>
  );
}