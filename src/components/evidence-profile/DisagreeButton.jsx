import { useState } from 'react';
import { Flag, Check, Loader2 } from 'lucide-react';
import { flagDisagreement } from '@/lib/evidence-profile';

/**
 * "This doesn't feel accurate."
 * Recording a disagreement never erases the evidence behind a conclusion. It is
 * kept next to it, to be settled by what the student does next.
 */
export default function DisagreeButton({ type, conclusionKey, label, alreadyFlagged }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(!!alreadyFlagged);

  if (done) {
    return (
      <p className="tp-meta flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ink-500)' }}>
        <Check size={12} /> You flagged this as not feeling accurate. We kept the evidence and will test it again.
      </p>
    );
  }

  const submit = async () => {
    setSaving(true);
    await flagDisagreement({ conclusion_type: type, conclusion_key: conclusionKey, conclusion_label: label, note }).catch(() => null);
    setSaving(false);
    setDone(true);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="tp-meta touch-reach flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--ink-500)' }}>
        <Flag size={12} /> This doesn&rsquo;t feel accurate
      </button>
    );
  }

  return (
    <div className="rounded-[var(--r-control)] border p-3" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}>
      <p className="tp-meta font-semibold" style={{ color: 'var(--ink-700)' }}>
        Tell us what feels off. Nothing gets deleted, and we will test this again.
      </p>
      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Optional. What does not match your experience?"
        className="mt-2 w-full rounded-[var(--r-control)] border bg-white px-3 py-2 text-base outline-none md:text-sm"
        style={{ borderColor: 'var(--ink-200)' }} />
      <div className="mt-2 flex gap-2">
        <button onClick={submit} disabled={saving}
          className="tp-meta touch-target flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--brand-navy-900)' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />} Record this
        </button>
        <button onClick={() => setOpen(false)}
          className="tp-meta touch-target rounded-lg border px-3 py-2 font-semibold"
          style={{ borderColor: 'var(--ink-200)', color: 'var(--ink-700)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}