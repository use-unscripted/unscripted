import { Check } from 'lucide-react';

export default function RoadmapSection({ title, items }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-6 shadow-sm">
      <h2 className="font-heading text-lg font-bold text-[color:var(--surface-dark-900)]">{title}</h2>
      <div className="mt-5 space-y-3">
        {items.map((x, i) => (
          <div key={i} className="flex gap-3 rounded-xl p-4" style={{ background: 'var(--page-surface)', border: '1px solid var(--ink-200)' }}>
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: 'var(--ink-100)' }}>
              <Check size={11} style={{ color: 'var(--brand-navy-900)' }} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--surface-dark-900)]">
                {typeof x === 'string' ? x : x.focus || x.goal || x.title}
              </p>
              {typeof x === 'object' && (
                <p className="mt-1 text-xs text-[color:var(--ink-500)]">
                  {x.week || x.phase} {x.outcome && `· ${x.outcome}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}