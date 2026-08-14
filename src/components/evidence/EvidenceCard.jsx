import { Calendar, Lock, Eye, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { RESUME_STATUS, VISIBILITY_LABELS, typeLabel, fmtDate } from '@/lib/evidence-library';

/* The student's own reading, phrased as evidence rather than as a verdict. */
const DIRECTION_LABELS = {
  supports: 'Evidence suggests this supports the hypothesis',
  weakens: 'Evidence suggests this weakens the hypothesis',
  mixed: 'Points both ways',
  unclear: 'Still uncertain',
};

function Chip({ children, bg = 'var(--ink-100)', color = 'var(--ink-500)' }) {
  return <span className="tp-meta rounded-full px-2.5 py-1 font-bold" style={{ background: bg, color }}>{children}</span>;
}

export default function EvidenceCard({ item, onReview, onOpenCycle }) {
  const rs = RESUME_STATUS[item.resumeStatus] || RESUME_STATUS.not_reviewed;
  const isPrivate = item.visibility === 'private';

  return (
    <div className="tp-card-body rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <Chip bg="var(--ink-100)" color="var(--brand-navy-900)">{typeLabel(item.type)}</Chip>
        <Chip bg={rs.bg} color={rs.text}>{rs.label}</Chip>
        <Chip>{isPrivate ? <span className="inline-flex items-center gap-1"><Lock size={11} /> Private</span>
                        : <span className="inline-flex items-center gap-1"><Eye size={11} /> {VISIBILITY_LABELS[item.visibility] || item.visibility}</span>}</Chip>
        {item.date && (
          <span className="tp-meta ml-auto inline-flex items-center gap-1.5 text-[color:var(--ink-400)]"><Calendar size={13} /> {fmtDate(item.date)}</span>
        )}
      </div>

      <h3 className="tp-card mt-4 text-[color:var(--surface-dark-900)]">{item.title}</h3>

      <p className="tp-meta mt-1.5 flex flex-wrap items-center gap-1.5 text-[color:var(--ink-500)]">
        {[item.pathName, item.experimentTitle, item.missionTitle].filter(Boolean).map((part, i, arr) => (
          <span key={part + i} className="inline-flex items-center gap-1">
            {part}{i < arr.length - 1 && <ArrowRight size={12} className="text-[color:var(--ink-300)]" />}
          </span>
        ))}
        {!item.pathName && !item.experimentTitle && !item.missionTitle && <span>Not linked to an experiment yet</span>}
      </p>

      {/* What this evidence says about the hypothesis, in the student's words.
          Silent when they have not answered it yet — an empty prompt on every
          card would read as a chore rather than a finding. */}
      {(item.interpretation || item.interpretationDirection) && (
        <div className="mt-4 rounded-[var(--r-control)] px-4 py-3" style={{ background: 'var(--background-tertiary)' }}>
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
            What this tells us
            {item.interpretationDirection && ` · ${DIRECTION_LABELS[item.interpretationDirection] || item.interpretationDirection}`}
          </p>
          {item.interpretedTestQuestion && (
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Tested: {item.interpretedTestQuestion}
            </p>
          )}
          {item.interpretation && (
            <p className="tp-prose mt-1.5" style={{ color: 'var(--text-primary)' }}>{item.interpretation}</p>
          )}
        </div>
      )}

      {item.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.skills.map((s, i) => (
            <span key={s + i} className="tp-meta rounded-full border border-[color:var(--ink-200)] px-2.5 py-1 text-[color:var(--ink-700)]">{s}</span>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => onReview(item)}
          className="tp-meta flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>
          {item.resumeStatus === 'approved' ? <><CheckCircle2 size={13} /> Review approved details</> : <><FileText size={13} /> Review for resume</>}
        </button>
        {item.cycleId && (
          <button onClick={() => onOpenCycle(item.cycleId)}
            className="tp-meta flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-4 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
            Open full cycle <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}