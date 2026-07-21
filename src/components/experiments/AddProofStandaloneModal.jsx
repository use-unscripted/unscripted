import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, Upload, FileText, Film, CheckCircle, AlertCircle, RefreshCw, Trash2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]';

const VIDEO_EXTS = new Set(['mp4','webm','mov','avi','mkv','m4v','wmv','ogv','3gp','3g2']);
const VIDEO_MIMES = new Set(['video/mp4','video/webm','video/quicktime','video/x-msvideo','video/x-matroska','video/x-ms-wmv','video/ogg','video/3gpp','video/3gpp2']);
const ALLOWED_EXTS = new Set([...VIDEO_EXTS,'pdf','doc','docx','ppt','pptx','txt','html','png','jpg','jpeg','webp','svg','csv','xls','xlsx','json','mp3','wav']);
const VIDEO_MAX = 100 * 1024 * 1024;
const FILE_MAX  =  50 * 1024 * 1024;

const CATEGORIES = [
  ['report','Report'],['model','Model'],['case_study','Case Study'],['article','Article'],
  ['post','Post'],['newsletter','Newsletter'],['video','Video'],['podcast','Podcast'],
  ['prototype','Prototype'],['landing_page','Landing Page'],['service_pilot','Service Pilot'],
  ['interview_notes','Interview Notes'],['simulation','Simulation'],['presentation','Presentation'],
  ['database','Database'],['community','Community'],['volunteer','Volunteer'],['other','Other'],
];

function getExt(name) { return (name.split('.').pop() || '').toLowerCase(); }
function isVideo(file) { return VIDEO_EXTS.has(getExt(file.name)) || VIDEO_MIMES.has(file.type); }
function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function validateFile(file) {
  const ext = getExt(file.name);
  if (!ALLOWED_EXTS.has(ext)) return 'Unsupported file type. Upload a PDF, image, video, audio, spreadsheet, or document.';
  const vid = isVideo(file);
  if (file.size > (vid ? VIDEO_MAX : FILE_MAX))
    return vid ? 'Video exceeds 100 MB limit. Compress it or paste a link instead.' : 'File exceeds 50 MB limit. Reduce size or paste a link.';
  return null;
}

function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}

// ── File Drop Zone ─────────────────────────────────────────────────────────────
function FileDropZone({ file, uploadState, onSelect, onRemove }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onSelect(f);
  }, [onSelect]);

  if (file) {
    const vid = isVideo(file);
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#EEF2F6' }}>
            {vid ? <Film size={18} style={{ color: 'var(--brand-navy-700)' }} /> : <FileText size={18} style={{ color: 'var(--brand-navy-700)' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#050816] truncate">{file.name}</p>
            <p className="text-xs text-[#64748B]">{fmtSize(file.size)} · {getExt(file.name).toUpperCase()}</p>
            {uploadState === 'uploading' && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-navy-700)' }}>
                  <Loader2 size={12} className="animate-spin" /> Uploading...
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'var(--brand-navy-700)' }} />
                </div>
              </div>
            )}
            {uploadState === 'done' && <div className="mt-1 flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Uploaded</div>}
            {uploadState === 'error' && <div className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> Upload failed</div>}
          </div>
          {uploadState !== 'uploading' && (
            <button onClick={onRemove} aria-label="Remove file" className="shrink-0 text-[#94A3B8] hover:text-red-500 transition">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed px-6 py-7 text-center cursor-pointer transition ${dragging ? 'border-[#1F3A5F] bg-[#EEF2F6]' : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#1F3A5F] hover:bg-[#EEF2F6]'}`}>
      <input ref={inputRef} type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.html,.png,.jpg,.jpeg,.webp,.svg,.csv,.xls,.xlsx,.json,.mp3,.wav,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.ogv,.3gp,.3g2"
        className="hidden" onChange={e => { if (e.target.files[0]) onSelect(e.target.files[0]); }} />
      <Upload size={22} className="mx-auto mb-2 text-[#94A3B8]" />
      <p className="text-sm font-semibold text-[#334155]">Click or drag a file here</p>
      <p className="mt-1 text-xs text-[#94A3B8]">Videos up to 100 MB · All other files up to 50 MB</p>
      <p className="mt-0.5 text-xs text-[#94A3B8]">PDF, DOC, PPT, XLS, image, video, audio</p>
    </div>
  );
}

const STATUS_LABELS = { draft:'Draft', planned:'Planned', in_progress:'In Progress', completed:'Completed', skipped:'Skipped' };

// ── Main Standalone Modal ──────────────────────────────────────────────────────
export default function AddProofStandaloneModal({ onClose, onSaved, preselectedMission, preselectedExperiment }) {
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedExpId, setSelectedExpId] = useState(preselectedExperiment?.id || '');
  const [selectedMissionId, setSelectedMissionId] = useState(preselectedMission?.id || '');

  const [data, setData] = useState({
    title: '',
    category: 'other',
    description: '',
    external_url: '',
    completion_note: '',
    skills_demonstrated: '',
    visibility: 'private',
    completed_at: new Date().toISOString().split('T')[0],
  });

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploadState, setUploadState] = useState('idle');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  // Load user's experiments and missions
  useEffect(() => {
    Promise.all([
      base44.entities.Experiments.list('-created_date', 200).catch(() => []),
      base44.entities.Missions.list('-created_date', 200).catch(() => []),
    ]).then(([exps, mis]) => {
      setExperiments(Array.isArray(exps) ? exps : []);
      setMissions(Array.isArray(mis) ? mis : []);
      setLoadingData(false);
    });
  }, []);

  const selectedExp = experiments.find(e => e.id === selectedExpId) || preselectedExperiment || null;
  const expMissions = missions.filter(m => m.experiment_id === selectedExpId);

  // When experiment changes, reset mission unless it belongs to new experiment
  const handleExpChange = (expId) => {
    setSelectedExpId(expId);
    setSelectedMissionId('');
    setError('');
  };

  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));

  const handleFileSelect = (f) => {
    const err = validateFile(f);
    if (err) { setFileError(err); return; }
    setFileError('');
    setFile(f);
    setUploadState('idle');
    setUploadedUrl('');
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadState('idle');
    setUploadedUrl('');
    setFileError('');
  };

  const doUpload = async () => {
    if (!file) return null;
    setUploadState('uploading');
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setUploadState('done');
      setUploadedUrl(result.file_url);
      return result.file_url;
    } catch {
      setUploadState('error');
      return null;
    }
  };

  const handleSave = async () => {
    if (submittingRef.current) return;

    // Validate
    if (!data.title.trim()) { setError('Title is required.'); return; }
    if (!selectedExpId) { setError('Please select an experiment.'); return; }
    if (fileError) return;

    // Require at least one proof source
    const hasFile = !!file;
    const hasUrl = data.external_url.trim() && isValidUrl(data.external_url.trim());
    const hasNote = data.completion_note.trim().length > 20 || data.description.trim().length > 20;
    if (!hasFile && !hasUrl && !hasNote) {
      setError('Please upload a file, provide a valid external link, or write a meaningful completion note (at least 20 characters).');
      return;
    }
    if (data.external_url.trim() && !isValidUrl(data.external_url.trim())) {
      setError('External link must be a valid URL (e.g. https://...).');
      return;
    }

    // Validate mission belongs to selected experiment
    if (selectedMissionId) {
      const mission = missions.find(m => m.id === selectedMissionId);
      if (mission && mission.experiment_id !== selectedExpId) {
        setError('The selected mission does not belong to this experiment.');
        return;
      }
    }

    setError('');
    submittingRef.current = true;
    setSaving(true);

    try {
      let fileUrl = uploadedUrl;
      if (file && uploadState !== 'done') {
        fileUrl = await doUpload();
        if (!fileUrl) {
          setError('File upload failed. Please try again.');
          setSaving(false);
          submittingRef.current = false;
          return;
        }
      }

      const user = await base44.auth.me();

      // Security: ensure experiment belongs to current user
      const exp = experiments.find(e => e.id === selectedExpId);
      if (!exp) { setError('Selected experiment not found.'); setSaving(false); submittingRef.current = false; return; }

      const proof = await base44.entities.ProofOfWork.create({
        user_id: user.id,
        experiment_id: selectedExpId,
        mission_id: selectedMissionId || undefined,
        path_tested: exp.path_name || '',
        title: data.title.trim(),
        category: data.category,
        description: data.description,
        external_url: data.external_url.trim() || undefined,
        completion_note: data.completion_note,
        completed_at: data.completed_at || undefined,
        skills_demonstrated: data.skills_demonstrated
          ? data.skills_demonstrated.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        visibility: data.visibility,
        file_url: fileUrl || undefined,
        file_name: file?.name || undefined,
        file_size: file?.size || undefined,
        mime_type: file?.type || undefined,
      });

      onSaved(proof, selectedMissionId ? missions.find(m => m.id === selectedMissionId)?.title : null);
    } catch {
      setError('Failed to save proof. Please try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const canSave = data.title.trim() && selectedExpId && !saving && uploadState !== 'uploading' && !fileError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#050816]">Add Proof of Work</h2>
          <button onClick={onClose} aria-label="Close" disabled={saving}><X size={20} className="text-[#64748B]" /></button>
        </div>
        <p className="text-sm text-[#64748B] mb-5">Document evidence of completing an experiment or mission.</p>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}

        {loadingData ? (
          <div className="py-10 text-center text-sm text-[#64748B]"><Loader2 size={20} className="animate-spin mx-auto mb-2" />Loading your experiments…</div>
        ) : (
          <div className="space-y-4">

            {/* Title */}
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Title <span className="text-red-500">*</span></span>
              <input name="title" value={data.title} onChange={ch} placeholder="What did you produce or complete?" className={inputCls} />
            </label>

            {/* Experiment — required */}
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Experiment <span className="text-red-500">*</span></span>
              {experiments.length === 0 ? (
                <p className="text-sm text-[#64748B] rounded-xl border border-[#E2E8F0] px-4 py-3">No experiments found. Create one first.</p>
              ) : (
                <select value={selectedExpId} onChange={e => handleExpChange(e.target.value)} className={inputCls}>
                  <option value="">Select an experiment…</option>
                  {experiments.map(exp => (
                    <option key={exp.id} value={exp.id}>
                      {exp.title}{exp.status ? ` — ${STATUS_LABELS[exp.status] || exp.status}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {/* Path — read-only from experiment */}
            {selectedExp && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-0.5">Path</p>
                <p className="text-sm font-semibold text-[#050816]">{selectedExp.path_name || <span className="text-[#94A3B8] font-normal">No path connected to this experiment</span>}</p>
              </div>
            )}

            {/* Mission — optional, filtered to selected experiment */}
            {selectedExpId && (
              <label className="block">
                <span className="text-sm font-semibold text-[#334155] block mb-1">Mission <span className="text-xs font-normal text-[#94A3B8]">(optional)</span></span>
                {expMissions.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] rounded-xl border border-[#E2E8F0] px-4 py-3">
                    No missions have been created for this experiment yet. You may still save this proof under the overall experiment.
                  </p>
                ) : (
                  <select value={selectedMissionId} onChange={e => setSelectedMissionId(e.target.value)} className={inputCls}>
                    <option value="">No specific mission — overall experiment</option>
                    {expMissions.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                )}
              </label>
            )}

            {/* Category + Date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#334155] block mb-1">Proof type</span>
                <select name="category" value={data.category} onChange={ch} className={inputCls}>
                  {CATEGORIES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#334155] block mb-1">Date completed</span>
                <input type="date" name="completed_at" value={data.completed_at} onChange={ch} className={inputCls} />
              </label>
            </div>

            {/* Description */}
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Description</span>
              <textarea rows={2} name="description" value={data.description} onChange={ch}
                placeholder="What is this and what does it show?" className={inputCls} />
            </label>

            {/* Completion note */}
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Completion note</span>
              <textarea rows={2} name="completion_note" value={data.completion_note} onChange={ch}
                placeholder="What did you learn or what was the outcome?" className={inputCls} />
            </label>

            {/* File Upload */}
            <div>
              <span className="text-sm font-semibold text-[#334155] block mb-1">Upload file or video</span>
              <FileDropZone file={file} uploadState={uploadState} onSelect={handleFileSelect} onRemove={handleRemoveFile} />
              {fileError && (
                <p className="mt-2 text-xs text-red-600 flex items-start gap-1.5" role="alert">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />{fileError}
                </p>
              )}
              {uploadState === 'error' && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-red-600">Upload failed.</p>
                  <button onClick={() => { setUploadState('idle'); setUploadedUrl(''); }} className="text-xs underline flex items-center gap-1" style={{ color: 'var(--brand-navy-700)' }}>
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
              )}
            </div>

            {/* External URL */}
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">External link <span className="text-xs font-normal text-[#94A3B8]">(Google Drive, GitHub, YouTube, Notion…)</span></span>
              <input name="external_url" value={data.external_url} onChange={ch} placeholder="https://…" className={inputCls} />
            </label>

            {/* Skills */}
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Skills demonstrated <span className="text-xs font-normal text-[#94A3B8]">(comma-separated)</span></span>
              <input name="skills_demonstrated" value={data.skills_demonstrated} onChange={ch}
                placeholder="Financial modeling, writing, Python…" className={inputCls} />
            </label>

            {/* Visibility */}
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Visibility</span>
              <select name="visibility" value={data.visibility} onChange={ch} className={inputCls}>
                <option value="private">Private — only visible to me</option>
                <option value="public">Public — shareable</option>
              </select>
            </label>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {saving
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving…</span>
              : uploadState === 'uploading'
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Uploading…</span>
              : 'Save Proof'}
          </button>
        </div>
      </div>
    </div>
  );
}