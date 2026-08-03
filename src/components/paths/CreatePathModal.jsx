import { useState, useRef } from 'react';
import { X, Loader2, ArrowRight, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM } from '@/lib/llm';

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#1F3A5F]';

const RISK_LEVELS = ['low', 'medium', 'high'];
const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

export default function CreatePathModal({ existingRecommendations = [], onClose, onCreated }) {
  const submittingRef = useRef(false);
  const [mode, setMode] = useState(null); // null | 'survey' | 'manual' | 'from_rec'
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedRec, setSelectedRec] = useState(null);

  // Survey form (short path survey)
  const [survey, setSurvey] = useState({ what_draws_you: '', day_to_day_hope: '', relevant_skills: '', concerns: '' });
  const chSurvey = e => setSurvey(f => ({ ...f, [e.target.name]: e.target.value }));

  // Manual / final form
  const [form, setForm] = useState({
    path_name: '', path_category: '', description: '', why_it_fits: '',
    why_it_may_not_fit: '', risk_level: 'medium', confidence_level: 'medium',
    lifestyle_implications: '', weekly_hours: 10, notes: '', goals: '',
  });
  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  const unactivatedRecs = existingRecommendations.filter(r =>
    !['active', 'completed'].includes(r.status) && r.id !== selectedRec?.id
  );

  const handleGenerateFromSurvey = async () => {
    if (!survey.what_draws_you.trim()) { setError('Please answer at least the first question.'); return; }
    setError('');
    setGenerating(true);
    try {
      // Fills in one path profile from a four-question survey; the student edits
      // every field on the next step. Cheap tier; see src/lib/llm.js.
      const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        prompt: `You are Unscripted, a career guidance platform. A college student wants to explore a new career path. Based on their short survey:
- What draws them to this path: ${survey.what_draws_you}
- What day-to-day they hope for: ${survey.day_to_day_hope}
- Relevant skills/experience: ${survey.relevant_skills}
- Concerns: ${survey.concerns}

Generate a structured path profile for them to save and test. Be realistic and honest.`,
        response_json_schema: {
          type: 'object',
          properties: {
            path_name: { type: 'string' },
            path_category: { type: 'string' },
            description: { type: 'string' },
            why_it_fits: { type: 'string' },
            why_it_may_not_fit: { type: 'string' },
            risk_level: { type: 'string' },
            lifestyle_implications: { type: 'string' },
            first_experiment: { type: 'string' },
            skill_gaps: { type: 'array', items: { type: 'string' } },
          }
        }
      }));
      setForm(f => ({
        ...f,
        path_name: result.path_name || '',
        path_category: result.path_category || '',
        description: result.description || '',
        why_it_fits: result.why_it_fits || '',
        why_it_may_not_fit: result.why_it_may_not_fit || '',
        risk_level: result.risk_level || 'medium',
        lifestyle_implications: result.lifestyle_implications || '',
      }));
      setStep(2);
    } catch (err) {
      setError('Generation failed. Fill in the details manually below.');
      setStep(2);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (submittingRef.current) return;
    if (!form.path_name.trim()) { setError('Path name is required.'); return; }
    submittingRef.current = true;
    setSaving(true);
    setError('');

    try {
      const user = await base44.auth.me();
      const today = new Date().toISOString().split('T')[0];

      let saved;
      if (mode === 'from_rec' && selectedRec) {
        // Activate the existing recommendation
        await base44.entities.PathRecommendations.update(selectedRec.id, {
          status: 'active',
          started_at: today,
          last_active_at: today,
        });
        saved = { ...selectedRec, status: 'active', started_at: today };
      } else {
        saved = await base44.entities.PathRecommendations.create({
          user_id: user.id,
          status: 'active',
          is_primary_focus: false,
          started_at: today,
          last_active_at: today,
          fit_reason: form.why_it_fits || `User-created path: ${form.path_name}`,
          ...form,
        });
      }
      onCreated(saved);
    } catch (err) {
      setError('Failed to save path. Please try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const handleSelectRec = async (rec) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await base44.entities.PathRecommendations.update(rec.id, { status: 'active', started_at: today, last_active_at: today });
      onCreated({ ...rec, status: 'active' });
    } catch {
      setError('Failed to activate. Try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  if (!mode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
        <div className="w-full max-w-lg rounded-[24px] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading text-xl font-bold text-[#050816]">Create Another Path</h2>
            <button onClick={onClose}><X size={20} className="text-[#64748B]" /></button>
          </div>
          <p className="text-sm text-[#64748B] mb-6">How would you like to add this path?</p>
          <div className="space-y-3">
            {[
              { id: 'survey', label: 'Short path-specific survey', desc: 'Answer 4 questions, AI generates the path profile' },
              { id: 'manual', label: 'Create a custom path manually', desc: 'Fill in all the details yourself' },
              ...(unactivatedRecs.length > 0 ? [{ id: 'from_rec', label: 'Activate a prior recommendation', desc: `${unactivatedRecs.length} recommendation${unactivatedRecs.length > 1 ? 's' : ''} not yet activated` }] : []),
            ].map(opt => (
              <button key={opt.id} onClick={() => { setMode(opt.id); setStep(1); }}
                className="w-full flex items-center justify-between rounded-[16px] border border-[#E2E8F0] bg-white p-4 text-left transition hover:border-[#1F3A5F] hover:bg-[#EEF2F6] group">
                <div>
                  <p className="text-sm font-bold text-[#050816] group-hover:text-[#1F3A5F]">{opt.label}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{opt.desc}</p>
                </div>
                <ChevronRight size={16} className="text-[#94A3B8] group-hover:text-[#1F3A5F]" />
              </button>
            ))}
          </div>
          <button onClick={onClose} className="mt-4 w-full rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</button>
        </div>
      </div>
    );
  }

  if (mode === 'from_rec') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-heading text-xl font-bold text-[#050816]">Prior Recommendations</h2>
            <button onClick={onClose}><X size={20} className="text-[#64748B]" /></button>
          </div>
          <p className="text-sm text-[#64748B] mb-5">Select a recommendation to activate as a new active path.</p>
          {error && <div className="mb-3 p-3 rounded-xl bg-red-50 text-sm text-red-700">{error}</div>}
          <div className="space-y-3">
            {unactivatedRecs.map(rec => (
              <button key={rec.id} onClick={() => handleSelectRec(rec)} disabled={saving}
                className="w-full rounded-[16px] border border-[#E2E8F0] p-4 text-left transition hover:border-[#1F3A5F] hover:bg-[#EEF2F6] disabled:opacity-60">
                <p className="text-sm font-bold text-[#050816]">{rec.path_name}</p>
                <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{rec.fit_reason}</p>
                <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#F1F5F9', color: '#64748B' }}>{rec.status}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setMode(null)} className="mt-4 text-sm text-[#64748B] hover:text-[#334155]">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#050816]">
            {mode === 'survey' && step === 1 ? 'Quick Path Survey' : 'Path Details'}
          </h2>
          <button onClick={onClose}><X size={20} className="text-[#64748B]" /></button>
        </div>
        <p className="text-sm text-[#64748B] mb-5">
          {mode === 'survey' && step === 1
            ? 'Answer 4 quick questions and AI will generate your path profile.'
            : 'Review and edit the path details before saving.'}
        </p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}

        {mode === 'survey' && step === 1 ? (
          <div className="space-y-4">
            {[
              { name: 'what_draws_you', label: 'What draws you to this path?', placeholder: 'What specifically interests, excites, or fascinates you about it?' },
              { name: 'day_to_day_hope', label: 'What day-to-day reality do you hope for?', placeholder: 'Work environment, tasks, pace, autonomy, team size...' },
              { name: 'relevant_skills', label: 'What relevant skills or experience do you have?', placeholder: 'Coursework, projects, internships, side work...' },
              { name: 'concerns', label: 'What concerns you about this path?', placeholder: 'Honestly — what worries you or makes you hesitant?' },
            ].map(q => (
              <div key={q.name}>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">{q.label}</label>
                <textarea rows={2} name={q.name} value={survey[q.name]} onChange={chSurvey} placeholder={q.placeholder}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F] resize-none placeholder-[#94A3B8]" />
              </div>
            ))}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setMode(null)} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155]">Back</button>
              <button onClick={handleGenerateFromSurvey} disabled={generating}
                className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--brand-navy-900)' }}>
                {generating ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Generating…</span>
                  : <span className="flex items-center justify-center gap-2">Generate Path Profile <ArrowRight size={14} /></span>}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { name: 'path_name', label: 'Path name *', placeholder: 'e.g. Investment Banking, Product Management, Creator Economy...' },
              { name: 'path_category', label: 'Category', placeholder: 'e.g. Finance, Tech, Media, Consulting...' },
              { name: 'description', label: 'Description', placeholder: 'Brief description of this career path', rows: 2 },
              { name: 'why_it_fits', label: 'Why it fits you', placeholder: 'What makes this a good match for your strengths and goals?', rows: 2 },
              { name: 'why_it_may_not_fit', label: 'Why it may not fit', placeholder: 'Honest concerns or potential mismatches', rows: 2 },
              { name: 'lifestyle_implications', label: 'Lifestyle implications', placeholder: 'Work hours, location, income trajectory, autonomy...', rows: 2 },
              { name: 'goals', label: 'Your goals for this path', placeholder: 'What do you want to learn or prove in the next 30 days?', rows: 2 },
              { name: 'notes', label: 'Notes', placeholder: 'Anything else worth tracking', rows: 2 },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">{f.label}</label>
                {f.rows ? (
                  <textarea rows={f.rows} name={f.name} value={form[f.name]} onChange={ch} placeholder={f.placeholder}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F] resize-none placeholder-[#94A3B8]" />
                ) : (
                  <input name={f.name} value={form[f.name]} onChange={ch} placeholder={f.placeholder} className={inputCls} />
                )}
              </div>
            ))}

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Risk level</label>
                <select name="risk_level" value={form.risk_level} onChange={ch} className={inputCls}>
                  {RISK_LEVELS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Confidence</label>
                <select name="confidence_level" value={form.confidence_level} onChange={ch} className={inputCls}>
                  {CONFIDENCE_LEVELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Weekly hours</label>
                <input type="number" name="weekly_hours" value={form.weekly_hours} onChange={ch} min={1} max={80} className={inputCls} />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => mode === 'survey' ? setStep(1) : setMode(null)}
                className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155]">Back</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--brand-navy-900)' }}>
                {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving…</span> : 'Save Path'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}