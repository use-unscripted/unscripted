import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Plus, Sparkles, X, Undo2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrapLLM, PLAIN_PROSE_RULES } from '@/lib/llm';
import { toText } from '@/lib/ai-validation';
import { reportAiFailure } from '@/lib/ai-failures';
import {
  newEntry, newEducationCF, newCert, newAward, newResearch,
  MONTH_OPTIONS, CF_SKILL_GROUP_LABELS, CF_SKILL_GROUP_IDS,
} from './resumeTemplates';

// ── AI Bullet Helper ─────────────────────────────────────────────────────────
function BulletAIPopover({ bullet, onApply, onClose }) {
  const [result, setResult] = useState('');
  const [original] = useState(bullet);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('');
  const [error, setError] = useState('');

  const actions = [
    { id: 'improve', label: 'Improve this bullet' },
    { id: 'concise', label: 'Make more concise' },
    { id: 'action', label: 'Add action-oriented language' },
    { id: 'claims', label: 'Check for unsupported claims' },
  ];

  const run = async (actionId) => {
    setMode(actionId);
    setError('');
    setLoading(true);
    const prompts = {
      improve: `Improve this resume bullet. Make it concrete and specific about what was done and what came of it. Return ONLY the improved bullet text, nothing else. Original: "${bullet}"${PLAIN_PROSE_RULES}`,
      concise: `Make this resume bullet more concise while keeping all key information. Return ONLY the revised bullet. Original: "${bullet}"${PLAIN_PROSE_RULES}`,
      action: `Rewrite this resume bullet starting with a strong action verb. Return ONLY the revised bullet. Original: "${bullet}"${PLAIN_PROSE_RULES}`,
      claims: `Review this resume bullet for unsupported or vague claims. List any claims that lack specifics, then suggest how to strengthen them. Original: "${bullet}"${PLAIN_PROSE_RULES}`,
    };
    try {
      // Rewrites a single resume bullet. The only call with no
      // response_json_schema, so this one comes back as a plain string.
      // Cheap tier; see src/lib/llm.js.
      const res = unwrapLLM(await base44.integrations.Core.InvokeLLM({
        prompt: prompts[actionId],
        model: 'gemini_3_flash',
      }));
      // Never fall back to stringified JSON. This popover has an Apply button
      // next to it, so anything shown here is one click from the student's
      // resume and an employer reading it.
      //
      // This is the app's only call with no response_json_schema, so it comes
      // back as a bare string. unwrapLLM deliberately leaves a primitive under
      // `response` alone (an array or a string there is far more likely to be a
      // real field), which is right for structured calls and wrong here, so the
      // wrapper is unwrapped explicitly.
      const text = toText(typeof res?.response === 'string' ? res.response : res);
      if (!text) {
        reportAiFailure('resume_bullet', { stage: 'validate', codes: ['empty_response'], model: 'gemini_3_flash' });
        setError('That came back empty. Try again.');
        setResult('');
      } else {
        setResult(text);
      }
    } catch (e) {
      // The prompt carries the student's own bullet, so slugs only.
      reportAiFailure('resume_bullet', { stage: 'invoke_llm', codes: ['unexpected_error'], model: 'gemini_3_flash' });
      setError('We could not rewrite that just now. Try again in a moment.');
      setResult('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-80 rounded-xl border border-[color:var(--ink-200)] bg-white shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="tp-card text-[color:var(--surface-dark-900)] flex items-center gap-1.5">
          <Sparkles size={12} style={{ color: 'var(--brand-navy-700)' }} /> AI Bullet Help
        </p>
        <button onClick={onClose}><X size={14} className="text-[color:var(--ink-400)]" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {actions.map(a => (
          <button key={a.id} onClick={() => run(a.id)} disabled={loading}
            className="rounded-full border border-[color:var(--ink-200)] px-2.5 py-1 tp-meta font-semibold text-[color:var(--ink-700)] hover:border-[color:var(--brand-navy-900)] hover:text-[color:var(--brand-navy-900)] transition disabled:opacity-50">
            {a.label}
          </button>
        ))}
      </div>
      {loading && <p className="tp-meta text-[color:var(--ink-500)]">Generating…</p>}
      {!loading && error && <p className="mb-3 tp-meta" style={{ color: 'var(--warning-700)' }}>{error}</p>}
      {result && (
        <div className="rounded-lg bg-[color:var(--ink-50)] border border-[color:var(--ink-200)] p-3 mb-3">
          <p className="tp-prose text-[color:var(--surface-dark-900)]">{result}</p>
        </div>
      )}
      {result && mode !== 'claims' && (
        <div className="flex gap-2">
          <button onClick={() => onApply(result)}
            className="flex-1 rounded-lg py-2 tp-meta font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
            Apply
          </button>
          <button onClick={() => onApply(original)}
            className="flex-1 rounded-lg border border-[color:var(--ink-200)] py-2 tp-meta font-semibold text-[color:var(--ink-700)] flex items-center justify-center gap-1">
            <Undo2 size={11} /> Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bullet List Editor ────────────────────────────────────────────────────────
function BulletsEditor({ bullets, onChange, placeholder = 'Start with an action verb…' }) {
  const [aiTarget, setAiTarget] = useState(null);
  const list = bullets || [''];
  const set = (i, v) => { const b = [...list]; b[i] = v; onChange(b); };
  const add = () => onChange([...list, '']);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const b = [...list]; const ni = i + dir;
    if (ni < 0 || ni >= b.length) return;
    [b[i], b[ni]] = [b[ni], b[i]]; onChange(b);
  };
  return (
    <div>
      <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Bullet Points</label>
      {list.map((b, i) => (
        <div key={i} className="relative flex items-start gap-1 mb-1">
          <div className="flex flex-col gap-0.5 pt-1.5 shrink-0">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)] disabled:opacity-20"><ChevronUp size={11} /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1}
              className="text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)] disabled:opacity-20"><ChevronDown size={11} /></button>
          </div>
          <textarea value={b} onChange={e => set(i, e.target.value)} rows={2} placeholder={placeholder}
            className="flex-1 rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta resize-none outline-none focus:border-[color:var(--brand-navy-900)]" />
          <div className="flex flex-col gap-0.5 pt-1 shrink-0">
            <button type="button" title="AI Help" onClick={() => setAiTarget(aiTarget === i ? null : i)}
              className="text-[color:var(--ink-400)] hover:text-[color:var(--brand-navy-700)]"><Sparkles size={11} /></button>
            <button type="button" onClick={() => remove(i)} disabled={list.length === 1}
              className="text-red-300 hover:text-red-500 disabled:opacity-20"><X size={11} /></button>
          </div>
          {aiTarget === i && (
            <BulletAIPopover bullet={b} onApply={val => { set(i, val); setAiTarget(null); }} onClose={() => setAiTarget(null)} />
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        className="mt-1 flex items-center gap-1 tp-meta font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--brand-navy-700)]">
        <Plus size={11} /> Add bullet
      </button>
    </div>
  );
}

// ── Contact Editor (CF) ───────────────────────────────────────────────────────
function ContactEditor({ contact, onChange }) {
  const set = (k, v) => onChange({ ...contact, [k]: v });
  return (
    <div className="p-3 grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Full Name *</label>
        <input value={contact?.name || ''} onChange={e => set('name', e.target.value)} placeholder="Your Full Name"
          className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>
      <div>
        <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">City</label>
        <input value={contact?.city || ''} onChange={e => set('city', e.target.value)} placeholder="Boston"
          className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>
      <div>
        <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">State / Region</label>
        <input value={contact?.state || ''} onChange={e => set('state', e.target.value)} placeholder="MA"
          className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>
      <div>
        <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Phone</label>
        <input value={contact?.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="555-123-4567"
          className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>
      <div>
        <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Email *</label>
        <input value={contact?.email || ''} onChange={e => set('email', e.target.value)} placeholder="you@school.edu"
          className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>
      <div className="col-span-2">
        <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">LinkedIn URL</label>
        <input value={contact?.linkedin || ''} onChange={e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname"
          className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>
      <div className="col-span-2">
        <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Portfolio / Website (optional)</label>
        <input value={contact?.portfolio || ''} onChange={e => set('portfolio', e.target.value)} placeholder="yoursite.com"
          className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
      </div>
      <p className="col-span-2 tp-meta text-[color:var(--ink-400)]">Home address is not collected. City and state appear in the resume header.</p>
    </div>
  );
}

// ── Education Editor (CF, single active entry) ────────────────────────────────
function EducationCFEditor({ entries, onChange }) {
  const list = Array.isArray(entries) ? entries : [];
  // Only the first non-hidden entry is the active entry
  const activeIdx = list.findIndex(e => !e.hidden);
  const active = activeIdx >= 0 ? list[activeIdx] : null;

  const setActive = (updated) => {
    if (activeIdx >= 0) {
      const next = [...list]; next[activeIdx] = updated; onChange(next);
    }
  };

  const createEntry = () => {
    // Only create if no active entry exists
    if (active) return;
    onChange([...list, newEducationCF()]);
  };

  if (!active) {
    return (
      <div className="px-2 pb-2">
        <p className="tp-meta text-[color:var(--ink-500)] mb-2">No active education entry. Add your current university program.</p>
        <button onClick={createEntry}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--ink-200)] px-3 py-2 tp-meta font-semibold text-[color:var(--ink-500)] hover:border-[color:var(--brand-navy-900)] hover:text-[color:var(--brand-navy-900)] w-full justify-center transition">
          <Plus size={13} /> Add Education
        </button>
      </div>
    );
  }

  const e = active;
  const set = (k, v) => setActive({ ...e, [k]: v });

  return (
    <div className="px-2 pb-2">
      <div className="rounded-xl border border-[color:var(--ink-200)] bg-white mb-3">
        <div className="flex items-center gap-2 px-3 py-2">
          <p className="tp-card flex-1 truncate text-[color:var(--surface-dark-900)]">{e.institution || 'Current University'}</p>
          <span className="tp-meta text-[color:var(--ink-400)]">Active entry</span>
        </div>
        <div className="px-3 pb-3 space-y-2">
          {/* University name */}
          <div>
            <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">University Name *</label>
            <input value={e.institution || ''} onChange={ev => set('institution', ev.target.value)} placeholder="e.g. Fairfield University"
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
          </div>
          {/* City + State */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">City *</label>
              <input value={e.city || ''} onChange={ev => set('city', ev.target.value)} placeholder="Fairfield"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">State / Region *</label>
              <input value={e.state || ''} onChange={ev => set('state', ev.target.value)} placeholder="CT"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          {/* Degree + abbreviation */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Degree Type *</label>
              <input value={e.degree || ''} onChange={ev => set('degree', ev.target.value)} placeholder="Bachelor of Science"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Abbreviation (opt.)</label>
              <input value={e.degreeAbbrev || ''} onChange={ev => set('degreeAbbrev', ev.target.value)} placeholder="B.S."
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          {/* Primary + Second Major */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Primary Major *</label>
              <input value={e.major || ''} onChange={ev => set('major', ev.target.value)} placeholder="Finance"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Second Major (opt.)</label>
              <input value={e.secondMajor || ''} onChange={ev => set('secondMajor', ev.target.value)} placeholder="Economics"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          {/* Minor + Concentration */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Minor (opt.)</label>
              <input value={e.minor || ''} onChange={ev => set('minor', ev.target.value)} placeholder="Data Analytics"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Concentration (opt.)</label>
              <input value={e.concentration || ''} onChange={ev => set('concentration', ev.target.value)} placeholder="Financial Planning"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          {/* Expected Grad Month + Year */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Expected Grad Month *</label>
              <select value={e.gradMonth || ''} onChange={ev => set('gradMonth', ev.target.value)}
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)] bg-white">
                <option value="">Month</option>
                {MONTH_OPTIONS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Expected Grad Year *</label>
              <input value={e.gradYear || ''} onChange={ev => set('gradYear', ev.target.value)} placeholder="2028" maxLength={4}
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          {/* GPA */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Cumulative GPA (opt.)</label>
              <input value={e.gpa || ''} onChange={ev => set('gpa', ev.target.value)} placeholder="3.84"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">GPA Scale</label>
              <input value={e.gpaScale || '4.00'} onChange={ev => set('gpaScale', ev.target.value)} placeholder="4.00"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-1 tp-meta text-[color:var(--ink-500)] cursor-pointer">
                <input type="checkbox" checked={e.showGpa !== false} onChange={ev => set('showGpa', ev.target.checked)} className="accent-[color:var(--brand-navy-900)]" />
                Show GPA
              </label>
            </div>
          </div>
          {/* Coursework */}
          <div>
            <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Relevant Coursework (opt.)</label>
            <input value={e.coursework || ''} onChange={ev => set('coursework', ev.target.value)}
              placeholder="Financial Modeling, Valuation, Corporate Finance, Investment Analysis"
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            <p className="tp-meta text-[color:var(--ink-400)] mt-0.5">Separate courses with commas</p>
          </div>
          {/* Honors */}
          <div>
            <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Honors &amp; Awards (opt.)</label>
            <input value={e.honors || ''} onChange={ev => set('honors', ev.target.value)}
              placeholder="Dean's List All Semesters, Merit Scholarship"
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            <p className="tp-meta text-[color:var(--ink-400)] mt-0.5">Education-specific honors only. Broader awards go in the Awards section.</p>
          </div>
        </div>
      </div>
      <p className="tp-meta text-[color:var(--ink-400)] text-center">One active education entry is supported. Legacy education records are preserved in Preserved Resume Data.</p>
    </div>
  );
}

// ── Entry Editor (Work Experience & Activities) ───────────────────────────────
function EntryEditor({ entry, onChange, onRemove, onDuplicate, isActivity = false }) {
  const [expanded, setExpanded] = useState(true);
  const set = (k, v) => onChange({ ...entry, [k]: v });

  return (
    <div className={`rounded-xl border ${entry.hidden ? 'border-dashed border-[color:var(--ink-200)] opacity-60' : 'border-[color:var(--ink-200)]'} bg-white mb-3`}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <p className="tp-card flex-1 truncate text-[color:var(--surface-dark-900)]">{entry.org || entry.title || 'New entry'}</p>
        <button type="button" onClick={e => { e.stopPropagation(); onChange({ ...entry, hidden: !entry.hidden }); }}
          title={entry.hidden ? 'Show' : 'Hide'} className="text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">
          {entry.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Duplicate"
          className="text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)] tp-meta font-semibold px-1">⊕</button>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
        {expanded ? <ChevronUp size={14} className="text-[color:var(--ink-400)]" /> : <ChevronDown size={14} className="text-[color:var(--ink-400)]" />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">{isActivity ? 'Organization' : 'Employer / Organization'}</label>
              <input value={entry.org || ''} onChange={e => set('org', e.target.value)}
                placeholder={isActivity ? 'e.g. Investment Club' : 'e.g. Goldman Sachs'}
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">{isActivity ? 'Position / Role' : 'Position Title'}</label>
              <input value={entry.title || ''} onChange={e => set('title', e.target.value)}
                placeholder={isActivity ? 'e.g. Vice President' : 'e.g. Analyst Intern'}
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>

          {!isActivity && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Sector / Group (opt.)</label>
                <input value={entry.sectorGroup || ''} onChange={e => set('sectorGroup', e.target.value)} placeholder="e.g. Healthcare Sector"
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
              </div>
              <div>
                <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Hours/week (opt.)</label>
                <input value={entry.hoursPerWeek || ''} onChange={e => set('hoursPerWeek', e.target.value)} placeholder="e.g. 40"
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Location</label>
              <input value={entry.location || ''} onChange={e => set('location', e.target.value)} placeholder="City, State"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            {!isActivity && (
              <div>
                <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Arrangement</label>
                <select value={entry.arrangement || ''} onChange={e => set('arrangement', e.target.value)}
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)] bg-white">
                  <option value="">Select</option>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
            )}
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Start</label>
              <input type="month" value={entry.startDate || ''} onChange={e => set('startDate', e.target.value)}
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">{entry.current ? 'End (current)' : 'End'}</label>
              <div className="flex gap-1 items-center">
                <input type="month" value={entry.current ? '' : (entry.endDate || '')} onChange={e => set('endDate', e.target.value)} disabled={entry.current}
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)] disabled:opacity-40" />
                <label className="flex items-center gap-1 tp-meta text-[color:var(--ink-500)] cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={!!entry.current} onChange={e => set('current', e.target.checked)} className="accent-[color:var(--brand-navy-900)]" />
                  Now
                </label>
              </div>
            </div>
          </div>

          {isActivity && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Link Label (opt.)</label>
                <input value={entry.linkLabel || ''} onChange={e => set('linkLabel', e.target.value)} placeholder="e.g. Club Website"
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
              </div>
              <div>
                <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Link URL (opt.)</label>
                <input value={entry.linkUrl || ''} onChange={e => set('linkUrl', e.target.value)} placeholder="https://..."
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
              </div>
            </div>
          )}

          <BulletsEditor bullets={entry.bullets} onChange={v => set('bullets', v)} />
        </div>
      )}
    </div>
  );
}

// ── Skills Grouped Editor (fixed category labels) ─────────────────────────────
function SkillsGroupedEditor({ groups, onChange }) {
  const list = Array.isArray(groups) ? groups : [];

  // Ensure fixed groups always exist
  const ensuredList = CF_SKILL_GROUP_IDS.map(id => {
    const existing = list.find(g => g.id === id);
    return existing || { id, label: CF_SKILL_GROUP_LABELS[id], items: '' };
  });

  const updateGroup = (id, items) => {
    const next = ensuredList.map(g => g.id === id ? { ...g, items } : g);
    onChange(next);
  };

  return (
    <div className="px-2 pb-2">
      <p className="tp-meta text-[color:var(--ink-400)] mb-2">Each category displays as: <strong>Label:</strong> item1, item2. Empty categories are hidden in the resume.</p>
      {ensuredList.map(g => (
        <div key={g.id} className="rounded-xl border mb-2 bg-white border-[color:var(--ink-200)]">
          <div className="px-3 py-2">
            <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">{CF_SKILL_GROUP_LABELS[g.id]}</label>
            <input value={g.items || ''} onChange={e => updateGroup(g.id, e.target.value)}
              placeholder={
                g.id === 'tech' ? 'Excel, PowerPoint, FactSet, Bloomberg…' :
                g.id === 'virtual' ? 'JP Morgan Virtual Internship, Goldman Sachs Virtual Experience…' :
                g.id === 'other' ? 'Chess Club, Student Government…' :
                'Hiking, Photography, Music…'
              }
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
          </div>
        </div>
      ))}
      <p className="tp-meta text-[color:var(--ink-400)]">Category names are fixed for professional consistency.</p>
    </div>
  );
}

// ── Certifications Editor ─────────────────────────────────────────────────────
function CertificationsEditor({ entries, onChange }) {
  const list = Array.isArray(entries) ? entries : [];
  const update = (i, v) => { const n = [...list]; n[i] = v; onChange(n); };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, newCert()]);

  return (
    <div className="px-2 pb-2">
      {list.map((c, i) => {
        const set = (k, v) => update(i, { ...c, [k]: v });
        return (
          <div key={c.id || i} className="rounded-xl border border-[color:var(--ink-200)] bg-white mb-3">
            <div className="flex items-center gap-2 px-3 py-2">
              <p className="tp-card flex-1 truncate text-[color:var(--surface-dark-900)]">{c.name || 'New Certification'}</p>
              <button onClick={() => remove(i)} className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Certification Name</label>
                  <input value={c.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. CFA Level I"
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Issuing Organization</label>
                  <input value={c.issuer || ''} onChange={e => set('issuer', e.target.value)} placeholder="e.g. CFA Institute"
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Month Earned</label>
                  <select value={c.month || ''} onChange={e => set('month', e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2 py-1.5 tp-meta outline-none bg-white">
                    <option value="">Month</option>
                    {MONTH_OPTIONS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Year Earned</label>
                  <input value={c.year || ''} onChange={e => set('year', e.target.value)} placeholder="2025"
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Credential ID (opt.)</label>
                  <input value={c.credentialId || ''} onChange={e => set('credentialId', e.target.value)} placeholder="ID or license number"
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Credential URL (opt.)</label>
                  <input value={c.credentialUrl || ''} onChange={e => set('credentialUrl', e.target.value)} placeholder="https://..."
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={add}
        className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--ink-200)] px-3 py-2 tp-meta font-semibold text-[color:var(--ink-500)] hover:border-[color:var(--brand-navy-900)] hover:text-[color:var(--brand-navy-900)] w-full justify-center transition">
        <Plus size={13} /> Add Certification
      </button>
    </div>
  );
}

// ── Awards Editor ─────────────────────────────────────────────────────────────
function AwardsEditor({ entries, educationHonors = '', onChange }) {
  const list = Array.isArray(entries) ? entries : [];
  const update = (i, v) => { const n = [...list]; n[i] = v; onChange(n); };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, newAward()]);

  const honorsLower = (educationHonors || '').toLowerCase();

  return (
    <div className="px-2 pb-2">
      {list.map((a, i) => {
        const set = (k, v) => update(i, { ...a, [k]: v });
        const nameLower = (a.name || '').toLowerCase();
        const possibleDup = nameLower && honorsLower && honorsLower.includes(nameLower.split(' ')[0]);
        return (
          <div key={a.id || i} className="rounded-xl border border-[color:var(--ink-200)] bg-white mb-3">
            <div className="flex items-center gap-2 px-3 py-2">
              <p className="tp-card flex-1 truncate text-[color:var(--surface-dark-900)]">{a.name || 'New Award'}</p>
              <button onClick={() => remove(i)} className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
            {possibleDup && (
              <div className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 p-2">
                <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="tp-meta text-amber-700">This award may already appear in Education. Review both sections to avoid duplication.</p>
              </div>
            )}
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Award Name</label>
                  <input value={a.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Dean's Award"
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Issuing Organization</label>
                  <input value={a.issuer || ''} onChange={e => set('issuer', e.target.value)} placeholder="e.g. University Name"
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Month</label>
                  <select value={a.month || ''} onChange={e => set('month', e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2 py-1.5 tp-meta outline-none bg-white">
                    <option value="">Month</option>
                    {MONTH_OPTIONS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Year</label>
                  <input value={a.year || ''} onChange={e => set('year', e.target.value)} placeholder="2025"
                    className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
                </div>
              </div>
              <div>
                <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Description (opt.)</label>
                <input value={a.description || ''} onChange={e => set('description', e.target.value)} placeholder="Brief description"
                  className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={add}
        className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--ink-200)] px-3 py-2 tp-meta font-semibold text-[color:var(--ink-500)] hover:border-[color:var(--brand-navy-900)] hover:text-[color:var(--brand-navy-900)] w-full justify-center transition">
        <Plus size={13} /> Add Award
      </button>
    </div>
  );
}

// ── Research Entry Editor ─────────────────────────────────────────────────────
function ResearchEntryEditor({ entry: r, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(true);
  const set = (k, v) => onUpdate({ ...r, [k]: v });

  return (
    <div className="rounded-xl border border-[color:var(--ink-200)] bg-white mb-3">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <p className="tp-card flex-1 truncate text-[color:var(--surface-dark-900)]">{r.title || 'New Research'}</p>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
        {expanded ? <ChevronUp size={14} className="text-[color:var(--ink-400)]" /> : <ChevronDown size={14} className="text-[color:var(--ink-400)]" />}
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Research Title</label>
              <input value={r.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Equity Risk Premiums"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Institution / Organization</label>
              <input value={r.institution || ''} onChange={e => set('institution', e.target.value)} placeholder="e.g. Fairfield University"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Role</label>
              <input value={r.role || ''} onChange={e => set('role', e.target.value)} placeholder="e.g. Research Assistant"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Advisor (opt.)</label>
              <input value={r.advisor || ''} onChange={e => set('advisor', e.target.value)} placeholder="e.g. Prof. Smith"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Location (opt.)</label>
              <input value={r.location || ''} onChange={e => set('location', e.target.value)} placeholder="City, State"
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Public Link (opt.)</label>
              <input value={r.link || ''} onChange={e => set('link', e.target.value)} placeholder="https://..."
                className="w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 tp-meta outline-none focus:border-[color:var(--brand-navy-900)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">Start (Month/Year)</label>
              <div className="flex gap-1">
                <select value={r.startMonth || ''} onChange={e => set('startMonth', e.target.value)}
                  className="flex-1 rounded-lg border border-[color:var(--ink-200)] px-1 py-1.5 tp-meta outline-none bg-white">
                  <option value="">Mo</option>
                  {MONTH_OPTIONS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
                <input value={r.startYear || ''} onChange={e => set('startYear', e.target.value)} placeholder="YYYY"
                  className="w-16 rounded-lg border border-[color:var(--ink-200)] px-2 py-1.5 tp-meta outline-none" />
              </div>
            </div>
            <div>
              <label className="block tp-meta font-semibold text-[color:var(--ink-500)] mb-1">End (Month/Year)</label>
              <div className="flex gap-1 items-center">
                <select value={r.endMonth || ''} onChange={e => set('endMonth', e.target.value)} disabled={r.current}
                  className="flex-1 rounded-lg border border-[color:var(--ink-200)] px-1 py-1.5 tp-meta outline-none bg-white disabled:opacity-40">
                  <option value="">Mo</option>
                  {MONTH_OPTIONS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
                <input value={r.endYear || ''} onChange={e => set('endYear', e.target.value)} placeholder="YYYY" disabled={r.current}
                  className="w-16 rounded-lg border border-[color:var(--ink-200)] px-2 py-1.5 tp-meta outline-none disabled:opacity-40" />
                <label className="flex items-center gap-1 tp-meta text-[color:var(--ink-500)] cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={!!r.current} onChange={e => set('current', e.target.checked)} className="accent-[color:var(--brand-navy-900)]" />
                  Now
                </label>
              </div>
            </div>
          </div>
          <BulletsEditor bullets={r.bullets} onChange={v => set('bullets', v)} />
        </div>
      )}
    </div>
  );
}

// ── Research Editor ───────────────────────────────────────────────────────────
function ResearchEditor({ entries, onChange }) {
  const list = Array.isArray(entries) ? entries : [];
  const update = (i, v) => { const n = [...list]; n[i] = v; onChange(n); };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, newResearch()]);

  return (
    <div className="px-2 pb-2">
      {list.map((r, i) => (
        <ResearchEntryEditor key={r.id || i} entry={r} onUpdate={v => update(i, v)} onRemove={() => remove(i)} />
      ))}
      <button onClick={add}
        className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--ink-200)] px-3 py-2 tp-meta font-semibold text-[color:var(--ink-500)] hover:border-[color:var(--brand-navy-900)] hover:text-[color:var(--brand-navy-900)] w-full justify-center transition">
        <Plus size={13} /> Add Research
      </button>
    </div>
  );
}

// ── Section Panel ────────────────────────────────────────────────────────────
function SectionPanel({ section, data, allContent, onChange, onMoveUp, onMoveDown, onToggleVisible, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(true);

  // Get education honors for duplicate detection in Awards
  const educationEntries = allContent?.education || [];
  const activeEdu = educationEntries.find(e => !e.hidden);
  const educationHonors = activeEdu?.honors || '';

  const addEntry = () => {
    const entries = Array.isArray(data) ? data : [];
    onChange([...entries, newEntry()]);
  };

  const isActivity = section.id === 'activities';
  const isCoreSection = section.cf_locked;

  return (
    <div className={`rounded-[16px] border mb-3 ${section.visible === false ? 'border-dashed border-[color:var(--ink-200)] opacity-70' : 'border-[color:var(--ink-200)]'} bg-[color:var(--page-surface)]`}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={isFirst} className="text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)] disabled:opacity-20"><ChevronUp size={13} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)] disabled:opacity-20"><ChevronDown size={13} /></button>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="tp-section flex-1 text-left text-[color:var(--surface-dark-900)]">
          {section.label}
        </button>
        {/* Optional sections can be toggled visible/hidden */}
        <button onClick={onToggleVisible} title={section.visible === false ? 'Enable section' : 'Hide section'}
          className="text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">
          {section.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={() => setExpanded(e => !e)} className="text-[color:var(--ink-400)]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2">
          {section.type === 'contact' && (
            <ContactEditor contact={data} onChange={onChange} />
          )}
          {section.type === 'education_cf' && (
            <EducationCFEditor entries={Array.isArray(data) ? data : []} onChange={onChange} />
          )}
          {section.type === 'skills_grouped' && (
            <SkillsGroupedEditor groups={Array.isArray(data) ? data : []} onChange={onChange} />
          )}
          {section.type === 'cert' && (
            <CertificationsEditor entries={Array.isArray(data) ? data : []} onChange={onChange} />
          )}
          {section.type === 'awards_cf' && (
            <AwardsEditor entries={Array.isArray(data) ? data : []} educationHonors={educationHonors} onChange={onChange} />
          )}
          {section.type === 'research' && (
            <ResearchEditor entries={Array.isArray(data) ? data : []} onChange={onChange} />
          )}
          {section.type === 'list' && (
            <>
              {(Array.isArray(data) ? data : []).map((entry, i, arr) => (
                <EntryEditor
                  key={entry.id || i}
                  entry={entry}
                  isActivity={isActivity}
                  onChange={updated => { const next = [...arr]; next[i] = updated; onChange(next); }}
                  onRemove={() => onChange(arr.filter((_, idx) => idx !== i))}
                  onDuplicate={() => {
                    const dup = { ...entry, id: Math.random().toString(36).slice(2) };
                    const next = [...arr]; next.splice(i + 1, 0, dup); onChange(next);
                  }}
                />
              ))}
              <button onClick={addEntry}
                className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--ink-200)] px-3 py-2 tp-meta font-semibold text-[color:var(--ink-500)] hover:border-[color:var(--brand-navy-900)] hover:text-[color:var(--brand-navy-900)] w-full justify-center transition">
                <Plus size={13} /> Add entry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────
export default function ResumeEditor({ resume, onChange }) {
  const isCF = resume?.template_id === 'classic_finance';
  const content = resume?.content || {};
  const sections = content.sections || [];
  const sectionOrder = resume?.section_order || sections.map(s => s.id);

  const ordered = sectionOrder.length > 0
    ? [...sectionOrder.map(id => sections.find(s => s.id === id)).filter(Boolean),
       ...sections.filter(s => !sectionOrder.includes(s.id))]
    : sections;

  const updateSection = (idx, section, data) => {
    const nextSections = ordered.map((s, i) => i === idx ? section : s);
    const nextContent = { ...content, sections: nextSections, [section.id]: data };
    onChange({ ...resume, content: nextContent, section_order: nextSections.map(s => s.id) });
  };

  const moveSection = (idx, dir) => {
    const arr = [...ordered]; const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    onChange({ ...resume, content: { ...content, sections: arr }, section_order: arr.map(s => s.id) });
  };

  const toggleVisible = (idx) => {
    const nextSections = ordered.map((sec, i) => i === idx ? { ...sec, visible: sec.visible === false ? true : false } : sec);
    onChange({ ...resume, content: { ...content, sections: nextSections }, section_order: nextSections.map(s => s.id) });
  };

  return (
    <div>
      <div className="mb-3 rounded-[14px] p-3 tp-meta" style={{ background: 'var(--ink-100)', border: '1px solid var(--border-light)' }}>
        {isCF
          ? <><span className="font-bold" style={{ color: 'var(--brand-navy-900)' }}>Classic Finance template</span><span className="text-[color:var(--ink-500)]">: Garamond, centered header, ATS-friendly one-column layout.</span></>
          : <span className="text-[color:var(--ink-500)]">Certifications, Awards, and Research sections are optional. Enable them using the eye icon.</span>
        }
      </div>
      {ordered.map((section, idx) => (
        <SectionPanel
          key={section.id}
          section={section}
          data={content[section.id]}
          allContent={content}
          onChange={(data) => updateSection(idx, section, data)}
          onMoveUp={() => moveSection(idx, -1)}
          onMoveDown={() => moveSection(idx, 1)}
          onToggleVisible={() => toggleVisible(idx)}
          isFirst={idx === 0}
          isLast={idx === ordered.length - 1}
        />
      ))}
    </div>
  );
}