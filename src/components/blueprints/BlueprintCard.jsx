export default function BlueprintCard({ bp, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-[20px] border border-[color:var(--ink-200)] bg-white p-6 text-left transition hover:-translate-y-1 hover:border-[#BFDBFE] hover:shadow-md"
    >
      <span className="text-3xl">{bp.icon}</span>
      <h2 className="font-heading mt-4 font-bold text-[color:var(--surface-dark-800)] group-hover:text-[color:var(--info-600)]">{bp.label}</h2>
      <p className="mt-2 text-sm leading-5 text-[color:var(--ink-700)]">{bp.summary}</p>
      <span className="mt-5 inline-block text-xs font-bold text-[color:var(--info-600)]">View blueprint →</span>
    </button>
  );
}