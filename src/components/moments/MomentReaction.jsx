import { REACTIONS, AGAIN_OPTIONS } from '@/lib/career-moment';

/** Stage 4. Two questions. The long post-experiment survey stays for Deep Dives. */
export default function MomentReaction({ reaction, onReaction, again, onAgain, onFinish, saving }) {
  return (
    <div className="space-y-7">
      <div>
        <p className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>How did that feel?</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REACTIONS.map(r => (
            <button key={r.value} onClick={() => onReaction(r.value)}
              className="rounded-[14px] border px-3 py-4 text-center transition"
              style={reaction === r.value
                ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)' }
                : { borderColor: 'var(--ink-200)', background: 'white' }}>
              <span className="block text-2xl" aria-hidden="true">{r.emoji}</span>
              <span className="tp-meta mt-1 block font-semibold" style={{ color: 'var(--ink-700)' }}>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>Would you want to do another task like this?</p>
        <div className="mt-3 flex gap-2">
          {AGAIN_OPTIONS.map(o => (
            <button key={o.value} onClick={() => onAgain(o.value)}
              className="tp-body flex-1 rounded-[12px] border py-3 font-semibold transition"
              style={again === o.value
                ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }
                : { borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-700)' }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onFinish} disabled={!reaction || !again || saving}
        className="tp-body ui-press w-full rounded-[12px] py-3.5 font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)' }}>
        {saving ? 'Saving your evidence…' : 'Save my evidence'}
      </button>
    </div>
  );
}