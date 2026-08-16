import { useState } from 'react';
import { Lock } from 'lucide-react';
import { HOW_KNOWN, saveContact } from '@/lib/outreach';

const field = { border: '1px solid var(--border-light)', color: 'var(--ink-900)' };
const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="tp-label block" style={{ color: 'var(--ink-500)' }}>{children}</label>
);

/**
 * The contact. Only the role is required: a student who spoke to somebody at a
 * panel and knows nothing but "second-year analyst" can still record evidence,
 * and demanding an email address is how this feature turns into a CRM.
 */
export default function ContactForm({ brief, path, uncertainty, questions, existing, onSaved }) {
  const [form, setForm] = useState({
    name: existing?.name || '',
    role: existing?.role || '',
    company: existing?.company || '',
    industry: existing?.industry || '',
    how_known: existing?.how_known || 'own_connection',
    email: existing?.email || '',
    profile_url: existing?.profile_url || '',
    other_contact_method: existing?.other_contact_method || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.role.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await saveContact({
        ...form,
        path_id: path?.id,
        path_name: path?.path_name,
        cycle_id: path?.cycle_id || undefined,
        uncertainty_id: uncertainty?.variable || undefined,
        uncertainty_label: uncertainty?.label || undefined,
        topic_id: brief?.topic_id,
        topic_label: brief?.topic_label,
        decision_dimension_ids: brief?.dimensions || [],
        questions_to_ask: questions || [],
        reason_for_contact: brief?.learning || undefined,
        contact_type: 'informational_interview',
        outreach_status: existing?.outreach_status || 'identified',
      }, { id: existing?.id });
      onSaved(saved);
    } catch (err) {
      setError(err?.message || 'We could not save that just now.');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="app-card space-y-5 p-6 sm:p-8">
      <div>
        <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Who you are speaking with</h2>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          Their role is the only part we need. This person is the source of the evidence, not the evidence itself.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="oc-role">Their role</Label>
          <input id="oc-role" value={form.role} onChange={e => set('role', e.target.value)}
            placeholder="Second-year analyst, healthcare team"
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
        <div>
          <Label htmlFor="oc-name">Their name (optional)</Label>
          <input id="oc-name" value={form.name} onChange={e => set('name', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
        <div>
          <Label htmlFor="oc-org">Where they work (optional)</Label>
          <input id="oc-org" value={form.company} onChange={e => set('company', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
        <div>
          <Label htmlFor="oc-industry">Industry (optional)</Label>
          <input id="oc-industry" value={form.industry} onChange={e => set('industry', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="oc-known">How you know them</Label>
          <select id="oc-known" value={form.how_known} onChange={e => set('how_known', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field}>
            {HOW_KNOWN.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="app-inset p-4" style={{ background: 'var(--ink-50)' }}>
        <legend className="tp-label flex items-center gap-1.5 px-1" style={{ color: 'var(--ink-500)' }}>
          <Lock size={12} aria-hidden="true" /> How to reach them, if you have it
        </legend>
        <p className="tp-meta" style={{ color: 'var(--text-muted)' }}>
          Optional, and private to you. Nobody else, including your university, ever sees these.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input aria-label="Email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email"
            className="tp-body w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
          <input aria-label="LinkedIn URL" value={form.profile_url} onChange={e => set('profile_url', e.target.value)} placeholder="LinkedIn URL"
            className="tp-body w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
          <input aria-label="Another way to reach them" value={form.other_contact_method} onChange={e => set('other_contact_method', e.target.value)}
            placeholder="Another way" className="tp-body w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
      </fieldset>

      {error && <p className="tp-body" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      <button type="submit" disabled={!form.role.trim() || busy} className="ui-press app-cta tp-control"
        style={!form.role.trim() || busy ? { opacity: 0.55 } : undefined}>
        {busy ? 'Saving\u2026' : existing ? 'Save changes' : 'Save this contact'}
      </button>
    </form>
  );
}