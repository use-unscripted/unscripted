import { ArrowRight } from 'lucide-react';

export default function BlueprintCard({ bp, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 text-left transition hover:-translate-y-1 hover:border-[#BFDBFE] hover:shadow-md"
    >
      <bp.Icon size={30} strokeWidth={1.6} aria-hidden="true" className="text-[color:var(--info-600)]" />
      <h2 className="tp-card mt-4 text-[color:var(--surface-dark-800)] group-hover:text-[color:var(--info-600)]">{bp.label}</h2>
      <p className="tp-body mt-2 text-[color:var(--ink-700)]">{bp.summary}</p>
      <span className="tp-meta mt-5 inline-flex items-center gap-1 font-bold text-[color:var(--info-600)]">View blueprint <ArrowRight size={14} aria-hidden="true" /></span>
    </button>
  );
}