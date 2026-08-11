import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronUp, Star, Copy, Trash2, GitCompare, Loader2, ExternalLink, Pencil, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { softDeletePayload } from '@/components/SoftDeleteConfirm';
import { createGuideOnce, newIdempotencyKey } from './guideIdempotency';

const STATUS_CFG = {
  active:    { bg: 'var(--success-50)', text: 'var(--success-700)', label: 'Active' },
  draft:     { bg: 'var(--ink-100)', text: 'var(--ink-500)', label: 'Draft' },
  inactive:  { bg: 'var(--ink-100)', text: 'var(--ink-500)', label: 'Inactive' },
  completed: { bg: 'var(--info-50)', text: 'var(--info-700)', label: 'Completed' },
  deleted:   { bg: 'var(--danger-50)', text: '#DC2626', label: 'Deleted' },
};

function fmtDate(d) {
  if (!d) return 'Not set';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Compare modal ─────────────────────────────────────────────────────────────
function GuideCompareModal({ guideA, guideB, onClose }) {
  const fields = [
    { label: 'Objective', keyA: guideA.objective, keyB: guideB.objective },
    { label: 'Estimated Time', keyA: guideA.estimated_time, keyB: guideB.estimated_time },
    { label: 'Deliverable', keyA: guideA.deliverable, keyB: guideB.deliverable },
    { label: 'Proof Required', keyA: guideA.proof_requirement, keyB: guideB.proof_requirement },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="tp-section text-[color:var(--surface-dark-900)]">Compare Experiments</h2>
          <button onClick={onClose}><X size={20} className="text-[color:var(--ink-500)]" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[guideA, guideB].map((g, i) => (
            <div key={i} className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-3">
              <p className="tp-eyebrow text-[color:var(--ink-500)]">Version {g.version_number}</p>
              <p className="tp-card text-[color:var(--surface-dark-900)] mt-0.5">{g.guide_title}</p>
              {g.is_active && <span className="tp-meta font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5 mt-1 inline-block">Active</span>}
            </div>
          ))}
        </div>
        {fields.map(f => {
          const differ = f.keyA !== f.keyB;
          return (
            <div key={f.label} className="mb-4">
              <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2 flex items-center gap-2">
                {f.label}
                {differ && <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>Different</span>}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[f.keyA, f.keyB].map((val, i) => (
                  <div key={i} className="tp-body rounded-xl p-3 text-[color:var(--ink-700)]"
                    style={{ background: differ ? (i === 0 ? '#FFF7ED' : 'var(--success-50)') : 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
                    {val || <span className="text-[color:var(--ink-400)] italic">Not specified</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="mb-4">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2 flex items-center gap-2">
            Steps
            {(guideA.steps?.length !== guideB.steps?.length) && (
              <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: 'var(--warning-50)', color: 'var(--warning-700)' }}>Different count</span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[guideA, guideB].map((g, gi) => (
              <div key={gi} className="space-y-2">
                <p className="tp-meta text-[color:var(--ink-400)]">{g.steps?.length || 0} steps</p>
                {(g.steps || []).map((s, i) => (
                  <div key={i} className="tp-body rounded-lg border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-3 py-2 text-[color:var(--ink-700)]">
                    <span className="font-semibold">{i + 1}. {s.title || (typeof s === 'string' ? s : JSON.stringify(s))}</span>
                    {s.description && <p className="tp-meta text-[color:var(--ink-500)] mt-0.5">{s.description}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">Reflection Questions</p>
          <div className="grid grid-cols-2 gap-4">
            {[guideA, guideB].map((g, gi) => (
              <ul key={gi} className="tp-body space-y-1 text-[color:var(--ink-700)]">
                {(g.reflection_questions || []).map((q, i) => <li key={i}>· {q}</li>)}
                {(!g.reflection_questions?.length) && <li className="text-[color:var(--ink-400)] italic">None</li>}
              </ul>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="tp-body w-full rounded-[10px] border border-[color:var(--ink-200)] py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">Close</button>
      </div>
    </div>
  );
}

// ── Rename row ────────────────────────────────────────────────────────────────
function RenameRow({ guide, onRenamed, onCancel }) {
  const [title, setTitle] = useState(guide.guide_title);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    await base44.entities.MissionGuides.update(guide.id, { guide_title: title.trim() });
    onRenamed({ ...guide, guide_title: title.trim() });
  };
  return (
    <div className="border-t border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 flex gap-2 items-center">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        className="flex-1 rounded-lg border border-[color:var(--ink-200)] bg-white px-3 py-1.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]"
      />
      <button onClick={handleSave} disabled={saving || !title.trim()}
        className="tp-meta rounded-lg px-3 py-2 font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--brand-navy-900)' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={onCancel} className="tp-meta rounded-lg border border-[color:var(--ink-200)] px-3 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-white">Cancel</button>
    </div>
  );
}

/**
 * MissionGuideHistory
 * Props:
 *   guides: MissionGuides[] for this experiment
 *   onSetActive: (guide) => void
 *   onDeleted: (guideId) => void
 *   onDuplicated: (newGuide) => void
 *   onRenamed: (updatedGuide) => void  (optional)
 *   onGenerateAnother: () => void  (optional)
 */
export default function MissionGuideHistory({ guides = [], onSetActive, onDeleted, onDuplicated, onRenamed, onGenerateAnother }) {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);    // expanded actions row
  const [renameId, setRenameId] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  // One idempotency key per guide the student is trying to copy, held from the
  // first Duplicate click until a copy actually exists. Clicking Duplicate
  // again after a failure reuses the key and adopts the copy that may already
  // have been written; clicking it again after a success starts from nothing,
  // so a student who genuinely wants two copies still gets two.
  const dupKeys = useRef({});

  if (guides.length === 0) return null;

  const sorted = [...guides].sort((a, b) => (b.version_number || 0) - (a.version_number || 0));

  const handleSetActive = async (guide) => {
    setActionLoading(guide.id + '_active');
    try {
      await Promise.all(guides.filter(g => g.is_active && g.id !== guide.id).map(g =>
        base44.entities.MissionGuides.update(g.id, { is_active: false, status: 'inactive' })
      ));
      await base44.entities.MissionGuides.update(guide.id, { is_active: true, status: 'active' });
      onSetActive(guide);
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (guide) => {
    setActionLoading(guide.id + '_delete');
    try {
      const user = await base44.auth.me();
      await base44.entities.MissionGuides.update(guide.id, softDeletePayload(user.id));
      onDeleted(guide.id);
    } finally { setActionLoading(null); }
  };

  const handleDuplicate = async (guide) => {
    setActionLoading(guide.id + '_dup');
    try {
      const user = await base44.auth.me();
      const maxVersion = Math.max(...guides.map(g => g.version_number || 0));
      if (!dupKeys.current[guide.id]) dupKeys.current[guide.id] = newIdempotencyKey();
      // The spread carries the source guide's own idempotency_key; createGuideOnce
      // writes this copy's key over it, or every copy would adopt the original.
      const { row: dup } = await createGuideOnce(
        base44.entities.MissionGuides,
        dupKeys.current[guide.id],
        {
          ...guide,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
          version_number: maxVersion + 1,
          guide_title: `${guide.guide_title} (copy)`,
          is_active: false,
          status: 'draft',
          user_id: user.id,
        },
      );
      delete dupKeys.current[guide.id];
      onDuplicated(dup);
    } finally { setActionLoading(null); }
  };

  const toggleCompare = (id) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
    );
  };

  const compareGuideA = guides.find(g => g.id === compareIds[0]);
  const compareGuideB = guides.find(g => g.id === compareIds[1]);

  return (
    <div className="space-y-2">
      {showCompare && compareGuideA && compareGuideB && (
        <GuideCompareModal guideA={compareGuideA} guideB={compareGuideB} onClose={() => setShowCompare(false)} />
      )}

      {/* Compare toolbar */}
      {compareIds.length > 0 && (
        <div className="tp-meta flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5">
          <span className="text-blue-700 font-semibold">
            {compareIds.length === 1 ? 'Select one more experiment to compare' : 'Ready to compare'}
          </span>
          {compareIds.length === 2 && (
            <button onClick={() => setShowCompare(true)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold"
              style={{ background: 'var(--info-50)', color: 'var(--info-700)', border: '1px solid #BFDBFE' }}>
              <GitCompare size={12} /> Compare
            </button>
          )}
          <button onClick={() => setCompareIds([])} className="ml-auto text-blue-400 hover:text-blue-600">
            <X size={13} />
          </button>
        </div>
      )}

      {sorted.map(guide => {
        const cfg = STATUS_CFG[guide.status] || STATUS_CFG.draft;
        const isOpen = openId === guide.id;
        const isRenaming = renameId === guide.id;
        const isSelected = compareIds.includes(guide.id);

        return (
          <div key={guide.id}
            className="rounded-xl border overflow-hidden transition"
            style={{ borderColor: isSelected ? '#93C5FD' : 'var(--ink-200)', background: isSelected ? 'var(--info-50)' : 'white' }}>

            {/* Summary row. The row itself opens the experiment on its own page,
                rather than unfolding its contents inside this list. */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => navigate(`/guide?id=${guide.id}`)}
                className="flex-1 min-w-0 text-left"
                title="Open this experiment"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="tp-meta font-bold text-[color:var(--ink-400)]">v{guide.version_number}</span>
                  <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                  {guide.is_active && <CheckCircle2 size={12} className="text-green-600 shrink-0" />}
                  <span className="tp-card text-[color:var(--surface-dark-900)] truncate">{guide.guide_title}</span>
                </div>
                <div className="tp-meta flex flex-wrap gap-2 mt-0.5 text-[color:var(--ink-400)]">
                  <span>{fmtDate(guide.created_date)}</span>
                  {guide.estimated_time && <span>· {guide.estimated_time}</span>}
                  <span>· {guide.steps?.length || 0} steps</span>
                </div>
                {guide.objective && <p className="tp-meta text-[color:var(--ink-500)] mt-0.5 line-clamp-1">{guide.objective}</p>}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => navigate(`/guide?id=${guide.id}`)}
                  className="tp-meta flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition"
                >
                  <ExternalLink size={12} /> Open
                </button>
                <button onClick={() => setOpenId(isOpen ? null : guide.id)}
                  title="Options"
                  className="rounded-lg border border-[color:var(--ink-200)] p-1.5 hover:bg-[color:var(--ink-50)]">
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {/* Rename row */}
            {isRenaming && (
              <RenameRow
                guide={guide}
                onRenamed={(updated) => { onRenamed?.(updated); setRenameId(null); }}
                onCancel={() => setRenameId(null)}
              />
            )}

            {/* Actions row */}
            {isOpen && (
              <div className="border-t border-[color:var(--ink-200)] bg-[color:var(--ink-50)] px-4 py-3 flex flex-wrap gap-2">
                {/* Open: navigates to exact record by ID */}
                <button
                  onClick={() => navigate(`/guide?id=${guide.id}`)}
                  className="tp-meta flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-white transition">
                  <ExternalLink size={12} /> Open Experiment
                </button>

                <button onClick={() => toggleCompare(guide.id)}
                  className="tp-meta flex items-center gap-1.5 rounded-lg border px-3 py-2 font-semibold transition"
                  style={isSelected
                    ? { borderColor: '#93C5FD', background: 'var(--info-50)', color: 'var(--info-700)' }
                    : { borderColor: 'var(--ink-200)', background: 'white', color: 'var(--ink-700)' }}>
                  <GitCompare size={12} /> {isSelected ? 'Selected' : 'Compare'}
                </button>

                {!guide.is_active && (
                  <button onClick={() => handleSetActive(guide)} disabled={actionLoading === guide.id + '_active'}
                    className="tp-meta flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-white transition disabled:opacity-60">
                    {actionLoading === guide.id + '_active' ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
                    Set as Active
                  </button>
                )}

                <button onClick={() => setRenameId(isRenaming ? null : guide.id)}
                  className="tp-meta flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-white transition">
                  <Pencil size={12} /> Rename
                </button>

                <button onClick={() => handleDuplicate(guide)} disabled={actionLoading === guide.id + '_dup'}
                  className="tp-meta flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 font-semibold text-[color:var(--ink-700)] hover:bg-white transition disabled:opacity-60">
                  {actionLoading === guide.id + '_dup' ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                  Duplicate
                </button>

                <button onClick={() => handleDelete(guide)} disabled={actionLoading === guide.id + '_delete'}
                  className="tp-meta flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 font-semibold text-red-400 hover:text-red-600 hover:border-red-200 transition disabled:opacity-60">
                  {actionLoading === guide.id + '_delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Generate another */}
      {onGenerateAnother && (
        <button
          onClick={onGenerateAnother}
          className="tp-meta w-full rounded-xl border border-dashed border-[color:var(--ink-200)] py-3 font-semibold text-[color:var(--ink-500)] hover:border-[color:var(--brand-navy-900)] hover:text-[color:var(--brand-navy-900)] transition mt-1">
          + Generate Another Experiment
        </button>
      )}
    </div>
  );
}