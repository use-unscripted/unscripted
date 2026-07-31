/**
 * The presentation pieces a guided, one-question-at-a-time flow is built from.
 *
 * One copy, shared by every guided flow — the outreach survey
 * (src/components/outreach/OutreachPlanModal.jsx) and anything else that asks
 * one question at a time. Change a token here and every flow moves together;
 * that is the point of the file.
 *
 * Presentation only. No step state, no navigation, no keyboard handling: the
 * flow owns those, because that is where they differ.
 */
import { Check } from 'lucide-react';

// A guided panel drops its own bottom padding so this bar can stick to the
// panel's edge — the primary action stays reachable however long the list is.
export const footerCls =
  'sticky bottom-0 z-10 -mx-6 mt-6 rounded-b-[24px] border-t border-[#EEF2F6] bg-white px-6 pb-6 pt-4 sm:-mx-8 sm:px-8';

export function ProgressBar({ value }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: '#EEF2F6' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.round(value * 100)}%`,
          background: 'linear-gradient(90deg, var(--brand-navy-700), var(--brand-navy-900))',
          transition: 'width var(--dur-slow) var(--ease-out)',
        }}
      />
    </div>
  );
}

export function OptionRow({ option, selected, index, onSelect, multi }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="opt-row group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left"
      style={{
        // Capped: an uncapped stagger leaves the tail of a long list invisible
        // for seconds.
        animationDelay: `${40 + Math.min(index, 8) * 45}ms`,
        borderColor: selected ? 'var(--brand-navy-900)' : '#E2E8F0',
        background: selected ? '#F3F7FC' : '#FFFFFF',
        boxShadow: selected ? '0 6px 18px rgba(31,58,95,0.12)' : 'none',
      }}
    >
      {/* square indicator when several answers are allowed, round when it's one of N */}
      <span
        className={`opt-dot flex h-5 w-5 shrink-0 items-center justify-center border ${multi ? 'rounded-[7px]' : 'rounded-full'}`}
        style={{
          borderColor: selected ? 'var(--brand-navy-900)' : '#CBD5E1',
          background: selected ? 'var(--brand-navy-900)' : 'transparent',
        }}
      >
        {selected && <Check size={12} strokeWidth={3} className="anim-scale-in text-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{option.label}</span>
        {option.desc && <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-secondary)' }}>{option.desc}</span>}
      </span>
      {/* only the first nine are reachable by number key, so only those get the hint */}
      {index < 9 && (
        <span className="opt-key hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:block"
          style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
          {index + 1}
        </span>
      )}
    </button>
  );
}

/**
 * The keyframes the step pane and the option rows animate on. Render once,
 * inside the flow.
 */
export function GuidedStyles() {
  return (
    <style>{`
      @keyframes stepInFwd  { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
      @keyframes stepInBack { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
      @keyframes optIn      { from { opacity: 0; transform: translateY(8px); }  to { opacity: 1; transform: none; } }
      .step-pane-fwd  { animation: stepInFwd  var(--dur-base) var(--ease-out) both; }
      .step-pane-back { animation: stepInBack var(--dur-base) var(--ease-out) both; }
      .opt-row {
        animation: optIn var(--dur-base) var(--ease-out) both;
        transition: border-color var(--dur-fast) var(--ease-out),
                    background   var(--dur-fast) var(--ease-out),
                    box-shadow   var(--dur-base) var(--ease-out),
                    transform    var(--dur-base) var(--ease-spring);
      }
      .opt-row:hover  { transform: translateX(3px); border-color: var(--brand-navy-700) !important; }
      .opt-row:active { transform: scale(0.985); transition-duration: 80ms; }
      .opt-row:hover .opt-key { color: var(--brand-navy-700); border-color: var(--brand-navy-700); }
      .opt-dot { transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out); }
    `}</style>
  );
}
