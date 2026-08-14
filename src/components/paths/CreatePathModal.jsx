import { useState, useRef } from 'react';
import { X, Loader2, ArrowRight, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText, toEnum, LEVELS } from '@/lib/ai-validation';
import { reportAiFailure } from '@/lib/ai-failures';

const inputCls = 'w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-900)]';

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

Generate a structured path profile for them to save and test. Be realistic and honest.
${PLAIN_PROSE_RULES}`,
        response_json_schema: {
          type: 'object',
          properties: {
            path_name: { type: 'string' },
            path_category: { type: 'string' },
            description: { type: 'string' },
            why_it_fits: { type: 'string' },
            why_it_may_not_fit: { type: 'string' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
            lifestyle_implications: { type: 'string' },
            first_experiment: { type: 'string' },
            skill_gaps: { type: 'array', items: { type: 'string' } },
          }
        }
      }));
      // The student reviews and edits every one of these before anything is
      // saved, so the text fields only need to be strings rather than correct.
      // risk_level is the exception: it feeds a <select> and then an enum field
      // on the entity, so an off-list value renders as nothing selected and
      // then fails the save with no explanation.
      const riskLevel = toEnum(result.risk_level, LEVELS, 'medium');
      if (!toEnum(result.risk_level, LEVELS)) {
        // Defaulted rather than failed, since the student edits it on the next
        // screen. Still recorded: it is the model ignoring an enum.
        reportAiFailure('create_path', { stage: 'validate', codes: ['risk_level_not_enum'], recovered: true, model: 'gemini_3_flash' });
      }

      setForm(f => ({
        ...f,
        path_name: toText(result.path_name),
        path_category: toText(result.path_category),
        description: toText(result.description),
        why_it_fits: toText(result.why_it_fits),
        why_it_may_not_fit: toText(result.why_it_may_not_fit),
        risk_level: riskLevel,
        lifestyle_implications: toText(result.lifestyle_implications),
      }));
      setStep(2);
    } catch (err) {
      reportAiFailure('create_path', { stage: 'invoke_llm', codes: ['unexpected_error'], model: 'gemini_3_flash' });
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
      reportAiFailure('create_path', { stage: 'save_path', codes: ['unexpected_error'] });
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
        <div className="w-full max-w-lg rounded-[var(--r-surface)] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="tp-section text-[color:var(--surface-dark-900)]">Create Another Path</h2>
            <button onClick={onClose}><X size={20} className="text-[color:var(--ink-500)]" /></button>
          </div>
          <p className="tp-lead text-[color:var(--ink-500)] mb-6">How would you like to add this path?</p>
          <div className="space-y-3">
            {[
              { id: 'survey', label: 'Short path-specific survey', desc: 'Answer 4 questions, AI generates the path profile' },
              { id: 'manual', label: 'Create a custom path manually', desc: 'Fill in all the details yourself' },
              ...(unactivatedRecs.length > 0 ? [{ id: 'from_rec', label: 'Activate a prior recommendation', desc: `${unactivatedRecs.length} recommendation${unactivatedRecs.length > 1 ? 's' : ''} not yet activated` }] : []),
            ].map(opt => (
              <button key={opt.id} onClick={() => { setMode(opt.id); setStep(1); }}
                className="w-full flex items-center justify-between rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-4 text-left transition hover:border-[color:var(--brand-navy-900)] hover:bg-[color:var(--ink-100)] group">
                <div>
                  <p className="tp-body font-bold text-[color:var(--surface-dark-900)] group-hover:text-[color:var(--brand-navy-900)]">{opt.label}</p>
                  <p className="tp-meta text-[color:var(--ink-500)] mt-1">{opt.desc}</p>
                </div>
                <ChevronRight size={16} className="text-[color:var(--ink-400)] group-hover:text-[color:var(--brand-navy-900)]" />
              </button>
            ))}
          </div>
          <button onClick={onClose} className="mt-4 w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-2.5 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">Cancel</button>
        </div>
      </div>
    );
  }

  if (mode === 'from_rec') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[var(--r-surface)] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="tp-section text-[color:var(--surface-dark-900)]">Prior Recommendations</h2>
            <button onClick={onClose}><X size={20} className="text-[color:var(--ink-500)]" /></button>
          </div>
          <p className="tp-lead text-[color:var(--ink-500)] mb-5">Select a recommendation to activate as a new active path.</p>
          {error && <div className="tp-body mb-3 p-3 rounded-[var(--r-control)] bg-red-50 text-red-700">{error}</div>}
          <div className="space-y-3">
            {unactivatedRecs.map(rec => (
              <button key={rec.id} onClick={() => handleSelectRec(rec)} disabled={saving}
                className="w-full rounded-[var(--r-surface)] border border-[color:var(--ink-200)] p-4 text-left transition hover:border-[color:var(--brand-navy-900)] hover:bg-[color:var(--ink-100)] disabled:opacity-60">
                <p className="tp-body font-bold text-[color:var(--surface-dark-900)]">{rec.path_name}</p>
                <p className="tp-meta text-[color:var(--ink-500)] mt-1 line-clamp-2">{rec.fit_reason}</p>
                <span className="tp-meta mt-2 inline-block rounded-full px-2.5 py-1 font-bold" style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>{rec.status}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setMode(null)} className="mt-4 text-sm text-[color:var(--ink-500)] hover:text-[color:var(--ink-700)]">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[var(--r-surface)] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="tp-section text-[color:var(--surface-dark-900)]">
            {mode === 'survey' && step === 1 ? 'Quick Path Survey' : 'Path Details'}
          </h2>
          <button onClick={onClose}><X size={20} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <p className="tp-lead text-[color:var(--ink-500)] mb-5">
          {mode === 'survey' && step === 1
            ? 'Answer 4 quick questions and AI will generate your path profile.'
            : 'Review and edit the path details before saving.'}
        </p>

        {error && <div className="tp-body mb-4 p-3 rounded-[var(--r-control)] bg-red-50 border border-red-100 text-red-700">{error}</div>}

        {mode === 'survey' && step === 1 ? (
          <div className="space-y-4">
            {[
              { name: 'what_draws_you', label: 'What draws you to this path?', placeholder: 'What specifically interests, excites, or fascinates you about it?' },
              { name: 'day_to_day_hope', label: 'What day-to-day reality do you hope for?', placeholder: 'Work environment, tasks, pace, autonomy, team size...' },
              { name: 'relevant_skills', label: 'What relevant skills or experience do you have?', placeholder: 'Coursework, projects, internships, side work...' },
              { name: 'concerns', label: 'What concerns you about this path?', placeholder: 'Honestly, what worries you or makes you hesitant?' },
            ].map(q => (
              <div key={q.name}>
                <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">{q.label}</label>
                <textarea rows={2} name={q.name} value={survey[q.name]} onChange={chSurvey} placeholder={q.placeholder}
                  className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none placeholder-[color:var(--ink-400)]" />
              </div>
            ))}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setMode(null)} className="flex-1 rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)]">Back</button>
              <button onClick={handleGenerateFromSurvey} disabled={generating}
                className="flex-1 rounded-[var(--r-control)] py-3 text-sm font-semibold text-white disabled:opacity-60"
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
                <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">{f.label}</label>
                {f.rows ? (
                  <textarea rows={f.rows} name={f.name} value={form[f.name]} onChange={ch} placeholder={f.placeholder}
                    className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)] resize-none placeholder-[color:var(--ink-400)]" />
                ) : (
                  <input name={f.name} value={form[f.name]} onChange={ch} placeholder={f.placeholder} className={inputCls} />
                )}
              </div>
            ))}

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Risk level</label>
                <select name="risk_level" value={form.risk_level} onChange={ch} className={inputCls}>
                  {RISK_LEVELS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Confidence</label>
                <select name="confidence_level" value={form.confidence_level} onChange={ch} className={inputCls}>
                  {CONFIDENCE_LEVELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">Weekly hours</label>
                <input type="number" name="weekly_hours" value={form.weekly_hours} onChange={ch} min={1} max={80} className={inputCls} />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => mode === 'survey' ? setStep(1) : setMode(null)}
                className="flex-1 rounded-[var(--r-control)] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)]">Back</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-[var(--r-control)] py-3 text-sm font-semibold text-white disabled:opacity-60"
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