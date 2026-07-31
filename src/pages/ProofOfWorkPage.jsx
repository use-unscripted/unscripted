import { useEffect, useState, useRef, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

class CardErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error('[ProofOfWorkPage] Card render error:', err?.message || err); }
  render() {
    if (this.state.hasError)
      return <div className="rounded-[20px] border border-dashed border-[#E2E8F0] p-6 text-center text-xs text-[#94A3B8]">This record could not be displayed.</div>;
    return this.props.children;
  }
}
import { Plus, ExternalLink, Search, Play, FileText, Film, Image, FileSpreadsheet, Music, File, ChevronDown, Eye, EyeOff, Trash2, X } from 'lucide-react';
import VisibilitySelector from '@/components/network/VisibilitySelector';
import SoftDeleteConfirm, { softDeletePayload } from '@/components/SoftDeleteConfirm';
import PageHeader from '@/components/PageHeader';
import { ProofSuccessToast } from '@/components/experiments/AddProofModal';
import PathSwitcher from '@/components/PathSwitcher';
import AddProofStandaloneModal from '@/components/experiments/AddProofStandaloneModal';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const VIDEO_EXTS = new Set(['mp4','webm','mov','avi','mkv','m4v','wmv','ogv','3gp','3g2']);
const IMAGE_EXTS = new Set(['png','jpg','jpeg','webp','svg']);
const AUDIO_EXTS = new Set(['mp3','wav']);
const SHEET_EXTS = new Set(['csv','xls','xlsx']);

function getExt(name) { return (name || '').split('.').pop().toLowerCase(); }

function FileIcon({ name, mime, size = 18 }) {
  const ext = getExt(name);
  if (VIDEO_EXTS.has(ext) || (mime || '').startsWith('video/')) return <Film size={size} style={{ color: 'var(--brand-navy-700)' }} />;
  if (IMAGE_EXTS.has(ext) || (mime || '').startsWith('image/')) return <Image size={size} style={{ color: '#2563EB' }} />;
  if (AUDIO_EXTS.has(ext) || (mime || '').startsWith('audio/')) return <Music size={size} style={{ color: '#7C3AED' }} />;
  if (SHEET_EXTS.has(ext)) return <FileSpreadsheet size={size} style={{ color: '#15803D' }} />;
  if (ext === 'pdf') return <FileText size={size} style={{ color: '#EA580C' }} />;
  return <File size={size} className="text-[#64748B]" />;
}

function isVideoFile(name, mime) {
  return VIDEO_EXTS.has(getExt(name)) || (mime || '').startsWith('video/');
}

// Soft-delete modal imported from SoftDeleteConfirm component

// ── Video / File Preview ───────────────────────────────────────────────────────
function FilePreviewModal({ entry, onClose }) {
  const vid = isVideoFile(entry.file_name, entry.mime_type);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.85)' }}>
      <div className="w-full max-w-3xl rounded-[20px] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <p className="font-semibold text-[#050816] truncate">{entry.file_name || entry.title}</p>
          <button onClick={onClose} aria-label="Close preview"><X size={20} className="text-[#64748B]" /></button>
        </div>
        <div className="p-5 bg-[#F8FAFC] flex items-center justify-center min-h-[300px]">
          {vid && entry.file_url ? (
            <video src={entry.file_url} controls className="max-w-full max-h-[60vh] rounded-xl"
              preload="metadata" aria-label={entry.file_name}>
              Your browser does not support video playback.
            </video>
          ) : entry.file_url ? (
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#EEF2F6' }}>
                <FileIcon name={entry.file_name} mime={entry.mime_type} size={28} />
              </div>
              <p className="text-sm font-semibold text-[#050816] mb-1">{entry.file_name}</p>
              {entry.file_size && <p className="text-xs text-[#64748B] mb-4">{fmtSize(entry.file_size)}</p>}
              <a href={entry.file_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)' }}>
                <ExternalLink size={14} /> Open File
              </a>
            </div>
          ) : (
            <p className="text-sm text-[#64748B]">No file attached.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Proof Card ─────────────────────────────────────────────────────────────────
function ProofCard({ entry, missionsMap, experimentsMap, onDelete, onNavigateToProof, onVisibilityChange }) {
  const safeEntry = {
    title: entry.title || entry.proof_title || 'Untitled proof',
    category: entry.category || 'other',
    visibility: entry.visibility || entry.privacy_status || 'private',
    description: entry.description || entry.completion_note || '',
    file_url: entry.file_url || null,
    file_name: entry.file_name || null,
    file_size: entry.file_size || null,
    mime_type: entry.mime_type || null,
    external_url: entry.external_url || null,
    skills_demonstrated: Array.isArray(entry.skills_demonstrated) ? entry.skills_demonstrated : [],
    mission_id: entry.mission_id || null,
    experiment_id: entry.experiment_id || null,
    created_date: entry.created_date || entry.created_at || entry.completed_at || null,
  };

  const mission = safeEntry.mission_id ? (missionsMap[safeEntry.mission_id] || null) : null;
  const experiment = safeEntry.experiment_id ? (experimentsMap[safeEntry.experiment_id] || null) : null;
  const [showPreview, setShowPreview] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!entry || !entry.id) return null;

  const vid = isVideoFile(safeEntry.file_name, safeEntry.mime_type);

  // min-w-0: grid items default to min-width:auto, so a long filename or URL
  // stretches the card past its track and scrolls the whole page sideways.
  return (
    <div className="min-w-0 rounded-[20px] border border-[#E2E8F0] bg-white p-5">
      {showPreview && <FilePreviewModal entry={safeEntry} onClose={() => setShowPreview(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: '#EEF2F6', color: 'var(--brand-navy-700)' }}>
              {safeEntry.category.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}
            </span>
            {safeEntry.visibility === 'public'
              ? <span className="rounded-full px-2.5 py-0.5 text-xs font-bold flex items-center gap-1" style={{ background: '#F0FDF4', color: '#15803D' }}><Eye size={10} />Public</span>
              : <span className="rounded-full px-2.5 py-0.5 text-xs font-bold flex items-center gap-1" style={{ background: '#F8FAFC', color: '#64748B' }}><EyeOff size={10} />Private</span>}
            <VisibilitySelector
              value={entry.network_visibility || 'private'}
              onChange={v => onVisibilityChange(entry.id, v)}
            />
          </div>
          <h3 className="font-heading font-bold text-[#050816] leading-snug">{safeEntry.title}</h3>
          {safeEntry.description && <p className="mt-1 text-sm text-[#334155] line-clamp-2">{safeEntry.description}</p>}
        </div>

        {/* More actions */}
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(v => !v)}
            className="rounded-lg p-1.5 text-[#94A3B8] hover:text-[#334155] hover:bg-[#F1F5F9] transition"
            aria-label="More actions">
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-36 rounded-xl border border-[#E2E8F0] bg-white shadow-lg py-1">
              <button onClick={() => { setMenuOpen(false); onDelete(entry); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* File preview row */}
      {safeEntry.file_url && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
          <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EEF2F6' }}>
            <FileIcon name={safeEntry.file_name} mime={safeEntry.mime_type} size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#334155] truncate">{safeEntry.file_name || 'Attached file'}</p>
            {safeEntry.file_size && <p className="text-[10px] text-[#94A3B8]">{fmtSize(safeEntry.file_size)}</p>}
          </div>
          <button onClick={() => setShowPreview(true)}
            className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            {vid ? <><Play size={11} />Play</> : <><ExternalLink size={11} />Open</>}
          </button>
        </div>
      )}

      {/* External URL */}
      {safeEntry.external_url && (
        <a href={safeEntry.external_url} target="_blank" rel="noopener noreferrer"
          className="mb-3 flex items-start gap-1.5 text-xs hover:underline" style={{ color: 'var(--brand-navy-700)' }}>
          <ExternalLink size={11} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-all">{safeEntry.external_url}</span>
        </a>
      )}

      {/* Skills */}
      {safeEntry.skills_demonstrated.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {safeEntry.skills_demonstrated.map((s, i) => (
            <span key={i} className="rounded-full border border-[#E2E8F0] px-2.5 py-0.5 text-[10px] text-[#334155]">{s}</span>
          ))}
        </div>
      )}

      {/* Mission / Experiment links */}
      {(mission || experiment || safeEntry.mission_id || safeEntry.experiment_id) && (
        <div className="pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-3">
          {mission ? (
            <button onClick={() => onNavigateToProof('experiments')}
              className="text-xs text-[#64748B] hover:text-[#274C77] transition text-left">
              Mission: <span className="font-semibold text-[#334155]">{mission.title}</span>
            </button>
          ) : safeEntry.mission_id ? (
            <span className="text-xs text-[#94A3B8]">Mission: <span className="italic">No longer available</span></span>
          ) : null}
          {experiment ? (
            <button onClick={() => onNavigateToProof('experiments')}
              className="text-xs text-[#64748B] hover:text-[#274C77] transition text-left">
              Experiment: <span className="font-semibold text-[#334155]">{experiment.title}</span>
            </button>
          ) : safeEntry.experiment_id ? (
            <span className="text-xs text-[#94A3B8]">Experiment: <span className="italic">Not linked</span></span>
          ) : null}
          {experiment?.path_name && (
            <span className="text-xs text-[#94A3B8]">Path: {experiment.path_name}</span>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] text-[#94A3B8]">Submitted {fmtDate(safeEntry.created_date) || 'date unavailable'}</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ProofOfWorkPage() {
  const navigate = useNavigate();
  const [userPaths, setUserPaths] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('all');
  const [entries, setEntries] = useState([]);
  const [missions, setMissions] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPath, setFilterPath] = useState('all');
  const [filterExp, setFilterExp] = useState('all');
  const [filterVis, setFilterVis] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const toastTimer = useRef(null);

  const load = async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const [proofData, missionData, expData, psData] = await Promise.all([
      base44.entities.ProofOfWork.filter({ deletion_status: 'active' }, '-created_date', 200).catch(() =>
        base44.entities.ProofOfWork.list('-created_date', 200).catch(() => [])),
        base44.entities.Missions.list('-created_date', 200).catch(() => []),
        base44.entities.Experiments.list('-created_date', 200).catch(() => []),
        base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      ]);
      setEntries(Array.isArray(proofData) ? proofData.filter(e => !e.deletion_status || e.deletion_status === 'active') : []);
      setMissions(Array.isArray(missionData) ? missionData : []);
      setExperiments(Array.isArray(expData) ? expData : []);
      setUserPaths(Array.isArray(psData) ? psData : []);
    } catch (err) {
      console.error('[ProofOfWorkPage] Failed to load data:', err?.message || err);
      setLoadError(true);
      setEntries([]);
      setMissions([]);
      setExperiments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Build maps
  const missionsMap = Object.fromEntries(missions.map(m => [m.id, m]));
  const experimentsMap = Object.fromEntries(experiments.map(e => [e.id, e]));

  // Filter options
  const paths = ['all', ...new Set(experiments.map(e => e.path_name).filter(Boolean))];
  const expOptions = ['all', ...experiments.map(e => e.id)];

  // Filtered list — all field access guarded against undefined
  const filtered = entries.filter(e => {
    if (!e || !e.id) return false;
    const mission = e.mission_id ? (missionsMap[e.mission_id] || null) : null;
    const experiment = e.experiment_id ? (experimentsMap[e.experiment_id] || null) : null;
    if (filterPath !== 'all' && (experiment?.path_name || '') !== filterPath) return false;
    if (filterExp !== 'all' && (e.experiment_id || '') !== filterExp) return false;
    if (filterVis !== 'all' && (e.visibility || e.privacy_status || 'private') !== filterVis) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (e.title || e.proof_title || '').toLowerCase();
      const matchTitle = title.includes(q);
      const matchMission = (mission?.title || '').toLowerCase().includes(q);
      const matchExp = (experiment?.title || '').toLowerCase().includes(q);
      const matchFile = (e.file_name || '').toLowerCase().includes(q);
      const matchDesc = (e.description || e.completion_note || '').toLowerCase().includes(q);
      if (!matchTitle && !matchMission && !matchExp && !matchFile && !matchDesc) return false;
    }
    return true;
  });

  const handleProofSaved = (proof) => {
    setShowNew(false);
    load();
    const mission = missionsMap[proof.mission_id];
    setSuccessToast({ proof, missionTitle: mission?.title || '' });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const user = await base44.auth.me();
      await base44.entities.ProofOfWork.update(deleteTarget.id, softDeletePayload(user.id));
      setEntries(prev => prev.filter(e => e.id !== deleteTarget.id));
    } catch (err) {
      console.error('[ProofOfWorkPage] Failed to soft-delete record:', deleteTarget.id, err?.message || err);
    }
    setDeleteTarget(null);
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      {deleteTarget && (
        <SoftDeleteConfirm
          itemName={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {showNew && (
        <AddProofStandaloneModal
          onClose={() => setShowNew(false)}
          onSaved={(proof, missionTitle) => {
            setShowNew(false);
            load();
            setSuccessToast({ proof, missionTitle: missionTitle || '' });
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);
          }}
        />
      )}

      {successToast && (
        <ProofSuccessToast
          proof={successToast.proof}
          missionTitle={successToast.missionTitle}
          onViewProof={() => { setSuccessToast(null); }}
          onReturnToMission={() => { setSuccessToast(null); navigate('/experiments'); }}
          onDismiss={() => setSuccessToast(null)}
        />
      )}

      {userPaths.length > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <PathSwitcher
            paths={userPaths.filter(p => p.status !== 'archived')}
            selectedId={selectedPathId}
            onChange={(id) => {
              setSelectedPathId(id);
              if (id === 'all') { setFilterPath('all'); }
              else {
                const p = userPaths.find(x => x.id === id);
                if (p) setFilterPath(p.path_name);
              }
            }}
            showAll
          />
        </div>
      )}

      <PageHeader
        title="Proof of Work"
        description="Review the work you have completed while testing your paths."
        action={
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white shrink-0"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            <Plus size={16} /> Add Proof of Work
          </button>
        }
      />

      {/* Search + Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, mission, experiment, or filename…"
            className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#274C77]" />
        </div>
        {paths.length > 1 && (
          <select value={filterPath} onChange={e => setFilterPath(e.target.value)}
            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
            <option value="all">All paths</option>
            {paths.filter(p => p !== 'all').map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {experiments.length > 0 && (
          <select value={filterExp} onChange={e => setFilterExp(e.target.value)}
            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
            <option value="all">All experiments</option>
            {experiments.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
        )}
        <select value={filterVis} onChange={e => setFilterVis(e.target.value)}
          className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
          <option value="all">All visibility</option>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading proof of work…</div>
      ) : loadError ? (
        <div className="rounded-[24px] border border-dashed border-red-200 p-16 text-center">
          <h3 className="font-heading text-xl font-bold text-[#050816]">We couldn't load your proof of work.</h3>
          <p className="mt-2 text-sm text-[#64748B]">There was a problem fetching your records. Please try again.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={load}
              className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)' }}>
              Retry
            </button>
            <button onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">
              Return to Dashboard
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-16 text-center">
          <h3 className="font-heading text-xl font-bold text-[#050816]">
            {entries.length === 0 ? 'No proof submitted yet.' : 'No results match your filters.'}
          </h3>
          <p className="mt-2 text-sm text-[#64748B]">
            {entries.length === 0
              ? 'Add work from your experiments and missions to build a record of what you have learned and completed.'
              : 'Try adjusting your search or filters.'}
          </p>
          {entries.length === 0 && (
            <button onClick={() => setShowNew(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--brand-navy-900)' }}>
              <Plus size={16} /> Add Proof of Work
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-[#94A3B8] mb-4">{filtered.length} submission{filtered.length !== 1 ? 's' : ''} — newest first</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(e => (
              <CardErrorBoundary key={e.id}>
                <ProofCard
                 entry={e}
                 missionsMap={missionsMap}
                 experimentsMap={experimentsMap}
                 onDelete={setDeleteTarget}
                 onNavigateToProof={(path) => navigate(`/${path}`)}
                 onVisibilityChange={async (id, visibility) => {
                   await base44.entities.ProofOfWork.update(id, {
                     network_visibility: visibility,
                     network_shared_at: visibility !== 'private' ? new Date().toISOString() : null,
                   });
                   setEntries(prev => prev.map(x => x.id === id ? { ...x, network_visibility: visibility } : x));
                 }}
                />
              </CardErrorBoundary>
            ))}
          </div>
        </>
      )}
    </main>
  );
}