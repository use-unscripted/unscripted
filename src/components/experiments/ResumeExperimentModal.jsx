import { useState } from 'react';
import { X, Play, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function fmtDate(d) {
  if (!d) return 'Not set';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ResumeExperimentModal({ exp, missions = [], onClose, onResumed }) {
  const [choice, setChoice] = useState('continue'); // 'continue' | 'update'
  const [newDeadline, setNewDeadline] = useState(exp.deadline || '');
  const [newHours, setNewHours] = useState(exp.estimated_hours || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const completedMissions = missions.filter(m => m.status === 'completed');
  const remainingMissions = missions.filter(m => m.status !== 'completed');

  const handleResume = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const historyEntry = {
      from_status: 'paused',
      to_status: 'in_progress',
      changed_at: now,
      reason: notes || null,
    };
    const updates = {
      status: 'in_progress',
      resumed_at: now,
      status_history: [...(exp.status_history || []), historyEntry],
    };
    if (choice === 'update') {
      if (newDeadline) updates.deadline = newDeadline;
      if (newHours) updates.estimated_hours = Number(newHours);
    }
    await base44.entities.Experiments.update(exp.id, updates);
    setSaving(false);
    onResumed({ ...exp, ...updates });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Play size={18} style={{ color: 'var(--success-700)' }} />
            <h3 className="tp-section text-[color:var(--surface-dark-900)]">Resume this experiment?</h3>
          </div>
          <button onClick={onClose}><X size={18} className="text-[color:var(--ink-400)]" /></button>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-4 mb-4 space-y-2">
          <p className="tp-card text-[color:var(--surface-dark-900)]">{exp.title}</p>
          {exp.path_name && <p className="tp-meta text-[color:var(--ink-500)]">Path: <span className="font-medium text-[color:var(--ink-700)]">{exp.path_name}</span></p>}
          {exp.paused_at && <p className="tp-meta text-[color:var(--ink-500)] flex items-center gap-1"><Clock size={11} /> Paused: {fmtDate(exp.paused_at)}</p>}
          {exp.deadline && <p className="tp-meta text-[color:var(--ink-500)] flex items-center gap-1"><Calendar size={11} /> Original deadline: {fmtDate(exp.deadline)}</p>}
          {exp.pause_reason && <p className="tp-meta text-[color:var(--ink-400)] italic">Pause reason: {exp.pause_reason}</p>}
        </div>

        {/* Progress summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-[color:var(--ink-200)] p-3 text-center">
            <p className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">{completedMissions.length}</p>
            <p className="tp-meta text-[color:var(--ink-500)]">Missions completed</p>
          </div>
          <div className="rounded-xl border border-[color:var(--ink-200)] p-3 text-center">
            <p className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">{remainingMissions.length}</p>
            <p className="tp-meta text-[color:var(--ink-500)]">Missions remaining</p>
          </div>
        </div>

        {/* Options */}
        <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">How would you like to continue?</p>
        <div className="space-y-2 mb-4">
          {[
            { value: 'continue', label: 'Continue existing plan', desc: 'Keep the same deadline and weekly commitment.' },
            { value: 'update', label: 'Update the plan', desc: 'Revise deadline or weekly hours.' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setChoice(opt.value)}
              className="w-full rounded-xl border p-3 text-left transition"
              style={choice === opt.value ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)' } : { borderColor: 'var(--ink-200)', background: 'white' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: choice === opt.value ? 'var(--brand-navy-900)' : 'var(--ink-300)' }}>
                  {choice === opt.value && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-navy-900)' }} />}
                </div>
                <span className="tp-body font-semibold text-[color:var(--surface-dark-900)]">{opt.label}</span>
              </div>
              <p className="tp-meta text-[color:var(--ink-500)] mt-0.5 ml-6">{opt.desc}</p>
            </button>
          ))}
        </div>

        {choice === 'update' && (
          <div className="space-y-3 mb-4 rounded-xl border border-[color:var(--ink-200)] p-4">
            <label className="block">
              <span className="tp-body font-semibold text-[color:var(--ink-700)] block mb-1">Revised deadline</span>
              <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
            </label>
            <label className="block">
              <span className="tp-body font-semibold text-[color:var(--ink-700)] block mb-1">Updated weekly hours</span>
              <input type="number" value={newHours} onChange={e => setNewHours(e.target.value)} min={1} max={40}
                className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
            </label>
          </div>
        )}

        <label className="block mb-5">
          <span className="tp-body font-semibold text-[color:var(--ink-700)] block mb-1">
            Anything changed since you paused? <span className="font-normal text-[color:var(--ink-400)]">(optional)</span>
          </span>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="New skills, updated goals, different availability..."
            className="w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none"
          />
        </label>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="tp-body flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">
            Cancel
          </button>
          <button onClick={handleResume} disabled={saving}
            className="tp-body flex-1 rounded-[10px] py-2.5 font-semibold text-white transition disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)' }}>
            {saving ? 'Resuming…' : 'Resume Experiment'}
          </button>
        </div>
      </div>
    </div>
  );
}