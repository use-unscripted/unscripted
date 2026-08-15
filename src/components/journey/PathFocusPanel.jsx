import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { COMPARISON_FIELDS, RISK_LABEL } from '@/components/journey/pathComparisonFields';

/**
 * Focus on one path at a time and read its description one part at a time.
 *
 * Same fields, same order as the side-by-side comparison — this is a reading
 * mode for a single path, not a second source of truth.
 */
export default function PathFocusPanel({ paths = [] }) {
  const [pathIndex, setPathIndex] = useState(0);
  const [fieldIndex, setFieldIndex] = useState(0);

  if (!paths.length) return null;

  const path = paths[Math.min(pathIndex, paths.length - 1)];
  const field = COMPARISON_FIELDS[fieldIndex];
  const value = field.get(path);

  const pickPath = (i) => { setPathIndex(i); setFieldIndex(0); };

  return (
    <section className="app-card p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Focus on one path</h2>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
        Read one path at a time, one part of its description at a time.
      </p>

      {/* Which path */}
      <div className="mt-4 flex flex-wrap gap-2">
        {paths.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pickPath(i)}
            aria-pressed={i === pathIndex}
            className="tp-meta rounded-full px-3.5 py-2 font-bold"
            style={i === pathIndex
              ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)' }
              : { background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          >
            {p.path_name}
          </button>
        ))}
      </div>

      {/* Which part of the description */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {COMPARISON_FIELDS.map((f, i) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFieldIndex(i)}
            aria-pressed={i === fieldIndex}
            className="tp-meta rounded-[var(--r-control)] px-2.5 py-1.5 font-semibold"
            style={i === fieldIndex
              ? { background: 'var(--ink-100)', color: 'var(--brand-navy-900)', border: '1px solid var(--brand-navy-700)' }
              : { background: 'transparent', color: 'var(--ink-500)', border: '1px solid var(--border-light)' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        className="mt-4 rounded-[var(--r-control)] p-4"
        style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}
      >
        <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{field.label}</p>
        <p className="tp-prose mt-2" style={{ color: 'var(--ink-700)' }}>
          {value || 'Nothing recorded here yet.'}
        </p>
        {path.risk_level && fieldIndex === 0 && (
          <p className="tp-meta mt-2" style={{ color: 'var(--ink-400)' }}>
            {RISK_LABEL[path.risk_level] || ''}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setFieldIndex(i => Math.max(0, i - 1))}
          disabled={fieldIndex === 0}
          className="tp-body inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-4 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '44px' }}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span className="tp-meta" style={{ color: 'var(--ink-400)' }}>
          {fieldIndex + 1} of {COMPARISON_FIELDS.length}
        </span>
        <button
          type="button"
          onClick={() => setFieldIndex(i => Math.min(COMPARISON_FIELDS.length - 1, i + 1))}
          disabled={fieldIndex === COMPARISON_FIELDS.length - 1}
          className="tp-body inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-4 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '44px' }}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}