import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { OUTREACH_FORMATS, draftOutreach } from '@/lib/outreach';
import { outreachDrafted } from '@/lib/analytics/human-reality-events';

/**
 * The message. Personalised to this student, this Path, this unknown and this
 * person's role, because "can I pick your brain?" is the message that gets
 * ignored and teaches the student nothing about how to ask.
 */
export default function OutreachDraft({ contact, path, brief, studentName, university, onDrafted }) {
  const [format, setFormat] = useState(contact?.outreach_format || 'linkedin');
  const [copied, setCopied] = useState(false);

  const draft = useMemo(() => draftOutreach({
    format,
    contact,
    pathName: path?.path_name,
    topicId: brief?.topic_id,
    question: brief?.learning,
    studentName,
    university,
  }), [format, contact, path, brief, studentName, university]);

  const text = draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;

  useEffect(() => {
    outreachDrafted({ pathId: path?.id, stage: brief?.topic_id });
    base44.entities.OutreachContacts.update(contact.id, {
      suggested_message: text,
      outreach_format: format,
      outreach_status: contact.outreach_status === 'identified' ? 'outreach_drafted' : contact.outreach_status,
    }).then(onDrafted).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  const copy = async () => {
    await navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="app-card p-6 sm:p-8">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Your message</h2>
      <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
        Edit it however you like. It says what you are testing and why you asked them in particular.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {OUTREACH_FORMATS.map(f => (
          <button key={f.id} type="button" onClick={() => setFormat(f.id)}
            className="touch-target tp-control rounded-full px-4 py-2"
            style={format === f.id
              ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)' }
              : { background: 'var(--ink-100)', color: 'var(--text-secondary)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {draft.subject && (
        <p className="tp-body mt-4" style={{ color: 'var(--ink-900)' }}>
          <span className="tp-label" style={{ color: 'var(--ink-500)' }}>Subject </span>{draft.subject}
        </p>
      )}
      <p className="app-inset tp-body mt-3 whitespace-pre-wrap p-4" style={{ background: 'var(--ink-50)', color: 'var(--ink-700)' }}>
        {draft.body}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={copy} className="ui-press app-cta tp-control">
          {copied ? <><Check size={16} aria-hidden="true" /> Copied</> : <><Copy size={16} aria-hidden="true" /> Copy the message</>}
        </button>
        {contact.profile_url && (
          <a href={contact.profile_url} target="_blank" rel="noopener noreferrer" className="app-cta-secondary tp-control">
            Open their profile <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
      <p className="tp-meta mt-3" style={{ color: 'var(--text-muted)' }}>
        {OUTREACH_FORMATS.find(f => f.id === format)?.limit} Send it yourself, from your own account.
      </p>
    </section>
  );
}