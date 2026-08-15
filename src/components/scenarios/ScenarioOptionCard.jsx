/**
 * One option, as a large tappable card. No dropdowns and no pinhead radio dots:
 * on a phone this is the primary control, so the whole surface is the target and
 * the text stays short enough not to wrap into a paragraph.
 */
export default function ScenarioOptionCard({ text, selected, onSelect, disabled }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className="ui-press flex w-full items-start gap-3 rounded-[var(--r-control)] border p-4 text-left disabled:opacity-60"
      style={{
        minHeight: '64px',
        borderColor: selected ? 'var(--brand-navy-900)' : 'var(--border-light)',
        background: selected ? 'var(--info-50)' : 'var(--brand-white)',
        borderWidth: selected ? 2 : 1,
      }}
    >
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-white"
        style={{
          borderColor: selected ? 'var(--brand-navy-900)' : 'var(--ink-300)',
          background: selected ? 'var(--brand-navy-900)' : 'transparent',
        }}
      >
        {selected ? '\u2713' : ''}
      </span>
      <span className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{text}</span>
    </button>
  );
}