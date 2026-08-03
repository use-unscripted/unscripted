import { useState, useRef } from 'react';
import { X, Loader2, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM } from '@/lib/llm';

const inputCls = 'w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-sm text-[color:var(--surface-dark-900)] placeholder-[color:var(--ink-400)] outline-none focus:border-[color:var(--brand-navy-900)] resize-none';

const SURVEY_QUESTIONS = [
  { name: 'since_last_exploration', label: 'What have you done since you last explored this path?', placeholder: 'Classes, projects, conversations, internships, etc.' },
  { name: 'goals_changed', label: 'Have your goals changed?', placeholder: 'What do you want differently now versus before?' },
  { name: 'weekly_hours_changed', label: 'Has your available weekly time changed?', placeholder: 'How many hours per week can you realistically commit?' },
  { name: 'new_skills', label: 'Have you developed any new skills?', placeholder: 'Technical skills, soft skills, tools, frameworks...' },
  { name: 'relevant_experience', label: 'Have you completed relevant classes, projects, internships, or conversations?', placeholder: 'Describe what is most relevant to this path.' },
  { name: 'what_interests_now', label: 'What now interests you most about this path?', placeholder: 'Be specific — what draws you back?' },
  { name: 'concerns_about_restarting', label: 'What concerns you about restarting it?', placeholder: 'Honest concerns — time, skill gaps, competition...' },
];

export default function ReactivationModal({ path, onClose, onReactivated }) {
  const submittingRef = useRef(false);
  const [form, setForm] = useState({
    since_last_exploration: '',
    goals_changed: '',
    weekly_hours_changed: '',
    new_skills: '',
    relevant_experience: '',
    what_interests_now: '',
    concerns_about_restarting: '',
    continue_old_or_new: 'continue_old',
  });
  const [step, setStep] = useState('survey'); // 'survey' | 'plan' | 'primary'
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState('');
  const [makePrimary, setMakePrimary] = useState(false);
  const [error, setError] = useState('');

  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmitSurvey = async () => {
    if (!form.what_interests_now.trim()) { setError('Please answer at least the question about what interests you now.'); return; }
    setError('');
    setGenerating(true);

    try {
      // Summarises the student's own reactivation answers back to them as a
      // plan. Stays in the app. Cheap tier; see src/lib/llm.js.
      const result = unwrapLLM(await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        prompt: `You are Unscripted, a career guidance platform for college students. A student is reactivating the path: "${path.path_name}". 

Their reactivation survey answers:
- Since last exploring: ${form.since_last_exploration}
- Goals changed: ${form.goals_changed}
- Weekly time: ${form.weekly_hours_changed}
- New skills: ${form.new_skills}
- Relevant experience: ${form.relevant_experience}
- Current interest: ${form.what_interests_now}
- Concerns: ${form.concerns_about_restarting}
- Experiment preference: ${form.continue_old_or_new === 'continue_old' ? 'Continue old experiments' : 'Start fresh experiments'}

Generate:
1. A concise summary of where they are now vs before (2-3 sentences)
2. An updated 30-day reactivation plan (4-6 specific action items tailored to their answers)
3. What to continue vs revise vs retire from their previous work

Be concrete, practical, and encouraging without being vague.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            thirty_day_plan: { type: 'array', items: { type: 'string' } },
            continue_items: { type: 'array', items: { type: 'string' } },
            revise_items: { type: 'array', items: { type: 'string' } },
            retire_items: { type: 'array', items: { type: 'string' } },
          }
        }
      }));

      const planText = [
        result.summary,
        '',
        '30-Day Plan:',
        ...(result.thirty_day_plan || []).map((item, i) => `${i + 1}. ${item}`),
        '',
        result.continue_items?.length ? `Continue: ${result.continue_items.join(', ')}` : '',
        result.revise_items?.length ? `Revise: ${result.revise_items.join(', ')}` : '',
        result.retire_items?.length ? `Retire: ${result.retire_items.join(', ')}` : '',
      ].filter(Boolean).join('\n');

      setGeneratedPlan(planText);
      setStep('primary');
    } catch (err) {
      setError('Failed to generate plan. You can still reactivate manually.');
      setStep('primary');
    } finally {
      setGenerating(false);
    }
  };

  const handleFinish = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError('');

    try {
      const user = await base44.auth.me();
      const today = new Date().toISOString().split('T')[0];

      // Save reactivation record
      await base44.entities.PathReactivations.create({
        user_id: user.id,
        path_id: path.id,
        path_name: path.path_name,
        reactivated_at: today,
        ...form,
        updated_plan: generatedPlan,
        generated_summary: generatedPlan,
      });

      // If making primary, unset all other primary flags first
      if (makePrimary) {
        const allPaths = await base44.entities.PathRecommendations.list('-created_date', 100);
        const primaries = allPaths.filter(p => p.is_primary_focus && p.id !== path.id);
        await Promise.all(primaries.map(p => base44.entities.PathRecommendations.update(p.id, { is_primary_focus: false })));
      }

      // Update path to active
      await base44.entities.PathRecommendations.update(path.id, {
        status: 'active',
        last_active_at: today,
        paused_at: undefined,
        is_primary_focus: makePrimary,
      });

      onReactivated({ makePrimary, plan: generatedPlan });
    } catch (err) {
      setError('Failed to reactivate path. Please try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">
            {step === 'survey' ? 'Reactivation Survey' : 'Updated Plan'}
          </h2>
          <button onClick={onClose} disabled={saving} aria-label="Close"><X size={20} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <p className="text-sm text-[color:var(--ink-500)] mb-1">
          {step === 'survey'
            ? `You're returning to: ${path.path_name}. Answer these questions to get an updated plan.`
            : 'Here\'s your updated plan based on where you are now.'}
        </p>

        {error && (
          <div className="mb-4 mt-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
        )}

        {step === 'survey' && (
          <div className="space-y-4 mt-5">
            {SURVEY_QUESTIONS.map(q => (
              <div key={q.name}>
                <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-1.5">{q.label}</label>
                <textarea rows={2} name={q.name} value={form[q.name]} onChange={ch} placeholder={q.placeholder} className={inputCls} />
              </div>
            ))}

            <div>
              <label className="block text-sm font-semibold text-[color:var(--ink-700)] mb-2">Experiment preference</label>
              <div className="flex gap-3">
                {[
                  { val: 'continue_old', label: 'Continue old experiments', desc: 'Pick up where I left off' },
                  { val: 'start_new', label: 'Start fresh experiments', desc: 'Begin new experiments' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setForm(f => ({ ...f, continue_old_or_new: opt.val }))}
                    className="flex-1 rounded-xl border p-3 text-left transition"
                    style={form.continue_old_or_new === opt.val
                      ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)' }
                      : { borderColor: 'var(--ink-200)', background: 'white' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: form.continue_old_or_new === opt.val ? 'var(--brand-navy-900)' : 'var(--surface-dark-900)' }}>{opt.label}</p>
                    <p className="text-xs text-[color:var(--ink-500)] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">Cancel</button>
              <button onClick={handleSubmitSurvey} disabled={generating}
                className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
                style={{ background: 'var(--brand-navy-900)' }}>
                {generating ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Generating plan…</span>
                  : <span className="flex items-center justify-center gap-2">Generate Updated Plan <ArrowRight size={14} /></span>}
              </button>
            </div>
          </div>
        )}

        {step === 'primary' && (
          <div className="space-y-5 mt-5">
            {generatedPlan && (
              <div className="rounded-[20px] p-5" style={{ background: 'var(--surface-dark-700)', border: '1px solid rgba(31,58,95,0.4)' }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--brand-gold-500)' }}>Your Updated Plan</p>
                <pre className="text-sm text-[color:var(--ink-300)] whitespace-pre-wrap font-body leading-6">{generatedPlan}</pre>
              </div>
            )}

            <div className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-5">
              <p className="text-sm font-semibold text-[color:var(--surface-dark-900)] mb-3">Make this your Primary Focus?</p>
              <p className="text-xs text-[color:var(--ink-500)] mb-4">Your Primary Focus path gets the highest visibility on the dashboard. You can change this at any time.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setMakePrimary(true)}
                  className="flex-1 rounded-xl border p-3 text-sm font-semibold transition"
                  style={makePrimary ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)', color: 'var(--brand-navy-900)' } : { borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-700)' }}>
                  Yes — make it Primary Focus
                </button>
                <button
                  onClick={() => setMakePrimary(false)}
                  className="flex-1 rounded-xl border p-3 text-sm font-semibold transition"
                  style={!makePrimary ? { borderColor: 'var(--brand-navy-900)', background: 'var(--ink-100)', color: 'var(--brand-navy-900)' } : { borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-700)' }}>
                  No — keep current primary
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} disabled={saving} className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] disabled:opacity-50">Cancel</button>
              <button onClick={handleFinish} disabled={saving}
                className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
                style={{ background: 'var(--brand-navy-900)' }}>
                {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving…</span> : 'Resume This Path'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}