export default function BlueprintCard({ bp, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border bg-white p-6 text-left transition hover:border-blue-400 hover:shadow-md"
    >
      <span className="text-3xl">{bp.icon}</span>
      <h2 className="mt-4 font-bold text-[#07152f] group-hover:text-blue-600">{bp.label}</h2>
      <p className="mt-2 text-sm leading-5 text-slate-500">{bp.summary}</p>
      <span className="mt-5 inline-block text-xs font-bold text-blue-600">View blueprint →</span>
    </button>
  );
}