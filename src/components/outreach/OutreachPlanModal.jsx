/**
 * OutreachPlanModal
 * A multi-step flow:
 *  1. Survey — what the user wants to learn, preferences
 *  2. Generate — AI produces outreach experiments, archetypes, and public contact suggestions
 *  3. Results — user can save contacts, create missions, or dismiss suggestions
 *
 * Props:
 *   path        — PathRecommendation object (required)
 *   experiment  — Experiments object (optional, pre-selects context)
 *   onClose     — () => void
 *   onContactSaved — (contact) => void  (called after saving any contact)
 */
import { useState, useRef } from 'react';
import { X, Loader2, Users, Beaker, User, ExternalLink, CheckCircle, ChevronRight, AlertTriangle, BookOpen, Save, Target } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]';
const selCls = inputCls;

// ── Step 1: Survey ─────────────────────────────────────────────────────────────
const DEFAULT_SURVEY = {
  what_to_learn: '',
  conversation_type: 'informational_interview',
  industries: '',
  company_size: 'any',
  geography: '',
  seniority: 'any',
  alumni_preference: 'no_preference',
  time_available: '30',
  networking_comfort: 'moderate',
  preferred_channel: 'linkedin',
  suggestion_type: 'archetypes',
};

function SurveyStep({ pathName, survey, setSurvey, onNext, onClose }) {
  const ch = (e) => setSurvey(s => ({ ...s, [e.target.name]: e.target.value }));
  const canNext = survey.what_to_learn.trim().length > 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--brand-navy-700)' }}>Path</p>
        <p className="text-base font-heading font-bold text-[#050816]">{pathName}</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#334155] mb-1">
          What do you want to learn from these conversations? <span className="text-red-500">*</span>
        </label>
        <textarea name="what_to_learn" rows={3} value={survey.what_to_learn} onChange={ch}
          placeholder="e.g. What does the day-to-day look like at an entry level? How competitive is recruiting?"
          className={inputCls} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Type of conversation</label>
          <select name="conversation_type" value={survey.conversation_type} onChange={ch} className={selCls}>
            <option value="informational_interview">Informational interview</option>
            <option value="networking">General networking</option>
            <option value="mentor">Mentorship relationship</option>
            <option value="shadowing">Job shadow</option>
            <option value="event">Industry event</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Preferred seniority</label>
          <select name="seniority" value={survey.seniority} onChange={ch} className={selCls}>
            <option value="any">Any level</option>
            <option value="entry">Entry level (0–3 yrs)</option>
            <option value="mid">Mid-level (3–8 yrs)</option>
            <option value="senior">Senior (8+ yrs)</option>
            <option value="executive">Executive / Partner</option>
            <option value="mixed">Mix of levels</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Industry or subsector focus</label>
          <input name="industries" value={survey.industries} onChange={ch}
            placeholder="e.g. Healthcare, FinTech, Early-stage startups" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Preferred company size</label>
          <select name="company_size" value={survey.company_size} onChange={ch} className={selCls}>
            <option value="any">Any size</option>
            <option value="startup">Startup (1–50)</option>
            <option value="small">Small (50–200)</option>
            <option value="mid">Mid-size (200–1000)</option>
            <option value="large">Large (1000+)</option>
            <option value="bank">Bulge-bracket / Big4</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Geography preference</label>
          <input name="geography" value={survey.geography} onChange={ch}
            placeholder="e.g. New York, Remote OK, Any" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Alumni preference</label>
          <select name="alumni_preference" value={survey.alumni_preference} onChange={ch} className={selCls}>
            <option value="no_preference">No preference</option>
            <option value="prefer_alumni">Prefer alumni</option>
            <option value="alumni_only">Alumni only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Time available per outreach</label>
          <select name="time_available" value={survey.time_available} onChange={ch} className={selCls}>
            <option value="15">15-minute call</option>
            <option value="30">30-minute call</option>
            <option value="60">1-hour conversation</option>
            <option value="async">Async / email only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Networking comfort level</label>
          <select name="networking_comfort" value={survey.networking_comfort} onChange={ch} className={selCls}>
            <option value="low">Low — needs a lot of structure</option>
            <option value="moderate">Moderate — some guidance helpful</option>
            <option value="high">High — comfortable cold outreach</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Preferred outreach channel</label>
          <select name="preferred_channel" value={survey.preferred_channel} onChange={ch} className={selCls}>
            <option value="linkedin">LinkedIn</option>
            <option value="email">Email</option>
            <option value="in_person">In-person / events</option>
            <option value="phone">Phone / text</option>
            <option value="any">Any / open to all</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1">Suggestions to generate</label>
          <select name="suggestion_type" value={survey.suggestion_type} onChange={ch} className={selCls}>
            <option value="archetypes">Role archetypes only</option>
            <option value="both">Archetypes + public profile examples</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose}
          className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          Cancel
        </button>
        <button onClick={onNext} disabled={!canNext}
          className="flex-1 flex items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
          Generate Plan <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Contact archetype card ─────────────────────────────────────────────────────
function ArchetypeCard({ archetype }) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex items-center gap-2 mb-2">
        <User size={14} style={{ color: 'var(--brand-navy-900)' }} />
        <p className="text-sm font-bold text-[#050816]">{archetype.title}</p>
      </div>
      <p className="text-xs text-[#334155] mb-2">{archetype.why_useful}</p>
      <div className="flex flex-wrap gap-1.5">
        {archetype.where_to_find?.map((w, i) => (
          <span key={i} className="rounded-full border border-[#E2E8F0] px-2 py-0.5 text-[10px] text-[#64748B]">{w}</span>
        ))}
      </div>
    </div>
  );
}

// ── Outreach experiment card ───────────────────────────────────────────────────
function OutreachExperimentCard({ exp }) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Beaker size={14} style={{ color: 'var(--brand-navy-900)' }} />
        <p className="text-sm font-bold text-[#050816]">{exp.title}</p>
      </div>
      <p className="text-xs text-[#334155]">{exp.objective}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-[#64748B]">
        {exp.target_contact_type && <span><span className="font-semibold">Target:</span> {exp.target_contact_type}</span>}
        {exp.suggested_contacts && <span><span className="font-semibold">Contacts:</span> {exp.suggested_contacts}</span>}
        {exp.timeline && <span><span className="font-semibold">Timeline:</span> {exp.timeline}</span>}
        {exp.deliverable && <span><span className="font-semibold">Deliverable:</span> {exp.deliverable}</span>}
      </div>
      {exp.why_it_tests_path && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: '#EEF2F6', color: 'var(--brand-navy-900)' }}>
          <span className="font-semibold">Why it tests this path:</span> {exp.why_it_tests_path}
        </p>
      )}
    </div>
  );
}

// ── Outreach message template ──────────────────────────────────────────────────
function MessageTemplate({ template }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(template.body).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{template.label}</p>
        <button onClick={copy} className="text-xs font-semibold transition" style={{ color: 'var(--brand-navy-900)' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs text-[#334155] whitespace-pre-wrap font-body leading-5 max-h-40 overflow-y-auto">{template.body}</pre>
    </div>
  );
}

// ── Safe LinkedIn search URL (never a guessed direct profile) ─────────────────
function linkedInSearchUrl(name, organization, role) {
  const parts = [name, organization, role].filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(parts)}`;
}

// Detect if a URL is a direct LinkedIn profile (linkedin.com/in/...) — these must never come from AI
function isLinkedInProfileUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.includes('linkedin.com') && u.pathname.startsWith('/in/');
  } catch { return false; }
}

// ── Public contact suggestion card ────────────────────────────────────────────
function ContactSuggestionCard({ suggestion, pathName, experimentId, onSaved, onMissionCreated, dismissed, onDismiss, experiments }) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [missionLoading, setMissionLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCreateMission = async () => {
    setMissionLoading(true);
    try {
      const user = await base44.auth.me();
      // Find or create a linked experiment
      let expId = experimentId;
      if (!expId) {
        const linkedExp = experiments.find(e => e.path_name === pathName);
        expId = linkedExp?.id;
      }
      if (!expId) {
        setMissionLoading(false);
        return;
      }
      await base44.entities.Missions.create({
        user_id: user.id,
        experiment_id: expId,
        path_name: pathName,
        title: `Outreach: ${suggestion.name || suggestion.archetype_title}`,
        objective: `Complete informational outreach to ${suggestion.name || suggestion.archetype_title}`,
        description: `Steps to reach out to ${suggestion.name || suggestion.archetype_title} for insights on ${pathName}.`,
        status: 'planned',
        estimated_hours: 1,
        proof_required: 'Notes from the conversation saved to Outreach Tracker.',
      });
      onMissionCreated?.();
    } finally {
      setMissionLoading(false);
    }
  };

  if (dismissed) return null;

  const isArchetype = !suggestion.name;

  return (
    <>
      {showSaveModal && (
        <SaveContactConfirmModal
          suggestion={suggestion}
          pathName={pathName}
          experimentId={experimentId}
          experiments={experiments}
          onClose={() => setShowSaveModal(false)}
          onSaved={(contact) => { setShowSaveModal(false); setSaved(true); onSaved?.(contact); }}
        />
      )}
      <div className={`rounded-[16px] border p-4 space-y-3 transition ${saved ? 'border-green-200 bg-green-50' : 'border-[#E2E8F0] bg-white'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isArchetype ? (
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#F1F5F9', color: '#64748B' }}>Archetype</span>
                <p className="text-sm font-bold text-[#050816]">{suggestion.archetype_title}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>Suggested Contact</span>
                  <p className="text-sm font-bold text-[#050816]">{suggestion.name}</p>
                </div>
                <p className="text-xs text-[#334155]">{suggestion.role}{suggestion.role && suggestion.organization ? ' · ' : ''}{suggestion.organization}</p>
              </div>
            )}
            <p className="text-xs text-[#64748B] mt-1">{suggestion.why_relevant}</p>
            {!isArchetype && (
              <>
                {/* Never link directly to a LinkedIn profile URL from AI — always use verified search */}
                <a
                  href={linkedInSearchUrl(suggestion.name, suggestion.organization, suggestion.role)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold hover:underline"
                  style={{ color: 'var(--brand-navy-700)' }}>
                  <ExternalLink size={10} /> Search on LinkedIn
                </a>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">
                  Direct profile not verified. Review search results and confirm this person's company and role before reaching out.
                </p>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600">
                  <AlertTriangle size={10} />
                  <span>Verify identity independently. Role and company may have changed.</span>
                </div>
              </>
            )}
          </div>
          <button onClick={onDismiss} aria-label="Dismiss suggestion"
            className="shrink-0 rounded-lg p-1 text-[#CBD5E1] hover:text-[#94A3B8] transition">
            <X size={14} />
          </button>
        </div>

        {saved ? (
          <div className="flex items-center gap-2 text-xs text-green-700 font-semibold">
            <CheckCircle size={13} /> Saved to Outreach
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition"
              style={{ background: 'var(--brand-navy-900)' }}>
              <Save size={11} /> Save to Outreach
            </button>
            <button onClick={handleCreateMission} disabled={missionLoading}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-60 transition">
              {missionLoading ? <Loader2 size={11} className="animate-spin" /> : <Target size={11} />}
              Create Mission
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Save Contact Confirm Modal ─────────────────────────────────────────────────
function SaveContactConfirmModal({ suggestion, pathName, experimentId, experiments, onClose, onSaved }) {
  const isArchetype = !suggestion.name;
  const linkedExp = experimentId
    ? experiments.find(e => e.id === experimentId)
    : experiments.find(e => e.path_name === pathName);

  // Never pre-fill profile_url from AI-generated source_url — could be a fabricated LinkedIn link
  const [form, setForm] = useState({
    name: suggestion.name || '',
    company: suggestion.organization || '',
    role: suggestion.role || '',
    profile_url: '',
    reason_for_contact: suggestion.why_relevant || '',
    notes: suggestion.context || '',
    response_status: 'planning',
    contact_type: 'informational_interview',
  });
  const [saving, setSaving] = useState(false);

  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const contact = await base44.entities.OutreachContacts.create({
        user_id: user.id,
        name: form.name,
        company: form.company,
        role: form.role,
        profile_url: form.profile_url,
        reason_for_contact: form.reason_for_contact,
        notes: form.notes,
        response_status: form.response_status,
        contact_type: form.contact_type,
        path_being_tested: pathName,
        experiment_id: linkedExp?.id || undefined,
      });
      onSaved(contact);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold text-[#050816]">Save to Outreach</h3>
          <button onClick={onClose}><X size={18} className="text-[#64748B]" /></button>
        </div>

        {isArchetype && (
          <div className="mb-4 rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)' }}>
            <p className="text-xs text-[#B45309] font-semibold">This is an archetype template. Fill in the actual contact details below before saving.</p>
          </div>
        )}

        <div className="space-y-3">
          {[
            { name: 'name', label: 'Full name', placeholder: 'Contact name', required: true },
            { name: 'company', label: 'Company', placeholder: 'Organization' },
            { name: 'role', label: 'Role / Title', placeholder: 'e.g. Analyst, Founder' },
            { name: 'profile_url', label: 'LinkedIn or public profile URL', placeholder: 'https://...' },
          ].map(f => (
            <label key={f.name} className="block">
              <span className="text-xs font-semibold text-[#334155] block mb-1">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
              <input name={f.name} value={form[f.name]} onChange={ch} placeholder={f.placeholder} className={inputCls} />
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Reason for outreach</span>
            <textarea name="reason_for_contact" rows={2} value={form.reason_for_contact} onChange={ch} className={inputCls} />
          </label>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs">
            <p className="font-semibold text-[#64748B] mb-0.5">Path</p>
            <p className="text-[#050816] font-bold">{pathName}</p>
            {linkedExp && <>
              <p className="font-semibold text-[#64748B] mt-2 mb-0.5">Linked experiment</p>
              <p className="text-[#334155]">{linkedExp.title}</p>
            </>}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {saving ? 'Saving…' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Results Step ───────────────────────────────────────────────────────────────
function ResultsStep({ plan, pathName, experimentId, experiments, onContactSaved, onClose }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [missionCount, setMissionCount] = useState(0);
  const [activeTab, setActiveTab] = useState('experiments');

  const tabs = [
    { id: 'experiments', label: 'Outreach Experiments', icon: Beaker, count: plan.outreach_experiments?.length },
    { id: 'archetypes', label: 'Contact Archetypes', icon: Users, count: plan.contact_archetypes?.length },
    { id: 'suggestions', label: 'Suggested Contacts', icon: User, count: plan.contact_suggestions?.length },
    { id: 'templates', label: 'Message Templates', icon: BookOpen, count: plan.message_templates?.length },
  ].filter(t => t.count > 0);

  return (
    <div className="space-y-4">
      {savedCount > 0 && (
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-green-700" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <CheckCircle size={13} /> {savedCount} contact{savedCount !== 1 ? 's' : ''} saved to Outreach
          {missionCount > 0 && ` · ${missionCount} mission${missionCount !== 1 ? 's' : ''} created`}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition border"
            style={activeTab === t.id
              ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' }
              : { background: 'white', color: '#334155', borderColor: '#E2E8F0' }}>
            <t.icon size={11} /> {t.label}
            <span className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px]"
              style={activeTab === t.id ? { background: 'rgba(255,255,255,0.25)' } : { background: '#F1F5F9', color: '#64748B' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {activeTab === 'experiments' && plan.outreach_experiments?.map((exp, i) => (
          <OutreachExperimentCard key={i} exp={exp} />
        ))}

        {activeTab === 'archetypes' && plan.contact_archetypes?.map((a, i) => (
          <ArchetypeCard key={i} archetype={a} />
        ))}

        {activeTab === 'suggestions' && plan.contact_suggestions?.map((s, i) => (
          <ContactSuggestionCard
            key={i}
            suggestion={s}
            pathName={pathName}
            experimentId={experimentId}
            experiments={experiments}
            dismissed={dismissed.has(i)}
            onDismiss={() => setDismissed(prev => new Set([...prev, i]))}
            onSaved={(contact) => { setSavedCount(c => c + 1); onContactSaved?.(contact); }}
            onMissionCreated={() => setMissionCount(c => c + 1)}
          />
        ))}

        {activeTab === 'templates' && plan.message_templates?.map((t, i) => (
          <MessageTemplate key={i} template={t} />
        ))}
      </div>

      <button onClick={onClose}
        className="w-full rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
        Done
      </button>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function OutreachPlanModal({ path, experiment, onClose, onContactSaved }) {
  const [step, setStep] = useState('survey'); // survey | generating | results
  const [survey, setSurvey] = useState(DEFAULT_SURVEY);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [experiments, setExperiments] = useState([]);
  const generatingRef = useRef(false);

  // Load experiments for linking
  useState(() => {
    base44.entities.Experiments.list('-created_date', 200).catch(() => []).then(exps => {
      setExperiments(Array.isArray(exps) ? exps : []);
    });
  });

  const generate = async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setStep('generating');
    setError('');

    const wantPublicProfiles = survey.suggestion_type === 'both';

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert career coach helping a college student build a targeted outreach plan for the career path: "${path.path_name}".

Student's context:
- What they want to learn: ${survey.what_to_learn}
- Conversation type: ${survey.conversation_type}
- Industry/subsector focus: ${survey.industries || 'any'}
- Company size preference: ${survey.company_size}
- Geography preference: ${survey.geography || 'any'}
- Seniority preference: ${survey.seniority}
- Alumni preference: ${survey.alumni_preference}
- Time per conversation: ${survey.time_available} minutes
- Networking comfort: ${survey.networking_comfort}
- Preferred channel: ${survey.preferred_channel}

Generate a complete outreach plan with:

1. outreach_experiments: 3–5 practical outreach experiments the student can do (NOT general career experiments — these must be outreach-specific). Examples: "Interview 3 professionals at different seniority levels", "Attend one industry event and collect 2 contacts", "Interview an alumnus in this field", "Shadow a professional for one day". Each must include: title, objective, why_it_tests_path, target_contact_type, suggested_contacts (number), timeline, deliverable, reflection_question.

2. contact_archetypes: 4–6 role archetypes most useful for this path. Each must include: title (specific job title like "Investment Banking Analyst"), why_useful (concrete 1–2 sentence explanation), where_to_find (array of 2–3 platforms or methods like ["LinkedIn", "Alumni network", "On-campus recruiting"]).

3. contact_suggestions: ${wantPublicProfiles
  ? `3–5 well-known professionals relevant to "${path.path_name}". CRITICAL RULES: (a) Only include people you are highly confident about based on their public professional reputation (b) Do NOT include any LinkedIn URLs or profile links — these will be generated safely as search queries by the app (c) Include the specific organization they are known to work at (d) Do NOT invent email addresses or phone numbers (e) If you are not highly confident about the person's current role, use an archetype instead (f) Set is_archetype: false. Each must have: name, role, organization, why_relevant, context.`
  : `3–5 useful contact ARCHETYPES formatted as contact suggestions (not real people). Each must have: archetype_title, why_relevant, context. Set is_archetype: true. Do NOT include real people's names.`
}

4. message_templates: 3 outreach message templates tailored to "${path.path_name}" and the preferred channel (${survey.preferred_channel}). Match the student's networking comfort level (${survey.networking_comfort}). Each must include: label (e.g. "Cold LinkedIn message"), body (complete editable template using [Name], [Your Name], [School] placeholders).

Return only valid JSON. Do not add commentary outside the JSON.`,
        response_json_schema: {
          type: 'object',
          properties: {
            outreach_experiments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  objective: { type: 'string' },
                  why_it_tests_path: { type: 'string' },
                  target_contact_type: { type: 'string' },
                  suggested_contacts: { type: 'string' },
                  timeline: { type: 'string' },
                  deliverable: { type: 'string' },
                  reflection_question: { type: 'string' },
                }
              }
            },
            contact_archetypes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  why_useful: { type: 'string' },
                  where_to_find: { type: 'array', items: { type: 'string' } },
                }
              }
            },
            contact_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  is_archetype: { type: 'boolean' },
                  archetype_title: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  organization: { type: 'string' },
                  why_relevant: { type: 'string' },
                  source_url: { type: 'string' },
                  verified_date: { type: 'string' },
                  context: { type: 'string' },
                }
              }
            },
            message_templates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  body: { type: 'string' },
                }
              }
            },
          }
        }
      });

      setPlan(result);
      setStep('results');
    } catch (e) {
      setError('Failed to generate plan. Please try again.');
      setStep('survey');
    } finally {
      generatingRef.current = false;
    }
  };

  const title = {
    survey: 'Build Outreach Plan',
    generating: 'Building Your Outreach Plan…',
    results: 'Your Outreach Plan',
  }[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#050816]">{title}</h2>
          {step !== 'generating' && (
            <button onClick={onClose} aria-label="Close"><X size={20} className="text-[#64748B]" /></button>
          )}
        </div>

        {step !== 'generating' && (
          <p className="text-sm text-[#64748B] mb-5">
            {step === 'survey'
              ? `Personalize your outreach plan for ${path.path_name}.`
              : `Tailored outreach strategy for ${path.path_name}.`}
          </p>
        )}

        {error && (
          <div className="mb-4 rounded-xl p-3 bg-red-50 text-red-700 text-sm flex items-center gap-2" role="alert">
            <AlertTriangle size={14} />{error}
          </div>
        )}

        {step === 'survey' && (
          <SurveyStep
            pathName={path.path_name}
            survey={survey}
            setSurvey={setSurvey}
            onNext={generate}
            onClose={onClose}
          />
        )}

        {step === 'generating' && (
          <div className="py-16 flex flex-col items-center gap-4 text-center">
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--brand-navy-900)' }} />
            <p className="font-heading text-lg font-bold text-[#050816]">Generating your personalized outreach plan…</p>
            <p className="text-sm text-[#64748B] max-w-sm">
              Building outreach experiments, contact archetypes, and message templates tailored to {path.path_name}.
            </p>
          </div>
        )}

        {step === 'results' && plan && (
          <ResultsStep
            plan={plan}
            pathName={path.path_name}
            experimentId={experiment?.id}
            experiments={experiments}
            onContactSaved={onContactSaved}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}