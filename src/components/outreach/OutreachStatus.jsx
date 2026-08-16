import { useState } from 'react';
import { STATUS_LABELS, NEXT_STATUS, setOutreachStatus } from '@/lib/outreach';

const ORDER = ['identified', 'outreach_drafted', 'contacted', 'responded', 'conversation_scheduled', 'conversation_completed'];

/**
 * Where this outreach has got to. Four taps at most, and "No response" is a
 * first-class outcome rather than a failure: most outreach goes unanswered, and
 * a student who cannot record that will think they did it wrong.
 */
export default function OutreachStatus({ contact, onChange }) {
  const [busy, setBusy] = useState(false);
  const at = ORDER.indexOf(contact.outreach_status || 'identified');
  const next = NEXT_STATUS[contact.outreach_status || 'identified'];

  const move = async (status) => {
    if (busy) return;
    setBusy(true);
    const updated = await setOutreachStatus(contact, status).catch(() => null);
    if (updated) onChange(updated);
    setBusy(false);
  };

  return (
    <section className="app-card p-6 sm:p-8">
      <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Where this has got to</h2>

      <ol className="mt-4 flex flex-wrap gap-2">
        {ORDER.map((s, i) => (
          <li key={s} className="tp-meta rounded-full px-3 py-1.5 font-semibold"
            style={i <= at
              ? { background: 'var(--brand-navy-900)', color: 'var(--brand-white)' }
              : { background: 'var(--ink-100)', color: 'var(--text-muted)' }}>
            {STATUS_LABELS.get(s)}
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {next && (
          <button type="button" onClick={() => move(next)} disabled={busy} className="ui-press app-cta tp-control">
            {next === 'contacted' ? 'I have sent it' : `Mark as ${STATUS_LABELS.get(next).toLowerCase()}`}
          </button>
        )}
        {contact.outreach_status !== 'conversation_completed' && (
          <button type="button" onClick={() => move('conversation_completed')} disabled={busy} className="app-cta-secondary tp-control">
            We have already spoken
          </button>
        )}
        {['contacted', 'outreach_drafted'].includes(contact.outreach_status) && (
          <button type="button" onClick={() => move('no_response')} disabled={busy} className="app-cta-secondary tp-control">
            No response
          </button>
        )}
      </div>

      {contact.outreach_status === 'no_response' && (
        <p className="tp-body mt-4" style={{ color: 'var(--text-secondary)' }}>
          Most outreach goes unanswered. Ask somebody else the same question, or test something else in the meantime.
        </p>
      )}
    </section>
  );
}