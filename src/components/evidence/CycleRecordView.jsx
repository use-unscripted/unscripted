import { ArrowLeft, CheckCircle2, Circle, Lock, Eye } from 'lucide-react';
import CycleStageBlock from '@/components/evidence/CycleStageBlock';
import { fmtDate, typeLabel, VISIBILITY_LABELS } from '@/lib/evidence-library';

const DECISION_LABELS = { continue: 'Continue', adjust: 'Adjust', stop_and_explore: 'Stop and explore' };

export default function CycleRecordView({ record, onBack }) {
  const { cycle, path, pathName, experiments, missions, outreach, evidence, reflections, decision } = record;
  const reflection = reflections[0];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="tp-body flex items-center gap-1.5 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
        <ArrowLeft size={15} /> Back to the library
      </button>

      <header className="tp-card-body rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white">
        <p className="tp-eyebrow mb-2" style={{ color: 'var(--brand-navy-700)' }}>
          {cycle.status === 'completed' ? 'Completed cycle' : 'Cycle in progress'}
        </p>
        <h2 className="tp-section text-[color:var(--surface-dark-900)]">{pathName || 'Unassigned path'}</h2>
        <p className="tp-meta mt-2 text-[color:var(--ink-500)]">
          Started {fmtDate(cycle.started_at || cycle.created_date)}
          {cycle.completed_at ? ` · Completed ${fmtDate(cycle.completed_at)}` : ''}
          {cycle.baseline_clarity_score ? ` · Clarity ${cycle.baseline_clarity_score}${cycle.post_cycle_clarity_score ? ` → ${cycle.post_cycle_clarity_score}` : ''}` : ''}
        </p>
      </header>

      <CycleStageBlock step={1} label="Path" count={pathName ? 1 : 0} empty="No path recorded on this cycle.">
        <p className="tp-card text-[color:var(--surface-dark-900)]">{pathName}</p>
        {path?.why_it_fits && <p className="tp-prose mt-1.5 text-[color:var(--ink-700)]">{path.why_it_fits}</p>}
      </CycleStageBlock>

      <CycleStageBlock step={2} label="Experiment" count={experiments.length} empty="No experiment was run in this cycle.">
        <div className="space-y-3">
          {experiments.map((e) => (
            <div key={e.id}>
              <p className="tp-card text-[color:var(--surface-dark-900)]">{e.title}</p>
              {e.objective && <p className="tp-prose mt-1 text-[color:var(--ink-700)]">{e.objective}</p>}
              <p className="tp-meta mt-1.5 text-[color:var(--ink-400)]">Status: {e.status?.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={3} label="Missions" count={missions.length} empty="No missions in this cycle.">
        <div className="space-y-1.5">
          {missions.map((m) => (
            <div key={m.id} className="tp-body flex items-center gap-2 text-[color:var(--ink-700)]">
              {m.status === 'completed' ? <CheckCircle2 size={14} className="shrink-0 text-green-600" /> : <Circle size={14} className="shrink-0 text-[color:var(--ink-300)]" />}
              <span>{m.title}</span>
            </div>
          ))}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={4} label="Outreach" count={outreach.length} empty="No professional conversations logged in this cycle.">
        <div className="space-y-1.5">
          {outreach.map((c) => (
            <div key={c.id} className="tp-body text-[color:var(--ink-700)]">
              <span className="font-semibold text-[color:var(--surface-dark-900)]">{c.name}</span>
              {c.role || c.company ? <span className="text-[color:var(--ink-500)]"> · {[c.role, c.company].filter(Boolean).join(', ')}</span> : null}
              <span className="tp-meta ml-2 inline-block text-[color:var(--ink-400)]">{(c.response_status || '').replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={5} label="Evidence" count={evidence.length} empty="No evidence submitted in this cycle.">
        <div className="space-y-2">
          {evidence.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2.5 rounded-[var(--r-control)] border border-[color:var(--ink-200)] p-4">
                <div className="min-w-0 flex-1">
                  <p className="tp-card truncate text-[color:var(--surface-dark-900)]">{i.title}</p>
                  <p className="tp-meta mt-1 text-[color:var(--ink-400)]">
                    {typeLabel(i.type)} · {fmtDate(i.date)} ·{' '}
                    <span className="inline-flex items-center gap-1">
                      {i.visibility === 'private' ? <Lock size={11} /> : <Eye size={11} />} {VISIBILITY_LABELS[i.visibility] || i.visibility}
                    </span>
                  </p>
                </div>
              </div>
          ))}
        </div>
      </CycleStageBlock>

      <CycleStageBlock step={6} label="Reflection" count={reflections.length} empty="No reflection written for this cycle.">
        {reflection && (
          <div className="tp-prose space-y-2 text-[color:var(--ink-700)]">
            {reflection.lessons && <p><span className="font-semibold text-[color:var(--surface-dark-900)]">What it told me: </span>{reflection.lessons}</p>}
            {reflection.assumptions_changed && <p><span className="font-semibold text-[color:var(--surface-dark-900)]">What changed: </span>{reflection.assumptions_changed}</p>}
            {reflection.ended_early_reason && <p className="text-[color:var(--warning-700)]">Ended early: {reflection.ended_early_reason}</p>}
          </div>
        )}
      </CycleStageBlock>

      <CycleStageBlock step={7} label="Decision" count={decision ? 1 : 0} empty="This cycle has not been closed with a decision yet.">
        <p className="tp-card text-[color:var(--surface-dark-900)]">{DECISION_LABELS[decision] || decision}</p>
        {cycle.decision_note && <p className="tp-prose mt-1.5 text-[color:var(--ink-700)]">{cycle.decision_note}</p>}
      </CycleStageBlock>
    </div>
  );
}