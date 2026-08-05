import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ShieldCheck, Check } from 'lucide-react';
import { extractResumeDraft } from '@/lib/evidence-library';

const field = 'w-full rounded-xl border border-[color:var(--ink-200)] px-3 py-2 text-base md:text-sm text-[color:var(--ink-700)] outline-none focus:border-[color:var(--brand-navy-900)]';
const listToText = (a) => (a || []).join(', ');
const textToList = (t) => t.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Steps 3 and 4 of the resume workflow: the student reviews what was extracted
 * from their own submission and approves only what is accurate. Nothing here is
 * generated. Every prefilled value came from a field the student filled in.
 */
export default function ResumeApprovalModal({ item, onClose, onSaved }) {
  const draft0 = extractResumeDraft(item);
  const [form, setForm] = useState({
    ...draft0,
    approved_skills: listToText(draft0.approved_skills),
    approved_tools: listToText(draft0.approved_tools),
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (status) => {
    setSaving(true);
    try {
      await base44.entities.ProofOfWork.update(item.id, {
        resume_status: status,
        approved_title: form.approved_title.trim(),
        approved_deliverable: form.approved_deliverable.trim(),
        approved_bullet: form.approved_bullet.trim(),
        approved_skills: textToList(form.approved_skills),
        approved_tools: textToList(form.approved_tools),
        approved_link: form.approved_link.trim(),
        resume_reviewed_at: new Date().toISOString(),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="anim-modal my-8 w-full max-w-lg rounded-[24px] bg-white p-6">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="tp-eyebrow mb-1.5" style={{ color: 'var(--brand-navy-700)' }}>Review for your resume</p>
            <h2 className="tp-section text-[color:var(--surface-dark-900)]">{item.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} className="text-[color:var(--ink-400)]" /></button>
        </div>

        <div className="my-4 flex gap-2 rounded-xl p-3" style={{ background: 'var(--background-tertiary)' }}>
          <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
          <p className="tp-meta text-[color:var(--ink-700)]">
            These details come only from what you submitted. Nothing is invented: no employers, job titles, metrics,
            results, certifications or dates are added for you. Edit anything that is not accurate, then approve.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="tp-meta mb-1.5 block font-bold text-[color:var(--ink-700)]">Project title</span>
            <input value={form.approved_title} onChange={set('approved_title')} className={field} />
          </label>
          <label className="block">
            <span className="tp-meta mb-1.5 block font-bold text-[color:var(--ink-700)]">Deliverable</span>
            <input value={form.approved_deliverable} onChange={set('approved_deliverable')} placeholder="What you actually produced" className={field} />
          </label>
          <label className="block">
            <span className="tp-meta mb-1.5 block font-bold text-[color:var(--ink-700)]">Accomplishment bullet</span>
            <textarea value={form.approved_bullet} onChange={set('approved_bullet')} rows={3}
              placeholder="One line in your own words, only what you did." className={field} />
          </label>
          <label className="block">
            <span className="tp-meta mb-1.5 block font-bold text-[color:var(--ink-700)]">Skills demonstrated</span>
            <input value={form.approved_skills} onChange={set('approved_skills')} placeholder="Comma separated" className={field} />
          </label>
          <label className="block">
            <span className="tp-meta mb-1.5 block font-bold text-[color:var(--ink-700)]">Tools used</span>
            <input value={form.approved_tools} onChange={set('approved_tools')} placeholder="Comma separated" className={field} />
          </label>
          <label className="block">
            <span className="tp-meta mb-1.5 block font-bold text-[color:var(--ink-700)]">Public project link (optional)</span>
            <input value={form.approved_link} onChange={set('approved_link')} placeholder="https://…" className={field} />
            <span className="tp-meta mt-1.5 block text-[color:var(--ink-400)]">Uploaded files stay private. Only a link you paste here can appear on a resume.</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => save('approved')} disabled={saving || !form.approved_title.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--brand-navy-900)' }}>
            <Check size={14} /> {saving ? 'Saving…' : 'Approve for resume'}
          </button>
          <button onClick={() => save('excluded')} disabled={saving}
            className="rounded-[10px] border border-[color:var(--ink-200)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
            Keep off my resume
          </button>
        </div>
        <p className="tp-meta mt-3 text-center text-[color:var(--ink-400)]">Approving does not add anything to a resume. You choose when to import it.</p>
      </div>
    </div>
  );
}