import { useState } from 'react';
import { CHANGED_EXPECTATION_OPTIONS, HUMAN_REALITY_SOURCES, saveConversation } from '@/lib/human-reality';

const field = { border: '1px solid var(--border-light)', color: 'var(--ink-900)' };

function Label({ children, htmlFor }) {
  return <label htmlFor={htmlFor} className="tp-label block" style={{ color: 'var(--ink-500)' }}>{children}</label>;
}

/**
 * What the student learned, recorded as human evidence.
 *
 * Key learning and changed expectation are the reflection step of this
 * experiment type: a conversation with no learning written down is not evidence,
 * so the record cannot be saved without one.
 */
export default function HumanRealityLog({ brief, path, cycleId, uncertainty, questions, onSaved }) {
  const [form, setForm] = useState({
    source_type: 'own_connection',
    professional_role: '',
    professional_organisation: '',
    conversation_date: new Date().toISOString().slice(0, 10),
    conversation_format: 'call',
    notes: '',
    key_learning: '',
    changed_expectation: '',
    changed_expectation_note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const ready = form.professional_role.trim() && form.key_learning.trim() && form.changed_expectation;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await saveConversation({
        ...form,
        path_id: path?.id,
        path_name: path?.path_name,
        cycle_id: cycleId || undefined,
        career_cycle_id: cycleId || undefined,
        uncertainty_id: uncertainty?.variable || undefined,
        uncertainty_label: uncertainty?.label || undefined,
        uncertainty_question: brief?.learning || undefined,
        topic_id: brief?.topic_id,
        topic_label: brief?.topic_label,
        decision_dimension_ids: brief?.dimensions || [],
        questions_asked: questions,
      }, { path });
      onSaved(saved);
    } catch (err) {
      setError(err?.message || 'We could not save that just now.');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="app-card space-y-5 p-6 sm:p-8">
      <div>
        <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>What you learned</h2>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          Record this after the conversation. Your notes stay private to you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="hr-source">How you found them</Label>
          <select id="hr-source" value={form.source_type} onChange={e => set('source_type', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field}>
            {HUMAN_REALITY_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="hr-role">Their role</Label>
          <input id="hr-role" value={form.professional_role} onChange={e => set('professional_role', e.target.value)}
            placeholder="Second-year analyst, healthcare team"
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
        <div>
          <Label htmlFor="hr-org">Where they work (optional)</Label>
          <input id="hr-org" value={form.professional_organisation} onChange={e => set('professional_organisation', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
        <div>
          <Label htmlFor="hr-date">When you spoke</Label>
          <input id="hr-date" type="date" value={form.conversation_date} onChange={e => set('conversation_date', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
      </div>

      <div>
        <Label htmlFor="hr-learning">The most important thing you learned</Label>
        <textarea id="hr-learning" rows={3} value={form.key_learning} onChange={e => set('key_learning', e.target.value)}
          placeholder="What did they say that you could not have worked out from an experiment?"
          className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
      </div>

      <div>
        <Label htmlFor="hr-notes">Notes from the conversation (optional)</Label>
        <textarea id="hr-notes" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)}
          className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
      </div>

      <fieldset>
        <legend className="tp-label" style={{ color: 'var(--ink-500)' }}>Did it change what you expected?</legend>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {CHANGED_EXPECTATION_OPTIONS.map(o => (
            <label key={o.id} className="touch-target app-card-flat flex cursor-pointer items-center gap-3 p-3.5"
              style={form.changed_expectation === o.id ? { borderColor: 'var(--brand-navy-700)' } : undefined}>
              <input type="radio" name="hr-changed" value={o.id} checked={form.changed_expectation === o.id}
                onChange={() => set('changed_expectation', o.id)} className="h-4 w-4 shrink-0" />
              <span className="tp-body" style={{ color: 'var(--ink-700)' }}>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="hr-changed-note">What changed, in your words (optional)</Label>
        <textarea id="hr-changed-note" rows={2} value={form.changed_expectation_note}
          onChange={e => set('changed_expectation_note', e.target.value)}
          className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
      </div>

      {error && <p className="tp-body" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      <button type="submit" disabled={!ready || busy} className="ui-press app-cta tp-control"
        style={!ready || busy ? { opacity: 0.55 } : undefined}>
        {busy ? 'Recording\u2026' : 'Record this as human evidence'}
      </button>
      {!ready && (
        <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
          Their role, what you learned, and whether it changed your expectations are what make this evidence.
        </p>
      )}
    </form>
  );
}