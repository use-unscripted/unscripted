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
      <h2 className="font-heading text-2xl font-bold text-[#07111F]">What paths are on your radar?</h2>
      <p className="mt-2 text-sm text-[#64748B]">Choose every direction you genuinely want to explore.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {options.map(x => (
          <button
            type="button"
            key={x}
            onClick={() => onToggle(x)}
            className="rounded-[16px] border p-5 text-left text-sm font-semibold transition"
            style={
              selected.includes(x)
                ? { borderColor: '#2563EB', background: '#EFF6FF', color: '#2563EB' }
                : { borderColor: '#E2E8F0', background: 'white', color: '#334155' }
            }
          >
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}