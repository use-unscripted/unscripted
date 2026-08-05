import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Plus, ExternalLink } from 'lucide-react';
import { newEntry } from './resumeTemplates';

/**
 * Step 5 of the resume workflow: import evidence the student has already
 * approved. Only approved records appear, and only their approved wording is
 * used. This component never generates or rewrites anything.
 */
export default function ImportApprovedEvidence({ resume, onAddEntry, onAddSkills }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('activities');
  const [imported, setImported] = useState(new Set());

  // Re-read whenever another resume is opened, so evidence approved since this
  // panel first loaded is offered instead of a stale list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await base44.entities.ProofOfWork.filter({ resume_status: 'approved' }, '-resume_reviewed_at', 50).catch(() => []);
      if (cancelled) return;
      setItems(rows.filter((r) => r.deletion_status !== 'deleted'));
      setImported(new Set());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [resume?.id]);

  const sections = (resume?.content?.sections || []).filter((s) => s.type === 'list');

  const importItem = (p) => {
    const bullets = [p.approved_bullet, p.approved_deliverable && `Deliverable: ${p.approved_deliverable}`,
      p.approved_tools?.length ? `Tools: ${p.approved_tools.join(', ')}` : ''].filter(Boolean);
    onAddEntry(section, {
      ...newEntry(),
      title: p.approved_title || p.title,
      org: p.path_tested || '',
      linkLabel: p.approved_link ? 'Project link' : '',
      linkUrl: p.approved_link || '',
      bullets: bullets.length ? bullets : [''],
    });
    if (p.approved_skills?.length) onAddSkills(p.approved_skills);
    base44.entities.ProofOfWork.update(p.id, { resume_imported_at: new Date().toISOString() }).catch(() => {});
    setImported((s) => new Set([...s, p.id]));
  };

  if (loading) return null;

  return (
    <div className="mb-5 rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={15} style={{ color: 'var(--brand-navy-700)' }} />
        <p className="tp-card text-[color:var(--surface-dark-900)]">Import approved evidence</p>
      </div>
      <p className="tp-prose mb-4 text-[color:var(--ink-500)]">
        Your resume is built from evidence you approved in the Evidence Library. Only your approved wording is imported. Employers, job titles,
        metrics, results and dates are never generated for you.
      </p>

      {items.length === 0 ? (
        <p className="tp-prose text-[color:var(--ink-400)]">
          Nothing approved yet. Open Evidence → Library, review a piece of evidence, and approve what is accurate.
        </p>
      ) : (
        <>
          <label className="tp-meta mb-4 flex items-center gap-2 font-semibold text-[color:var(--ink-700)]">
            Import into
            <select value={section} onChange={(e) => setSection(e.target.value)}
              className="rounded-xl border border-[color:var(--ink-200)] px-3 py-2 text-base md:text-[13px] outline-none focus:border-[color:var(--brand-navy-900)]">
              {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>

          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-[color:var(--ink-200)] p-3">
                <div className="min-w-0 flex-1">
                  <p className="tp-card text-[color:var(--surface-dark-900)]">{p.approved_title || p.title}</p>
                  {p.approved_bullet && <p className="tp-prose mt-1 text-[color:var(--ink-700)]">{p.approved_bullet}</p>}
                  <p className="tp-meta mt-1.5 text-[color:var(--ink-400)]">
                    {[p.path_tested, p.approved_skills?.join(', ')].filter(Boolean).join(' · ')}
                  </p>
                  {p.approved_link && (
                    <a href={p.approved_link} target="_blank" rel="noopener noreferrer"
                      className="tp-meta mt-1.5 inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
                      <ExternalLink size={13} /> Project link
                    </a>
                  )}
                </div>
                <button onClick={() => importItem(p)} disabled={imported.has(p.id)}
                  className="tp-meta shrink-0 rounded-lg px-3.5 py-2 font-bold text-white disabled:opacity-50"
                  style={{ background: 'var(--brand-navy-900)' }}>
                  {imported.has(p.id) ? 'Imported' : <span className="flex items-center gap-1.5"><Plus size={13} /> Import</span>}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}