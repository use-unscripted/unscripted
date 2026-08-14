/** Stage 2. The minimum information, one decision, one sentence of reasoning. */
export default function MomentTask({ moment, selected, onSelect, rationale, onRationale, onSubmit }) {
  return (
    <div className="space-y-6">
      {moment.information?.length > 0 && (
        <div className="rounded-[var(--r-surface)] border p-4" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
          {moment.information.map((row, i) => (
            <div key={i} className="tp-body flex justify-between gap-4 py-1">
              <span style={{ color: 'var(--ink-500)' }}>{row.label}</span>
              <span className="font-semibold" style={{ color: 'var(--surface-dark-900)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="tp-card" style={{ color: 'var(--surface-dark-900)' }}>{moment.question}</p>
        <div className="mt-3 space-y-2">
          {moment.options.map(o => (
            <button key={o.key} onClick={() => onSelect(o.key)}
              className="w-full rounded-[var(--r-control)] border p-4 text-left transition"
              style={selected === o.key
                ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)' }
                : { borderColor: 'var(--ink-200)', background: 'white' }}>
              <span className="tp-body flex gap-3" style={{ color: 'var(--ink-700)' }}>
                <span className="font-bold" style={{ color: 'var(--brand-navy-900)' }}>{o.key}.</span>
                <span>{o.text}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="tp-body mb-1 block font-semibold" style={{ color: 'var(--ink-700)' }}>{moment.rationale_prompt}</span>
        <textarea rows={2} value={rationale} onChange={e => onRationale(e.target.value)}
          placeholder="One sentence is enough."
          className="w-full rounded-[var(--r-control)] border px-4 py-3 text-base outline-none md:text-sm"
          style={{ borderColor: 'var(--ink-200)', background: 'var(--page-surface)' }} />
      </label>

      <button onClick={onSubmit} disabled={!selected}
        className="tp-body ui-press w-full rounded-[var(--r-control)] py-3.5 font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--brand-navy-900)' }}>
        Submit my answer
      </button>
    </div>
  );
}