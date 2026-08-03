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
      <h2 className="font-heading text-2xl font-bold text-[color:var(--surface-dark-900)]">What kind of life are you trying to build?</h2>
      <p className="mt-2 text-sm text-[color:var(--ink-500)]">Choose every direction you genuinely want to explore.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {options.map(x => (
          <button
            type="button"
            key={x}
            onClick={() => onToggle(x)}
            className="rounded-[16px] border p-5 text-left text-sm font-semibold transition"
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