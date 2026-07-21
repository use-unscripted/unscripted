import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, CheckCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const QUESTIONS = [
  { name: 'completed_items', label: 'What did you complete this week?', placeholder: 'List the experiments, conversations, or outputs you finished' },
  { name: 'avoided_items', label: 'What did you avoid or not finish?', placeholder: 'Be honest — what stayed on the list?' },
  { name: 'energy_sources', label: 'What gave you energy this week?', placeholder: 'Work, conversations, or activities that felt engaging' },
  { name: 'energy_drains', label: 'What drained you?', placeholder: 'Tasks, situations, or environments that felt difficult or draining' },
  { name: 'path_feedback', label: 'Did the path match your expectations this week?', placeholder: 'Based on what you actually did and felt — not what you expected to feel' },
  { name: 'surprises', label: 'What surprised you?', placeholder: 'Unexpected reactions, results, or realizations' },
  { name: 'lessons', label: 'What did you actually learn?', placeholder: 'Be specific — a lesson is not just completing something' },
  { name: 'next_changes', label: 'What should change next week?', placeholder: 'What will you do differently, stop doing, or try for the first time?' },
];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

export default function WeeklyReflectionPage() {
  const [reflections, setReflections] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [current, setCurrent] = useState({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState('form'); // 'form' | 'history'

  const weekStart = getMonday(new Date());

  useEffect(() => {
    Promise.all([
      base44.entities.WeeklyReflections.list('-created_date', 20).catch(() => []),
      base44.entities.Experiments.list('-created_date', 200).catch(() => []),
    ]).then(([data, exps]) => {
      setReflections(Array.isArray(data) ? data : []);
      setExperiments(Array.isArray(exps) ? exps : []);
      const thisWeek = data.find(r => r.week_start === weekStart);
      if (thisWeek) setCurrent(thisWeek);
      else setCurrent({ week_start: weekStart });
    });
  }, []);

  const ch = e => setCurrent(c => ({ ...c, [e.target.name]: e.target.value }));

  const save = async () => {
    const hasContent = QUESTIONS.some(q => (current[q.name] || '').trim());
    if (!hasContent) return;
    if (saving) return;
    setSaving(true);
    try {
      if (current.id) await base44.entities.WeeklyReflections.update(current.id, current);
      else {
        const created = await base44.entities.WeeklyReflections.create(current);
        setCurrent(created);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Unscripted. Based on this student's weekly reflection, generate: 1) A direct weekly learning summary, 2) Path-fit adjustments (which paths feel stronger/weaker and why), 3) Workload adjustments, 4) Specific recommendations for next week. Be honest but constructive. Never shame. Reflection: ${JSON.stringify(current)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            path_adjustments: { type: 'array', items: { type: 'string' } },
          }
        }
      });
      const updated = { ...current, generated_summary: result.summary, path_adjustments: result.path_adjustments };
      if (current.id) await base44.entities.WeeklyReflections.update(current.id, updated);
      else {
        const created = await base44.entities.WeeklyReflections.create(updated);
        setCurrent(created);
      }
      setCurrent(c => ({ ...c, ...updated }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Weekly reflection"
        title="Learn from what you actually did."
        description="A weekly reflection helps you adjust direction based on real experience, not guesswork."
        action={
          <div className="flex gap-2">
            <button onClick={() => setView('form')} className="rounded-[10px] px-4 py-2.5 text-sm font-semibold transition"
              style={view === 'form' ? { background: '#8B0C21', color: '#fff' } : { background: '#F1F5F9', color: '#334155' }}>This Week</button>
            <button onClick={() => setView('history')} className="rounded-[10px] px-4 py-2.5 text-sm font-semibold transition"
              style={view === 'history' ? { background: '#8B0C21', color: '#fff' } : { background: '#F1F5F9', color: '#334155' }}>History</button>
          </div>
        }
      />

      {view === 'form' ? (
        <div>
          <div className="mb-6 rounded-[16px] p-4" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#8B0C21' }}>Week of {new Date(weekStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
            <p className="text-sm text-[#334155]">Answer honestly. These reflections adjust your roadmap over time. There are no correct answers.</p>
          </div>

          {/* Experiment selector */}
          {experiments.length > 0 && (
            <div className="mb-5 rounded-[20px] border border-[#E2E8F0] bg-white p-5">
              <span className="text-sm font-semibold text-[#050816] block mb-2">Which experiment are you reflecting on? <span className="text-xs font-normal text-[#94A3B8]">(optional)</span></span>
              <select
                value={current.experiment_id || ''}
                onChange={e => setCurrent(c => ({ ...c, experiment_id: e.target.value || undefined }))}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#8B0C21]">
                <option value="">No specific experiment — general reflection</option>
                {experiments.map(exp => (
                  <option key={exp.id} value={exp.id}>{exp.title}{exp.path_name ? ` — ${exp.path_name}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-5">
            {QUESTIONS.map(q => (
              <label key={q.name} className="block rounded-[20px] border border-[#E2E8F0] bg-white p-5">
                <span className="text-sm font-semibold text-[#050816] block mb-3">{q.label}</span>
                <textarea rows={3} name={q.name} value={current[q.name] || ''} onChange={ch} placeholder={q.placeholder}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#8B0C21] resize-none" />
              </label>
            ))}

            {/* Path decision */}
            <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
              <span className="text-sm font-semibold text-[#050816] block mb-3">Continue, modify, or stop testing this path?</span>
              <div className="flex gap-2 flex-wrap mb-3">
                {[
                  { val: 'continue', label: 'Continue testing', bg: '#F0FDF4', color: '#15803D' },
                  { val: 'modify', label: 'Modify approach', bg: '#FFFBEB', color: '#B45309' },
                  { val: 'stop', label: 'Stop — not a fit', bg: '#FEF2F2', color: '#B91C1C' },
                ].map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => setCurrent(c => ({ ...c, path_decision: opt.val }))}
                    className="rounded-full px-4 py-2 text-sm font-semibold transition border"
                    style={current.path_decision === opt.val
                      ? { background: opt.bg, color: opt.color, borderColor: opt.color }
                      : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {current.path_decision === 'modify' && (
                <textarea rows={2} name="path_modification_note"
                  value={current.path_modification_note || ''} onChange={ch}
                  placeholder="What specifically would you change about how you are testing this path?"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#8B0C21] resize-none" />
              )}
              {current.path_decision === 'stop' && (
                <textarea rows={2} name="path_stop_reason"
                  value={current.path_stop_reason || ''} onChange={ch}
                  placeholder="What did you learn that made this path a poor fit?"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#8B0C21] resize-none" />
              )}
            </div>
          </div>

          {current.generated_summary && (
            <div className="mt-6 rounded-[20px] p-6" style={{ background: '#081225', border: '1px solid rgba(139,12,33,0.3)' }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#8B0C21' }}>Unscripted's analysis</p>
              <p className="text-sm text-slate-300 leading-6">{current.generated_summary}</p>
              {current.path_adjustments?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Path adjustments</p>
                  <ul className="space-y-2">{current.path_adjustments.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-300">
                      <ArrowRight size={14} className="shrink-0 mt-0.5" style={{ color: '#8B0C21' }} />{a}
                    </li>
                  ))}</ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={save} disabled={saving}
              className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
              style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
              {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Reflection'}
            </button>
            <button onClick={generate} disabled={generating}
              className="flex-1 rounded-[10px] border py-3 text-sm font-semibold transition disabled:opacity-60"
              style={{ borderColor: '#8B0C21', color: '#8B0C21', background: 'white' }}>
              {generating ? 'Generating...' : 'Generate Insights'} <ArrowRight size={14} className="inline ml-1" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {reflections.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-12 text-center text-[#64748B]">
              No past reflections yet. Complete your first weekly reflection above.
            </div>
          ) : reflections.map(r => {
            const linkedExp = r.experiment_id ? experiments.find(e => e.id === r.experiment_id) : null;
            return (
              <div key={r.id} className="rounded-[20px] border border-[#E2E8F0] bg-white p-5 cursor-pointer hover:shadow-sm transition"
                onClick={() => { setCurrent(r); setView('form'); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-heading font-bold text-[#050816]">Week of {new Date(r.week_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                    {linkedExp && (
                      <p className="mt-0.5 text-xs font-semibold" style={{ color: '#8B0C21' }}>{linkedExp.title}{linkedExp.path_name ? ` — ${linkedExp.path_name}` : ''}</p>
                    )}
                    {r.generated_summary && <p className="mt-1 text-sm text-[#64748B] line-clamp-2">{r.generated_summary}</p>}
                  </div>
                  {r.generated_summary && <CheckCircle size={20} className="shrink-0" style={{ color: '#15803D' }} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}