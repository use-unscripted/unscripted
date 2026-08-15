import { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';

const dateLabel = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * One look-alike pair. The student chooses which path to keep; the other is the
 * one folded into it. Default choice is the path they are testing, then whichever
 * carries more work, because that is the row their history already points at.
 */
export default function MergePairCard({ pair, busy, disabled, failed, onMerge }) {
  const ranked = [...pair.options].sort(
    (a, b) => (b.is_primary_focus - a.is_primary_focus) || (b.linked_records - a.linked_records)
  );
  const [keepId, setKeepId] = useState(ranked[0].id);
  const duplicate = pair.options.find(o => o.id !== keepId);
  const keep = pair.options.find(o => o.id === keepId);

  return (
    <div
      className="rounded-[var(--r-control)] p-4"
      style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}
    >
      <p className="tp-meta font-bold uppercase" style={{ color: 'var(--brand-navy-700)' }}>
        {Math.round(pair.similarity * 100)}% the same wording
      </p>

      <div className="mt-3 space-y-2">
        {pair.options.map(option => (
          <label
            key={option.id}
            className="touch-target flex cursor-pointer items-start gap-3 rounded-[var(--r-control)] p-3"
            style={{
              background: 'var(--background-primary)',
              border: `1px solid ${option.id === keepId ? 'var(--brand-navy-700)' : 'var(--border-light)'}`,
            }}
          >
            <input
              type="radio"
              name={`keep-${pair.options.map(o => o.id).join('-')}`}
              checked={option.id === keepId}
              onChange={() => setKeepId(option.id)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="tp-body block font-bold" style={{ color: 'var(--text-primary)' }}>
                {option.path_name}
                {option.is_primary_focus && (
                  <span className="tp-meta ml-2 font-bold uppercase" style={{ color: 'var(--success-700)' }}>
                    Testing now
                  </span>
                )}
              </span>
              <span className="tp-meta block" style={{ color: 'var(--text-muted)' }}>
                {option.linked_records} record{option.linked_records === 1 ? '' : 's'} attached
                {dateLabel(option.created_date) ? ` · added ${dateLabel(option.created_date)}` : ''}
              </span>
            </span>
          </label>
        ))}
      </div>

      <p className="tp-meta mt-3 flex flex-wrap items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
        {duplicate?.linked_records
          ? `${duplicate.linked_records} record${duplicate.linked_records === 1 ? '' : 's'} move from "${duplicate.path_name}"`
          : `"${duplicate?.path_name}" has nothing attached yet`}
        <ArrowRight size={12} />
        {`"${keep?.path_name}"`}
      </p>

      <button
        type="button"
        onClick={() => onMerge(keepId, duplicate.id)}
        disabled={disabled}
        className="ui-press tp-body mt-3 inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] px-5 font-bold text-white disabled:opacity-60"
        style={{ background: 'var(--brand-navy-900)', minHeight: '44px' }}
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        Merge into the path I keep
      </button>

      {failed && (
        <p className="tp-meta mt-2" style={{ color: 'var(--danger-700)' }}>
          That did not go through. Try again.
        </p>
      )}
    </div>
  );
}