import { Check } from 'lucide-react';

export default function RoadmapSection({ title, items }) {
  return (
    <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <h2 className="font-heading text-lg font-bold text-[#07111F]">{title}</h2>
      <div className="mt-5 space-y-3">
        {items?.map((x, i) => (
          <div key={i} className="flex gap-3 rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
              style={{ background: '#EFF6FF' }}
            >
              <Check size={11} className="text-[#2563EB]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#07111F]">
                {typeof x === 'string' ? x : x.focus || x.goal || x.title}
              </p>
              {typeof x === 'object' && (
                <p className="mt-1 text-xs text-[#64748B]">
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