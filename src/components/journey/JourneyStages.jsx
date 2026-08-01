import { Check } from 'lucide-react';
import { STAGES, STAGE_INDEX } from '@/lib/journey';

/**
 * Persistent six-stage progress indicator.
 * Mobile: horizontal row of compact dots + the active stage named beneath — no sideways scroll.
 * Desktop: full labelled track.
 */
export default function JourneyStages({ stage }) {
  const activeIdx = STAGE_INDEX[stage] ?? 0;
  const active = STAGES[activeIdx];

  return (
    <section
      aria-label="Your journey progress"
      className="rounded-[16px] bg-white p-4 sm:p-5"
      style={{ border: '1px solid var(--border-light)' }}
    >
      <div className="flex items-center gap-1.5 sm:gap-2">
        {STAGES.map((s, i) => {
          const done = i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div key={s.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center gap-1">
                <div
                  aria-current={isActive ? 'step' : undefined}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                  style={
                    isActive
                      ? { background: 'var(--brand-navy-900)', color: '#fff', boxShadow: '0 0 0 4px rgba(31,58,95,0.14)' }
                      : done
                      ? { background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }
                      : { background: 'var(--background-tertiary)', color: 'var(--text-muted)' }
                  }
                >
                  {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className="h-[3px] flex-1 rounded-full"
                    style={{ background: done ? 'var(--brand-gold-500)' : 'var(--background-tertiary)' }}
                  />
                )}
              </div>
              <span
                className="hidden w-full truncate text-center text-[11px] font-bold uppercase tracking-[.08em] sm:block"
                style={{ color: isActive ? 'var(--brand-navy-900)' : 'var(--text-muted)' }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t pt-3 text-center sm:text-left" style={{ borderColor: 'var(--border-light)' }}>
        <p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: 'var(--brand-navy-700)' }}>
          Stage {activeIdx + 1} of {STAGES.length} · {active.label}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{active.question}</p>
      </div>
    </section>
  );
}