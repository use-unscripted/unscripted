/**
 * The person the student actually spoke with, recorded from inside the step.
 *
 * Same OutreachContacts records the rest of the app uses, saved through
 * saveMissionOutreach, so a contact added here is the same contact the outreach
 * list, the evidence library and the "who did you talk to" blocker all read.
 * A mission is optional: when the guide has no mission, the record still carries
 * user + cycle + path + experiment.
 */
import { useState } from 'react';
import FieldSelect from '@/components/ui/FieldSelect';
import { saveMissionOutreach } from '@/lib/mission-outreach';

const TYPES = [
  { value: 'informational_interview', label: 'Informational conversation' },
  { value: 'industry_professional', label: 'Industry professional' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'founder', label: 'Founder' },
  { value: 'networking', label: 'Other contact' },
];

const STATUSES = [
  { value: 'responded', label: 'We spoke' },
  { value: 'contacted', label: 'I reached out, no reply yet' },
  { value: 'planned', label: 'I plan to reach out' },
];

const field = { borderColor: 'var(--border-light)', background: '#fff' };

export default function StepContactForm({ mission, experiment, path, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: '', role: '', company: '', profile_url: '',
    contact_type: 'informational_interview', status: 'responded', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const input = (name, label, placeholder) => (
    <label className="block">
      <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <input
        value={form[name]}
        onChange={e => set(name)(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm"
        style={field}
      />
    </label>
  );

  const save = async () => {
    if (busy) return;
    if (!form.name.trim() && !form.role.trim()) {
      setError('Add either their name or the role they hold.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveMissionOutreach({
        mission, experiment, path,
        contact: {
          ...form,
          archetype: form.role || mission?.outreach_archetype,
          purpose: mission?.outreach_purpose,
        },
      });
      await onSaved();
    } catch {
      setError('We could not save that. Nothing was half-saved. Press save again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2.5">
      {input('name', 'Their name', 'Leave blank if you only know the role')}
      {input('role', 'Their role', 'Investment analyst, product manager…')}
      {input('company', 'Company or organisation', 'Optional')}
      {input('profile_url', 'Profile link', 'Optional, only if you have it')}

      <label className="block">
        <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Kind of contact</span>
        <FieldSelect
          className="mt-1"
          ariaLabel="Kind of contact"
          value={form.contact_type}
          onChange={set('contact_type')}
          options={TYPES}
        />
      </label>

      <label className="block">
        <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Where this stands</span>
        <FieldSelect
          className="mt-1"
          ariaLabel="Where this stands"
          value={form.status}
          onChange={set('status')}
          options={STATUSES}
        />
      </label>

      <label className="block">
        <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>What you discussed</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={e => set('notes')(e.target.value)}
          placeholder="What you asked, what they said, anything that surprised you…"
          className="mt-1 w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm"
          style={field}
        />
      </label>

      {error && <p className="tp-body font-semibold" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="tp-body rounded-[var(--r-control)] border px-5 font-semibold"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}>
            Cancel
          </button>
        )}
        <button type="button" onClick={save} disabled={busy}
          className="ui-press tp-body rounded-[var(--r-control)] px-5 font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
          {busy ? 'Saving…' : 'Save this contact'}
        </button>
      </div>
    </div>
  );
}