/**
 * Outreach, inside the mission that requires it. Never a separate CRM.
 * Links are either a confirmed direct profile or a LinkedIn search — we never
 * invent an /in/ URL.
 */
import { useState } from 'react';
import { ExternalLink, ShieldCheck, Search, Plus } from 'lucide-react';
import { outreachLink, OUTREACH_STATUSES, uiStatusOf } from '@/lib/linkedin';
import { saveMissionOutreach, setOutreachStatus, setOutreachNotes } from '@/lib/mission-outreach';

function StatusRow({ contact, onChange }) {
  const current = uiStatusOf(contact.response_status);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {OUTREACH_STATUSES.map(s => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={current === s.key
            ? { background: 'var(--brand-navy-900)', color: '#fff' }
            : { background: '#fff', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function ContactCard({ contact, onStatus, onNotes }) {
  const link = outreachLink(contact);
  const questions = contact.questions_to_ask || [];
  return (
    <div className="rounded-[12px] p-4" style={{ background: '#fff', border: '1px solid var(--border-light)' }}>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{contact.name}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {[contact.role || contact.archetype, contact.company].filter(Boolean).join(' · ')}
      </p>

      <a href={link.href} target="_blank" rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand-navy-700)' }}>
        {link.verified ? <ShieldCheck size={13} /> : <Search size={13} />} {link.label} <ExternalLink size={11} />
      </a>

      {contact.reason_for_contact && (
        <p className="mt-2 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
          <strong>Purpose:</strong> {contact.reason_for_contact}
        </p>
      )}
      {contact.suggested_message && (
        <p className="mt-2 rounded-[8px] p-2 text-xs leading-5" style={{ background: 'var(--background-secondary)', color: 'var(--text-secondary)' }}>
          {contact.suggested_message}
        </p>
      )}
      {questions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {questions.map((q, i) => (
            <li key={i} className="text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>· {q}</li>
          ))}
        </ul>
      )}

      <StatusRow contact={contact} onChange={onStatus} />

      <textarea
        rows={2}
        defaultValue={contact.notes || ''}
        onBlur={e => onNotes(e.target.value)}
        placeholder="Notes from the conversation…"
        className="mt-3 w-full rounded-[8px] border px-2.5 py-2 text-xs outline-none"
        style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
      />
    </div>
  );
}

export default function MissionOutreachPanel({ mission, experiment, path, contacts, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', company: '', profile_url: '', profile_verified: false });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveMissionOutreach({
        mission, experiment, path,
        contact: { ...form, archetype: mission.outreach_archetype, purpose: mission.outreach_purpose, status: 'planned' },
      });
      setForm({ name: '', role: '', company: '', profile_url: '', profile_verified: false });
      setAdding(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const field = (name, placeholder) => (
    <input
      key={name}
      value={form[name]}
      onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
      placeholder={placeholder}
      className="w-full rounded-[8px] border px-2.5 py-2 text-xs outline-none"
      style={{ borderColor: 'var(--border-light)', background: '#fff' }}
    />
  );

  return (
    <div className="mt-4 rounded-[12px] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
      <p className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--brand-navy-700)' }}>
        Outreach required for this mission
      </p>
      {mission.outreach_archetype && (
        <p className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
          Who to contact: <strong>{mission.outreach_archetype}</strong>
        </p>
      )}
      {mission.outreach_purpose && (
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>{mission.outreach_purpose}</p>
      )}

      <div className="mt-3 space-y-2">
        {contacts.map(c => (
          <ContactCard
            key={c.id}
            contact={c}
            onStatus={async (s) => { await setOutreachStatus(c, s); await onChanged(); }}
            onNotes={async (notes) => { if (notes !== (c.notes || '')) { await setOutreachNotes(c, notes); await onChanged(); } }}
          />
        ))}
        {contacts.length === 0 && !adding && (
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
            No one added yet. Add the person (or the role) you plan to speak with.
          </p>
        )}
      </div>

      {adding ? (
        <div className="mt-3 space-y-2">
          {field('name', 'Name (leave blank to search by role)')}
          {field('role', 'Role')}
          {field('company', 'Company')}
          {field('profile_url', 'LinkedIn profile URL, only if you have confirmed it')}
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={form.profile_verified}
              onChange={e => setForm(f => ({ ...f, profile_verified: e.target.checked }))}
            />
            I confirmed this profile is the right person
          </label>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 rounded-[8px] border py-2 text-xs font-semibold"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}>Cancel</button>
            <button onClick={add} disabled={busy}
              className="flex-1 rounded-[8px] py-2 text-xs font-bold text-white disabled:opacity-60"
              style={{ background: 'var(--brand-navy-900)' }}>{busy ? 'Saving…' : 'Save contact'}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand-navy-700)' }}>
          <Plus size={13} /> Add someone to contact
        </button>
      )}
    </div>
  );
}