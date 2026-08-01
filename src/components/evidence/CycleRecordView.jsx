import { ArrowLeft, CheckCircle2, Circle, Lock, Eye } from 'lucide-react';
import CycleStageBlock from '@/components/evidence/CycleStageBlock';
import { fmtDate, typeLabel, VISIBILITY_LABELS, RESUME_STATUS } from '@/lib/evidence-library';

const DECISION_LABELS = { continue: 'Continue', adjust: 'Adjust', stop_and_explore: 'Stop and explore' };

export default function CycleRecordView({ record, onBack, onReview }) {
  const { cycle, path, pathName, experiments, missions, outreach, evidence, reflections, decision } = record;
  const reflection = reflections[0];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
        <ArrowLeft size={14} /> Back to the library
      </button>

      <header className="rounded-[20px] border border-[#E2E8F0] bg-white p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>
          {cycle.status === 'completed' ? 'Completed cycle' : 'Cycle in progress'}
        </p>
        <h2 className="font-heading text-2xl font-bold text-[#050816]">{pathName || 'Unassigned path'}</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Started {fmtDate(cycle.started_at || cycle.created_date)}
          {cycle.completed_at ? ` · Completed ${fmtDate(cycle.completed_at)}` : ''}
          {cycle.baseline_clarity_score ? ` · Clarity ${cycle.baseline_clarity_score}${cycle.post_cycle_clarity_score ? ` → ${cycle.post_cycle_clarity_score}` : ''}` : ''}
        </p>
      </header>

      <CycleStageBlock step={1} label="Path" count={pathName ? 1 : 0} empty="No path recorded on this cycle.">
        <p className="text-sm font-semibold text-[#050816]">{pathName}</p>
        {path?.why_it_fits && <p className="mt-1 text-sm text-[#334155]">{path.why_it_fits}</p>}
      </CycleStageBlock>

      <CycleStageBlock step={2} label="Experiment" count={experiments.length} empty="No experiment was run in this cycle.">
        <div className="space-y-3">
          {experiments.map((e) => (
            <div key={e.id}>
              <p className="text-sm font-semibold text-[#050816]">{e.title}</p>
              {e.objective && <p className="text-sm text-[#334155]">{e.objective}</p>}
              <p className="mt-0.5 text-xs text-[#94A3B8]">Status: {e.status?.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={3} label="Missions" count={missions.length} empty="No missions in this cycle.">
        <div className="space-y-1.5">
          {missions.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm text-[#334155]">
              {m.status === 'completed' ? <CheckCircle2 size={13} className="shrink-0 text-green-600" /> : <Circle size={13} className="shrink-0 text-[#CBD5E1]" />}
              <span>{m.title}</span>
            </div>
          ))}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={4} label="Outreach" count={outreach.length} empty="No professional conversations logged in this cycle.">
        <div className="space-y-1.5">
          {outreach.map((c) => (
            <div key={c.id} className="text-sm text-[#334155]">
              <span className="font-semibold text-[#050816]">{c.name}</span>
              {c.role || c.company ? <span className="text-[#64748B]"> — {[c.role, c.company].filter(Boolean).join(', ')}</span> : null}
              <span className="ml-2 text-xs text-[#94A3B8]">{(c.response_status || '').replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={5} label="Evidence" count={evidence.length} empty="No evidence submitted in this cycle.">
        <div className="space-y-2">
          {evidence.map((i) => {
            const rs = RESUME_STATUS[i.resumeStatus] || RESUME_STATUS.not_reviewed;
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#050816]">{i.title}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {typeLabel(i.type)} · {fmtDate(i.date)} ·{' '}
                    <span className="inline-flex items-center gap-1">
                      {i.visibility === 'private' ? <Lock size={9} /> : <Eye size={9} />} {VISIBILITY_LABELS[i.visibility] || i.visibility}
                    </span>
                  </p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: rs.bg, color: rs.text }}>{rs.label}</span>
                <button onClick={() => onReview(i)} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
                  Review for resume
                </button>
              </div>
            );
          })}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={6} label="Reflection" count={reflections.length} empty="No reflection written for this cycle.">
        {reflection && (
          <div className="space-y-2 text-sm text-[#334155]">
            {reflection.lessons && <p><span className="font-semibold text-[#050816]">What it told me: </span>{reflection.lessons}</p>}
            {reflection.assumptions_changed && <p><span className="font-semibold text-[#050816]">What changed: </span>{reflection.assumptions_changed}</p>}
            {reflection.ended_early_reason && <p className="text-[#B45309]">Ended early: {reflection.ended_early_reason}</p>}
          </div>
        )}
      </CycleStageBlock>

      <CycleStageBlock step={7} label="Decision" count={decision ? 1 : 0} empty="This cycle has not been closed with a decision yet.">
        <p className="text-sm font-semibold text-[#050816]">{DECISION_LABELS[decision] || decision}</p>
        {cycle.decision_note && <p className="mt-1 text-sm text-[#334155]">{cycle.decision_note}</p>}
      </CycleStageBlock>
    </div>
  );
}