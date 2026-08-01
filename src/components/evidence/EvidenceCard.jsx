import { Calendar, Lock, Eye, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { RESUME_STATUS, VISIBILITY_LABELS, typeLabel, fmtDate } from '@/lib/evidence-library';

function Chip({ children, bg = '#F1F5F9', color = '#64748B' }) {
  return <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: bg, color }}>{children}</span>;
}

export default function EvidenceCard({ item, onReview, onOpenCycle }) {
  const rs = RESUME_STATUS[item.resumeStatus] || RESUME_STATUS.not_reviewed;
  const isPrivate = item.visibility === 'private';

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip bg="#EEF2F6" color="var(--brand-navy-900)">{typeLabel(item.type)}</Chip>
        <Chip bg={rs.bg} color={rs.text}>{rs.label}</Chip>
        <Chip>{isPrivate ? <span className="inline-flex items-center gap-1"><Lock size={9} /> Private</span>
                        : <span className="inline-flex items-center gap-1"><Eye size={9} /> {VISIBILITY_LABELS[item.visibility] || item.visibility}</span>}</Chip>
        {item.date && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#94A3B8]"><Calendar size={11} /> {fmtDate(item.date)}</span>
        )}
      </div>

      <h3 className="mt-3 font-heading text-lg font-bold text-[#050816]">{item.title}</h3>

      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#64748B]">
        {[item.pathName, item.experimentTitle, item.missionTitle].filter(Boolean).map((part, i, arr) => (
          <span key={part + i} className="inline-flex items-center gap-1">
            {part}{i < arr.length - 1 && <ArrowRight size={10} className="text-[#CBD5E1]" />}
          </span>
        ))}
        {!item.pathName && !item.experimentTitle && !item.missionTitle && <span>Not linked to an experiment yet</span>}
      </p>

      {item.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.skills.map((s, i) => (
            <span key={s + i} className="rounded-full border border-[#E2E8F0] px-2.5 py-1 text-[10px] text-[#334155]">{s}</span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => onReview(item)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>
          {item.resumeStatus === 'approved' ? <><CheckCircle2 size={12} /> Review approved details</> : <><FileText size={12} /> Review for resume</>}
        </button>
        {item.cycleId && (
          <button onClick={() => onOpenCycle(item.cycleId)}
            className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
            Open full cycle <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}