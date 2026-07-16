export default function BlueprintCard({ bp, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-[20px] border border-[#E2E8F0] bg-white p-6 text-left transition hover:-translate-y-1 hover:border-[#BFDBFE] hover:shadow-md"
    >
      <span className="text-3xl">{bp.icon}</span>
      <h2 className="font-heading mt-4 font-bold text-[#07111F] group-hover:text-[#2563EB]">{bp.label}</h2>
      <p className="mt-2 text-sm leading-5 text-[#334155]">{bp.summary}</p>
      <span className="mt-5 inline-block text-xs font-bold text-[#2563EB]">View blueprint →</span>
    </button>
  );
}