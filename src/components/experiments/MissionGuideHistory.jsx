import { useState } from 'react';
import { Clock, CheckCircle2, ChevronDown, ChevronUp, Star, Copy, Trash2, Eye, GitCompare, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { softDeletePayload } from '@/components/SoftDeleteConfirm';

const STATUS_CFG = {
  active:    { bg: '#F0FDF4', text: '#15803D', label: 'Active' },
  draft:     { bg: '#F1F5F9', text: '#64748B', label: 'Draft' },
  inactive:  { bg: '#F1F5F9', text: '#64748B', label: 'Inactive' },
  completed: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Completed' },
  deleted:   { bg: '#FEF2F2', text: '#DC2626', label: 'Deleted' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function GuideDetailModal({ guide, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Version {guide.version_number}</p>
            <h2 className="font-heading text-xl font-bold text-[#050816]">{guide.guide_title}</h2>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#334155] text-xl font-bold leading-none">×</button>
        </div>

        {guide.objective && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Objective</p>
            <p className="text-sm text-[#334155]">{guide.objective}</p>
          </div>
        )}

        <div className="flex gap-4 text-xs text-[#64748B] mb-5">
          {guide.estimated_time && <span className="flex items-center gap-1"><Clock size={11} /> {guide.estimated_time}</span>}
          <span>{guide.steps?.length || 0} steps</span>
          <span>Generated {fmtDate(guide.created_date)}</span>
        </div>

        {guide.steps?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">Steps</p>
            <ol className="space-y-3">
              {guide.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                    style={{ background: '#8B0C21' }}>{i + 1}</span>
                  <div>
                    {s.title && <p className="font-semibold text-[#050816]">{s.title}</p>}
                    {s.description && <p className="text-[#64748B] mt-0.5">{s.description}</p>}
                    {s.estimated_time && <p className="text-xs text-[#94A3B8] mt-0.5">{s.estimated_time}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {guide.deliverable && (
          <div className="mb-3 rounded-xl p-3" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#8B0C21' }}>Deliverable</p>
            <p className="text-sm text-[#334155]">{guide.deliverable}</p>
          </div>
        )}

        {guide.proof_requirement && (
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Proof required</p>
            <p className="text-sm text-[#334155]">{guide.proof_requirement}</p>
          </div>
        )}

        {guide.reflection_questions?.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-1">Reflection questions</p>
            <ul className="space-y-1">{guide.reflection_questions.map((q, i) => <li key={i} className="text-sm text-[#334155]">· {q}</li>)}</ul>
          </div>
        )}

        <button onClick={onClose}
          className="mt-4 w-full rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          Close
        </button>
      </div>
    </div>
  );
}

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
          <h2 className="font-heading text-xl font-bold text-[#050816]">Compare Guides</h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#334155] text-xl font-bold">×</button>
        </div>

        {/* Headers */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[guideA, guideB].map((g, i) => (
            <div key={i} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Version {g.version_number}</p>
              <p className="font-semibold text-[#050816] text-sm mt-0.5">{g.guide_title}</p>
              {g.is_active && <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5 mt-1 inline-block">Active</span>}
            </div>
          ))}
        </div>

        {/* Field-by-field comparison */}
        {fields.map(f => {
          const differ = f.keyA !== f.keyB;
          return (
            <div key={f.label} className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2 flex items-center gap-2">
                {f.label}
                {differ && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#FFFBEB', color: '#B45309' }}>Different</span>}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[f.keyA, f.keyB].map((val, i) => (
                  <div key={i} className="rounded-xl p-3 text-sm text-[#334155]"
                    style={{ background: differ ? (i === 0 ? '#FFF7ED' : '#F0FDF4') : '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    {val || <span className="text-[#94A3B8] italic">Not specified</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Steps comparison */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2 flex items-center gap-2">
            Steps
            {(guideA.steps?.length !== guideB.steps?.length) && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#FFFBEB', color: '#B45309' }}>Different count</span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[guideA, guideB].map((g, gi) => (
              <div key={gi} className="space-y-2">
                <p className="text-xs text-[#94A3B8]">{g.steps?.length || 0} steps</p>
                {(g.steps || []).map((s, i) => (
                  <div key={i} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
                    <span className="font-semibold">{i + 1}. {s.title || (typeof s === 'string' ? s : JSON.stringify(s))}</span>
                    {s.description && <p className="text-[#64748B] mt-0.5">{s.description}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Reflection questions */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">Reflection Questions</p>
          <div className="grid grid-cols-2 gap-4">
            {[guideA, guideB].map((g, gi) => (
              <ul key={gi} className="space-y-1 text-xs text-[#334155]">
                {(g.reflection_questions || []).map((q, i) => <li key={i}>· {q}</li>)}
                {(!g.reflection_questions?.length) && <li className="text-[#94A3B8] italic">None</li>}
              </ul>
            ))}
          </div>
        </div>

        <button onClick={onClose}
          className="w-full rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * MissionGuideHistory
 * Props:
 *   guides          – MissionGuides[] for this experiment
 *   onSetActive     – (guide) => void
 *   onDeleted       – (guideId) => void
 *   onDuplicated    – (newGuide) => void
 */
export default function MissionGuideHistory({ guides = [], onSetActive, onDeleted, onDuplicated }) {
  const [openId, setOpenId] = useState(null);
  const [viewGuide, setViewGuide] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  if (guides.length === 0) return null;

  const sorted = [...guides].sort((a, b) => (b.version_number || 0) - (a.version_number || 0));

  const handleSetActive = async (guide) => {
    setActionLoading(guide.id + '_active');
    try {
      // Deactivate others
      await Promise.all(guides.filter(g => g.is_active && g.id !== guide.id).map(g =>
        base44.entities.MissionGuides.update(g.id, { is_active: false, status: 'inactive' })
      ));
      await base44.entities.MissionGuides.update(guide.id, { is_active: true, status: 'active' });
      onSetActive(guide);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (guide) => {
    setActionLoading(guide.id + '_delete');
    try {
      const user = await base44.auth.me();
      await base44.entities.MissionGuides.update(guide.id, softDeletePayload(user.id));
      onDeleted(guide.id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (guide) => {
    setActionLoading(guide.id + '_dup');
    try {
      const user = await base44.auth.me();
      const maxVersion = Math.max(...guides.map(g => g.version_number || 0));
      const dup = await base44.entities.MissionGuides.create({
        ...guide,
        id: undefined,
        created_date: undefined,
        updated_date: undefined,
        version_number: maxVersion + 1,
        guide_title: `${guide.guide_title} (copy)`,
        is_active: false,
        status: 'draft',
        user_id: user.id,
      });
      onDuplicated(dup);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleCompare = (id) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
    );
  };

  const compareGuideA = guides.find(g => g.id === compareIds[0]);
  const compareGuideB = guides.find(g => g.id === compareIds[1]);

  return (
    <div className="border-t border-[#E2E8F0] pt-4 mt-4">
      {viewGuide && <GuideDetailModal guide={viewGuide} onClose={() => setViewGuide(null)} />}
      {showCompare && compareGuideA && compareGuideB && (
        <GuideCompareModal guideA={compareGuideA} guideB={compareGuideB} onClose={() => setShowCompare(false)} />
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
          Mission Guide History ({guides.length})
        </p>
        {compareIds.length === 2 && (
          <button
            onClick={() => setShowCompare(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
            <GitCompare size={12} /> Compare Selected
          </button>
        )}
        {compareIds.length === 1 && (
          <p className="text-xs text-[#94A3B8]">Select one more to compare</p>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map(guide => {
          const cfg = STATUS_CFG[guide.status] || STATUS_CFG.draft;
          const isOpen = openId === guide.id;
          const isSelected = compareIds.includes(guide.id);

          return (
            <div key={guide.id}
              className="rounded-xl border overflow-hidden transition"
              style={{ borderColor: isSelected ? '#93C5FD' : '#E2E8F0', background: isSelected ? '#EFF6FF' : 'white' }}>
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#94A3B8]">v{guide.version_number}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                    {guide.is_active && <CheckCircle2 size={12} className="text-green-600" />}
                    <span className="text-sm font-semibold text-[#050816] truncate">{guide.guide_title}</span>
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-[#94A3B8]">
                    <span>{fmtDate(guide.created_date)}</span>
                    {guide.estimated_time && <span>· {guide.estimated_time}</span>}
                    <span>· {guide.steps?.length || 0} steps</span>
                  </div>
                  {guide.objective && <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">{guide.objective}</p>}
                </div>
                <button onClick={() => setOpenId(isOpen ? null : guide.id)}
                  className="shrink-0 rounded-lg border border-[#E2E8F0] p-1.5 hover:bg-[#F8FAFC]">
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Expanded actions */}
              {isOpen && (
                <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 flex flex-wrap gap-2">
                  <button onClick={() => setViewGuide(guide)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-white transition">
                    <Eye size={12} /> Open
                  </button>
                  <button onClick={() => toggleCompare(guide.id)}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                    style={isSelected
                      ? { borderColor: '#93C5FD', background: '#EFF6FF', color: '#1D4ED8' }
                      : { borderColor: '#E2E8F0', background: 'white', color: '#334155' }}>
                    <GitCompare size={12} /> {isSelected ? 'Selected' : 'Compare'}
                  </button>
                  {!guide.is_active && (
                    <button
                      onClick={() => handleSetActive(guide)}
                      disabled={actionLoading === guide.id + '_active'}
                      className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-white transition disabled:opacity-60">
                      {actionLoading === guide.id + '_active' ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
                      Set as Active
                    </button>
                  )}
                  <button onClick={() => handleDuplicate(guide)}
                    disabled={actionLoading === guide.id + '_dup'}
                    className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:bg-white transition disabled:opacity-60">
                    {actionLoading === guide.id + '_dup' ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                    Duplicate
                  </button>
                  <button onClick={() => handleDelete(guide)}
                    disabled={actionLoading === guide.id + '_delete'}
                    className="flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-red-600 hover:border-red-200 transition disabled:opacity-60">
                    {actionLoading === guide.id + '_delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}