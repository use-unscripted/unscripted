/**
 * Notes that live on the experiment itself, so a student doesn't keep them
 * somewhere the rest of the workflow can't see.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function ExperimentNotesPanel({ experiment }) {
  const [value, setValue] = useState(experiment.notes || '');
  const [state, setState] = useState('idle');

  const save = async () => {
    if (value === (experiment.notes || '') || state === 'saving') return;
    setState('saving');
    await base44.entities.Experiments.update(experiment.id, { notes: value });
    experiment.notes = value;
    setState('saved');
  };

  return (
    <section className="rounded-[16px] bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-bold" style={{ color: 'var(--text-primary)' }}>Notes</h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}
        </span>
      </div>
      <textarea
        rows={4}
        value={value}
        onChange={e => { setValue(e.target.value); setState('idle'); }}
        onBlur={save}
        placeholder="Anything you want to remember about this experiment…"
        className="mt-3 w-full rounded-[10px] border px-3 py-2.5 text-base md:text-sm outline-none"
        style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
      />
    </section>
  );
}