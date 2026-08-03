import { useState, useRef, useEffect } from 'react';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { linksForExperiment } from '@/lib/career-cycle';
import { trackPilotEvent } from '@/lib/pilot-metrics';

const inputCls = 'w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-2.5 text-sm outline-none focus:border-[color:var(--brand-navy-900)]';

const CONTACT_TYPES = [
  ['informational_interview','Informational Interview'],['networking','Networking Contact'],
  ['mentor','Mentor'],['recruiter','Recruiter'],['alumni','Alumni'],
  ['industry_professional','Industry Professional'],['founder','Founder'],
  ['investor','Investor'],['potential_customer','Potential Customer'],
  ['potential_partner','Potential Partner'],['other','Other'],
];

const STATUS_OPTIONS = [
  ['not_sent','Not contacted'],['planning','Planning outreach'],['sent','Contacted'],
  ['follow_up_needed','Follow-up needed'],['call_scheduled','Meeting scheduled'],
  ['responded','Conversation completed'],['no_response','No response'],
  ['completed','Closed'],['other','Other'],
];

const EXP_STATUS_LABELS = { draft:'Draft', planned:'Planned', in_progress:'In Progress', completed:'Completed', skipped:'Skipped' };

function isValidPhone(val) {
  if (!val.trim()) return true;
  const digits = val.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isValidEmail(val) {
  if (!val.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isValidUrl(val) {
  if (!val.trim()) return true;
  try { new URL(val.startsWith('http') ? val : 'https://' + val); return true; } catch { return false; }
}

// ── Success Toast ──────────────────────────────────────────────────────────────
export function ContactSuccessToast({ contact, experimentTitle, missionTitle, onViewContact, onOpenExperiment, onDismiss }) {
  return (
    <div role="alert" aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] max-w-sm w-full rounded-[20px] bg-white border border-green-100 shadow-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--success-50)' }}>
          <CheckCircle size={20} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[color:var(--surface-dark-900)]">Contact saved successfully.</p>
          <p className="text-xs text-[color:var(--ink-500)] mt-0.5 truncate">{contact.name}</p>
          {experimentTitle && <p className="text-xs text-[color:var(--ink-400)] truncate">Experiment: {experimentTitle}</p>}
          {missionTitle && <p className="text-xs text-[color:var(--ink-400)] truncate">Mission: {missionTitle}</p>}
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)]">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onViewContact} className="flex-1 rounded-[8px] py-2 text-xs font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>View Contact</button>
        <button onClick={onOpenExperiment} className="flex-1 rounded-[8px] border border-[color:var(--ink-200)] py-2 text-xs font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
          Open Experiment
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function AddContactModal({ contact, onClose, onSaved }) {
  const isEdit = !!contact?.id;

  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [data, setData] = useState({
    name: contact?.name || '',
    company: contact?.company || '',
    role: contact?.role || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    profile_url: contact?.profile_url || '',
    website_url: contact?.website_url || '',
    contact_type: contact?.contact_type || 'networking',
    response_status: contact?.response_status || 'not_sent',
    reason_for_contact: contact?.reason_for_contact || '',
    date_contacted: contact?.date_contacted || '',
    last_contacted_date: contact?.last_contacted_date || '',
    followup_date: contact?.followup_date || '',
    notes: contact?.notes || '',
  });

  const [selectedExpId, setSelectedExpId] = useState(contact?.experiment_id || '');
  const [selectedMissionId, setSelectedMissionId] = useState(contact?.mission_id || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Experiments.list('-created_date', 200).catch(() => []),
      base44.entities.Missions.list('-created_date', 200).catch(() => []),
    ]).then(([exps, mis]) => {
      setExperiments(Array.isArray(exps) ? exps : []);
      setMissions(Array.isArray(mis) ? mis : []);
      setLoadingData(false);
    }).catch(() => setLoadingData(false));
  }, []);

  const selectedExp = experiments.find(e => e.id === selectedExpId) || null;
  const expMissions = missions.filter(m => m.experiment_id === selectedExpId);

  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));

  const handleExpChange = (expId) => {
    setSelectedExpId(expId);
    setSelectedMissionId('');
    setErrors(err => ({ ...err, experiment: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!data.name.trim()) errs.name = 'Enter the contact name.';
    if (!selectedExpId) errs.experiment = 'Select the experiment connected to this contact.';
    const hasContact = data.email.trim() || data.phone.trim() || data.profile_url.trim() || data.website_url.trim();
    if (!hasContact) errs.contact_method = 'Enter at least one contact method (email, phone, LinkedIn, or URL).';
    if (data.email.trim() && !isValidEmail(data.email)) errs.email = 'Enter a valid email address.';
    if (data.phone.trim() && !isValidPhone(data.phone)) errs.phone = 'Enter a valid phone number.';
    if (data.profile_url.trim() && !isValidUrl(data.profile_url)) errs.profile_url = 'Enter a valid URL.';
    if (data.website_url.trim() && !isValidUrl(data.website_url)) errs.website_url = 'Enter a valid URL.';
    if (selectedMissionId) {
      const m = missions.find(ms => ms.id === selectedMissionId);
      if (m && m.experiment_id !== selectedExpId) errs.mission = 'This mission does not belong to the selected experiment.';
    }
    return errs;
  };

  const handleSave = async () => {
    if (submittingRef.current) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaveError('');
    submittingRef.current = true;
    setSaving(true);

    try {
      const user = await base44.auth.me();
      const exp = experiments.find(e => e.id === selectedExpId);
      if (!exp) throw new Error('Experiment not found.');

      const payload = {
        user_id: user.id,
        experiment_id: selectedExpId,
        mission_id: selectedMissionId || undefined,
        path_being_tested: exp.path_name || '',
        name: data.name.trim(),
        company: data.company,
        role: data.role,
        email: data.email.trim(),
        phone: data.phone.trim(),
        profile_url: data.profile_url.trim(),
        website_url: data.website_url.trim(),
        contact_type: data.contact_type,
        response_status: data.response_status,
        reason_for_contact: data.reason_for_contact,
        date_contacted: data.date_contacted || undefined,
        last_contacted_date: data.last_contacted_date || undefined,
        followup_date: data.followup_date || undefined,
        notes: data.notes,
        // Cycle / path / experiment / mission relationships, resolved from the
        // experiment this contact belongs to.
        ...(await linksForExperiment(exp, missions.find(m => m.id === selectedMissionId))),
      };

      let saved;
      if (isEdit) {
        await base44.entities.OutreachContacts.update(contact.id, payload);
        saved = { ...contact, ...payload };
      } else {
        saved = await base44.entities.OutreachContacts.create(payload);
      }

      // Measurement: whether outreach was attempted, and whether it turned into
      // a real conversation. Ids and status only — never the notes.
      const links = { cycle_id: payload.cycle_id, path_id: payload.path_id, experiment_id: selectedExpId, mission_id: selectedMissionId || undefined };
      if (!['not_sent', 'planning'].includes(payload.response_status)) {
        await trackPilotEvent('outreach_attempted', { ...links, dedupe_key: saved.id });
      }
      if (['responded', 'completed'].includes(payload.response_status)) {
        await trackPilotEvent('professional_conversation_completed', { ...links, dedupe_key: saved.id });
      }

      const missionTitle = selectedMissionId ? missions.find(m => m.id === selectedMissionId)?.title : null;
      onSaved(saved, exp.title, missionTitle);
    } catch {
      setSaveError('Failed to save contact. Please try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[color:var(--surface-dark-900)]">{isEdit ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose} disabled={saving} aria-label="Close"><X size={20} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <p className="text-sm text-[color:var(--ink-500)] mb-5">{isEdit ? 'Update contact details and linked experiment.' : 'Connect this contact to an experiment and track outreach.'}</p>

        {saveError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{saveError}</div>}

        {loadingData ? (
          <div className="py-10 text-center text-sm text-[color:var(--ink-500)]"><Loader2 size={20} className="animate-spin mx-auto mb-2" />Loading…</div>
        ) : (
          <div className="space-y-4">

            {/* Contact info */}
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Contact Information</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Full name <span className="text-red-500">*</span></label>
                <input name="name" value={data.name} onChange={ch} placeholder="Jane Smith" className={inputCls} />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Company or organization</label>
                <input name="company" value={data.company} onChange={ch} placeholder="Goldman Sachs" className={inputCls} />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Job title</label>
                <input name="role" value={data.role} onChange={ch} placeholder="Analyst, Associate…" className={inputCls} />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Contact type</label>
                <select name="contact_type" value={data.contact_type} onChange={ch} className={inputCls}>
                  {CONTACT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Contact methods */}
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)] pt-1">Contact Methods <span className="normal-case font-normal">(at least one required)</span></p>
            {errors.contact_method && <p className="text-xs text-red-600 -mt-2">{errors.contact_method}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Email</label>
                <input name="email" type="email" value={data.email} onChange={ch} placeholder="jane@company.com" className={inputCls} />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Phone number</label>
                <input name="phone" type="tel" value={data.phone} onChange={ch} placeholder="(203) 555-0148 or +1 203 555 0148" className={inputCls} />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">LinkedIn URL</label>
                <input name="profile_url" value={data.profile_url} onChange={ch} placeholder="linkedin.com/in/janedoe" className={inputCls} />
                {errors.profile_url && <p className="mt-1 text-xs text-red-600">{errors.profile_url}</p>}
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Website or portfolio</label>
                <input name="website_url" value={data.website_url} onChange={ch} placeholder="https://janedoe.com" className={inputCls} />
                {errors.website_url && <p className="mt-1 text-xs text-red-600">{errors.website_url}</p>}
              </div>
            </div>

            {/* Experiment / Path / Mission */}
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)] pt-1">Experiment &amp; Path</p>
            <div>
              <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Experiment <span className="text-red-500">*</span></label>
              {experiments.length === 0
                ? <p className="text-sm text-[color:var(--ink-500)] rounded-xl border border-[color:var(--ink-200)] px-4 py-2.5">No experiments found. Create one first.</p>
                : <select value={selectedExpId} onChange={e => handleExpChange(e.target.value)} className={inputCls}>
                    <option value="">Select an experiment…</option>
                    {experiments.map(exp => (
                      <option key={exp.id} value={exp.id}>
                        {exp.title}{exp.status ? ` (${EXP_STATUS_LABELS[exp.status] || exp.status})` : ''}
                      </option>
                    ))}
                  </select>
              }
              {errors.experiment && <p className="mt-1 text-xs text-red-600">{errors.experiment}</p>}
            </div>

            {selectedExp && (
              <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-0.5">Path</p>
                <p className="text-sm font-semibold text-[color:var(--surface-dark-900)]">
                  {selectedExp.path_name || <span className="text-[color:var(--ink-400)] font-normal">No path connected to this experiment</span>}
                </p>
              </div>
            )}

            {selectedExpId && (
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Mission <span className="text-xs font-normal text-[color:var(--ink-400)]">(optional)</span></label>
                {expMissions.length === 0
                  ? <p className="text-xs text-[color:var(--ink-400)] rounded-xl border border-[color:var(--ink-200)] px-4 py-2.5">No missions are currently linked to this experiment.</p>
                  : <select value={selectedMissionId} onChange={e => setSelectedMissionId(e.target.value)} className={inputCls}>
                      <option value="">No specific mission (overall experiment)</option>
                      {expMissions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                }
                {errors.mission && <p className="mt-1 text-xs text-red-600">{errors.mission}</p>}
              </div>
            )}

            {/* Outreach details */}
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)] pt-1">Outreach Details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Outreach status</label>
                <select name="response_status" value={data.response_status} onChange={ch} className={inputCls}>
                  {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Date first contacted</label>
                <input type="date" name="date_contacted" value={data.date_contacted} onChange={ch} className={inputCls} />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Last contacted</label>
                <input type="date" name="last_contacted_date" value={data.last_contacted_date} onChange={ch} className={inputCls} />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Follow-up date</label>
                <input type="date" name="followup_date" value={data.followup_date} onChange={ch} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Reason for contact</label>
              <textarea rows={2} name="reason_for_contact" value={data.reason_for_contact} onChange={ch}
                placeholder="What specific question can only they answer?" className={inputCls} />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-[color:var(--ink-700)]">Notes</label>
              <textarea rows={2} name="notes" value={data.notes} onChange={ch}
                placeholder="Any context or follow-up notes" className={inputCls} />
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-3 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || loadingData}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {saving
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving…</span>
              : isEdit ? 'Save Changes' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}