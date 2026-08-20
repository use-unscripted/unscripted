import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * One piece of the Lab at a time.
 *
 * The Lab had nine stacked panels, which is a page nobody reads to the bottom.
 * Same panels, same data — but shown one at a time, with arrows and a named
 * strip so a student can move straight to the part they care about.
 *
 * `items` is [{ key, label, node }]. Empty sections are filtered by the caller,
 * so every step here has something in it.
 */
export default function LabDeck({ items = [] }) {
  const [i, setI] = useState(0);
  if (!items.length) return null;

  const index = Math.min(i, items.length - 1);
  const current = items[index];
  const last = items.length - 1;

  return (
    <section>
      {/* Jump straight to a part, rather than clicking through to it. */}
      <div className="flex flex-wrap gap-2">
        {items.map((it, n) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setI(n)}
            className="tp-meta rounded-full px-3 py-1.5 font-bold"
            style={n === index
              ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)' }
              : { background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div className="mt-4">{current.node}</div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setI(n => Math.max(0, n - 1))}
          disabled={index === 0}
          className="tp-body inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-4 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '44px' }}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span className="tp-meta" style={{ color: 'var(--ink-400)' }}>
          {index + 1} of {items.length}
        </span>
        <button
          type="button"
          onClick={() => setI(n => Math.min(last, n + 1))}
          disabled={index === last}
          className="tp-body inline-flex items-center gap-1.5 rounded-[var(--r-control)] border px-4 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '44px' }}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}