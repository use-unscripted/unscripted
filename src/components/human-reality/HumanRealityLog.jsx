import { useEffect, useState } from 'react';
import {
  CHANGED_EXPECTATION_OPTIONS,
  HUMAN_REALITY_SOURCES,
  REPRESENTATIVENESS_OPTIONS,
  saveConversation,
} from '@/lib/human-reality';
import { INTERACTION_TYPES, exposureLevelFor } from '@/lib/outreach';
import { humanEvidenceStarted } from '@/lib/analytics/human-reality-events';

const field = { border: '1px solid var(--border-light)', color: 'var(--ink-900)' };

function Label({ children, htmlFor }) {
  return <label htmlFor={htmlFor} className="tp-label block" style={{ color: 'var(--ink-500)' }}>{children}</label>;
}

const dimLabel = (id) => id.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

/**
 * Human Evidence.
 *
 * The conversation happened; this is what it taught the student. Everything
 * Unscripted already knows is carried in and never re-asked: the Path, the
 * unknown, the contact, the date, the dimensions. What the student has to
 * supply is what they learned, what is still unknown, and how far one person's
 * account can be taken.
 */
export default function HumanRealityLog({ brief, path, cycleId, uncertainty, questions, contact, experimentId, onSaved }) {
  const [form, setForm] = useState({
    source_type: contact?.how_known && HUMAN_REALITY_SOURCES.some(s => s.id === contact.how_known) ? contact.how_known : 'own_connection',
    interaction_type: 'direct_conversation',
    professional_role: contact?.role || '',
    professional_organisation: contact?.company || '',
    conversation_date: new Date().toISOString().slice(0, 10),
    conversation_format: 'call',
    notes: '',
    key_learning: '',
    surprised_by: '',
    remaining_unknown: '',
    representativeness: '',
    changed_expectation: '',
    changed_expectation_note: '',
  });
  const [dimensions, setDimensions] = useState(brief?.dimensions || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    humanEvidenceStarted({ pathId: path?.id, cycleId, stage: brief?.topic_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDim = (id) => setDimensions(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]));
  const ready = form.professional_role.trim() && form.key_learning.trim() && form.changed_expectation && form.representativeness;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await saveConversation({
        ...form,
        exposure_level: exposureLevelFor(form.interaction_type),
        contact_id: contact?.id || undefined,
        experiment_id: experimentId || undefined,
        path_id: path?.id,
        path_name: path?.path_name,
        cycle_id: cycleId || undefined,
        career_cycle_id: cycleId || undefined,
        uncertainty_id: uncertainty?.variable || undefined,
        uncertainty_label: uncertainty?.label || undefined,
        uncertainty_question: brief?.learning || undefined,
        topic_id: brief?.topic_id,
        topic_label: brief?.topic_label,
        decision_dimension_ids: dimensions,
        questions_planned: brief?.questions || [],
        questions_asked: questions,
      }, { path, contact });
      onSaved(saved);
    } catch (err) {
      setError(err?.message || 'We could not save that just now.');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="app-card space-y-5 p-6 sm:p-8">
      <div>
        <h2 className="tp-section" style={{ color: 'var(--ink-900)' }}>Human Evidence</h2>
        <p className="tp-body mt-2" style={{ color: 'var(--text-secondary)' }}>
          {brief?.learning
            ? `What you were trying to learn: ${brief.learning}`
            : 'Record this after the conversation.'} Your notes stay private to you.
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
          <Label htmlFor="hr-interaction">What kind of interaction it was</Label>
          <select id="hr-interaction" value={form.interaction_type} onChange={e => set('interaction_type', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field}>
            {INTERACTION_TYPES.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
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
        <Label htmlFor="hr-learning">What did you learn?</Label>
        <textarea id="hr-learning" rows={3} value={form.key_learning} onChange={e => set('key_learning', e.target.value)}
          placeholder="What did they say that you could not have worked out from an experiment?"
          className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
      </div>

      <div>
        <Label htmlFor="hr-surprised">What surprised you? (optional)</Label>
        <textarea id="hr-surprised" rows={2} value={form.surprised_by} onChange={e => set('surprised_by', e.target.value)}
          className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
      </div>

      <div>
        <Label htmlFor="hr-notes">Notes from the conversation (optional)</Label>
        <textarea id="hr-notes" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)}
          className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
      </div>

      <fieldset>
        <legend className="tp-label" style={{ color: 'var(--ink-500)' }}>Did this change your expectation?</legend>
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

      {form.changed_expectation === 'changed_what_i_expected' && (
        <div>
          <Label htmlFor="hr-changed-note">What changed?</Label>
          <textarea id="hr-changed-note" rows={2} value={form.changed_expectation_note}
            onChange={e => set('changed_expectation_note', e.target.value)}
            className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
        </div>
      )}

      {/* Suggested from the unknown this conversation was aimed at, and editable:
          the student knows what was actually discussed better than we do. */}
      {(brief?.dimensions || []).length > 0 && (
        <fieldset>
          <legend className="tp-label" style={{ color: 'var(--ink-500)' }}>What did this help you understand?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(brief.dimensions || []).map(id => (
              <label key={id} className="touch-target app-card-flat flex cursor-pointer items-center gap-2 px-3.5 py-2.5"
                style={dimensions.includes(id) ? { borderColor: 'var(--brand-navy-700)' } : undefined}>
                <input type="checkbox" checked={dimensions.includes(id)} onChange={() => toggleDim(id)} className="h-4 w-4" />
                <span className="tp-body" style={{ color: 'var(--ink-700)' }}>{dimLabel(id)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <Label htmlFor="hr-remaining">What is still unknown?</Label>
        <textarea id="hr-remaining" rows={2} value={form.remaining_unknown} onChange={e => set('remaining_unknown', e.target.value)}
          placeholder="What you would still have to experience yourself to know"
          className="tp-body mt-1.5 w-full rounded-[var(--r-control)] px-3 py-3" style={field} />
      </div>

      <fieldset>
        <legend className="tp-label" style={{ color: 'var(--ink-500)' }}>
          How confident are you that their experience represents this career more broadly?
        </legend>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {REPRESENTATIVENESS_OPTIONS.map(o => (
            <label key={o.id} className="touch-target app-card-flat flex cursor-pointer items-center gap-3 p-3.5"
              style={form.representativeness === o.id ? { borderColor: 'var(--brand-navy-700)' } : undefined}>
              <input type="radio" name="hr-rep" value={o.id} checked={form.representativeness === o.id}
                onChange={() => set('representativeness', o.id)} className="h-4 w-4 shrink-0" />
              <span className="tp-body" style={{ color: 'var(--ink-700)' }}>{o.label}</span>
            </label>
          ))}
        </div>
        <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
          One professional is never the whole career, so we record how far this goes rather than assuming.
        </p>
      </fieldset>

      {error && <p className="tp-body" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      <button type="submit" disabled={!ready || busy} className="ui-press app-cta tp-control"
        style={!ready || busy ? { opacity: 0.55 } : undefined}>
        {busy ? 'Recording\u2026' : 'Record this as human evidence'}
      </button>
      {!ready && (
        <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
          Their role, what you learned, whether it changed your expectations, and how far it goes are what make this evidence.
        </p>
      )}
    </form>
  );
}