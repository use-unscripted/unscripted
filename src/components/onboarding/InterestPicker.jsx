const options = [
  'Personal branding',
  'Startups',
  'Content creation',
  'Entrepreneurship',
  'Traditional careers',
];

export default function InterestPicker({ selected, onToggle }) {
  return (
    <div>
      <h2 className="tp-page text-[color:var(--surface-dark-900)]">What kind of life are you trying to build?</h2>
      <p className="tp-lead mt-3 text-[color:var(--ink-500)]">Choose every direction you genuinely want to explore.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {options.map(x => (
          <button
            type="button"
            key={x}
            onClick={() => onToggle(x)}
            className="tp-body rounded-[16px] border p-5 text-left font-semibold transition"
            style={
              selected.includes(x)
                ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }
                : { borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-700)' }
            }
          >
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}