/**
 * One mission, fully described: purpose, required action, suggested steps,
 * effort, evidence requirement, status, and the outreach it requires.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, CheckCircle2, FileText } from 'lucide-react';
import MissionOutreachPanel from './MissionOutreachPanel';

const STATUS = {
  planned: { bg: '#F1F5F9', text: '#334155', label: 'Planned' },
  in_progress: { bg: '#FFFBEB', text: '#B45309', label: 'In progress' },
  completed: { bg: '#F0FDF4', text: '#15803D', label: 'Completed' },
  skipped: { bg: '#F8FAFC', text: '#94A3B8', label: 'Skipped' },
};

function Block({ label, children }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  );
}

export default function MissionItem({ mission, experiment, path, contacts, proofs, onChanged, onComplete }) {
  const [open, setOpen] = useState(mission.status !== 'completed');
  const s = STATUS[mission.status] || STATUS.planned;
  const done = mission.status === 'completed';
  const steps = mission.steps || [];
  const evidenceRequirement = mission.proof_required || experiment?.proof_required;

  return (
    <article className="rounded-[14px] bg-white p-4" style={{ border: '1px solid var(--border-light)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: s.bg, color: s.text }}>{s.label}</span>
            {mission.outreach_required && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>
                Outreach required
              </span>
            )}
          </div>
          <h4 className="font-heading mt-1.5 text-base font-bold" style={{ color: 'var(--text-primary)' }}>{mission.title}</h4>
        </div>
        <button onClick={() => setOpen(v => !v)} aria-label={open ? 'Collapse mission' : 'Expand mission'}
          className="rounded-[8px] border p-1.5" style={{ borderColor: 'var(--border-light)' }}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {open && (
        <>
          {(mission.objective || mission.description) && (
            <Block label="Purpose">{mission.objective || mission.description}</Block>
          )}
          {mission.required_action && <Block label="Required action">{mission.required_action}</Block>}
          {steps.length > 0 && (
            <Block label="Suggested steps">
              <ol className="space-y-1">
                {steps.map((st, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-bold" style={{ color: 'var(--brand-navy-900)' }}>{i + 1}.</span>
                    <span>{typeof st === 'string' ? st : st.step || st.description}</span>
                  </li>
                ))}
              </ol>
            </Block>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {mission.estimated_hours ? `~${mission.estimated_hours}h` : 'Effort not set'}
            </span>
            {mission.deadline && <span>Due {new Date(mission.deadline).toLocaleDateString()}</span>}
          </div>
          {evidenceRequirement && <Block label="Evidence requirement">{evidenceRequirement}</Block>}

          {proofs.length > 0 && (
            <div className="mt-3 space-y-1">
              {proofs.map(p => (
                <p key={p.id} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#15803D' }}>
                  <FileText size={12} /> {p.title}
                </p>
              ))}
            </div>
          )}

          {mission.outreach_required && (
            <MissionOutreachPanel
              mission={mission}
              experiment={experiment}
              path={path}
              contacts={contacts}
              onChanged={onChanged}
            />
          )}

          {!done && (
            <button
              type="button"
              onClick={() => onComplete(mission)}
              className="ui-press mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-bold text-white sm:w-auto"
              style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}
            >
              <CheckCircle2 size={15} /> Mark complete with evidence
            </button>
          )}
        </>
      )}
    </article>
  );
}