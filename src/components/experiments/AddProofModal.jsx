import { useState, useRef, useCallback } from 'react';
import { X, Loader2, Upload, FileText, Film, CheckCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const inputCls = 'w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]';

// Supported file types and size limits
const VIDEO_EXTS = new Set(['mp4','webm','mov','avi','mkv','m4v','wmv','ogv','3gp','3g2']);
const VIDEO_MIMES = new Set(['video/mp4','video/webm','video/quicktime','video/x-msvideo','video/x-matroska','video/mp4','video/x-ms-wmv','video/ogg','video/3gpp','video/3gpp2']);
const ALLOWED_EXTS = new Set([
  ...VIDEO_EXTS,
  'pdf','txt','html',
  'png','jpg','jpeg','webp','svg',
  'csv','xls','xlsx','json',
  'mp3','wav',
]);
const VIDEO_MAX = 100 * 1024 * 1024; // 100 MB
const FILE_MAX  =  50 * 1024 * 1024; //  50 MB

function getExt(name) { return (name.split('.').pop() || '').toLowerCase(); }
function isVideo(file) { return VIDEO_EXTS.has(getExt(file.name)) || VIDEO_MIMES.has(file.type); }
function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function validateFile(file) {
  const ext = getExt(file.name);
  if (!ALLOWED_EXTS.has(ext)) {
    return 'This file type is not currently supported. Upload a supported document, image, audio file, video, or provide a shareable external link.';
  }
  const vid = isVideo(file);
  const max = vid ? VIDEO_MAX : FILE_MAX;
  if (file.size > max) {
    return vid
      ? 'This video exceeds the 100 MB upload limit. Compress the video or paste a shareable link instead.'
      : 'This file exceeds the 50 MB upload limit. Reduce the file size or paste a shareable link instead.';
  }
  return null;
}

// ── File Drop Zone ─────────────────────────────────────────────────────────────
function FileDropZone({ file, uploadState, onSelect, onRemove }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onSelect(f);
  }, [onSelect]);

  const handleDragOver = e => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

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
                  <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'var(--brand-navy-700)', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}
            {uploadState === 'done' && (
              <div className="mt-1 flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Uploaded</div>
            )}
            {uploadState === 'error' && (
              <div className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> Upload failed</div>
            )}
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
      onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition ${dragging ? 'border-[#1F3A5F] bg-[#EEF2F6]' : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#1F3A5F] hover:bg-[#EEF2F6]'}`}
    >
      <input ref={inputRef} type="file"
        accept=".pdf,.txt,.html,.png,.jpg,.jpeg,.webp,.svg,.csv,.xls,.xlsx,.json,.mp3,.wav,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.ogv,.3gp,.3g2"
        className="hidden" onChange={e => { if (e.target.files[0]) onSelect(e.target.files[0]); }} />
      <Upload size={24} className="mx-auto mb-2 text-[#94A3B8]" />
      <p className="text-sm font-semibold text-[#334155]">Click or drag a file here</p>
      <p className="mt-1 text-xs text-[#94A3B8]">Videos up to 100 MB · All other files up to 50 MB</p>
      <p className="mt-0.5 text-xs text-[#94A3B8]">PDF, image, video, audio, spreadsheet, JSON</p>
    </div>
  );
}

// ── Success Toast ──────────────────────────────────────────────────────────────
export function ProofSuccessToast({ proof, missionTitle, onViewProof, onReturnToMission, onDismiss }) {
  return (
    <div role="alert" aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] max-w-sm w-full rounded-[20px] bg-white border border-green-100 shadow-2xl p-5 flex flex-col gap-3"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#F0FDF4' }}>
          <CheckCircle size={20} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#050816]">Proof saved successfully.</p>
          <p className="text-xs text-[#64748B] mt-0.5 truncate">{proof.title}</p>
          {missionTitle && <p className="text-xs text-[#94A3B8] truncate">Mission: {missionTitle}</p>}
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[#94A3B8] hover:text-[#334155]">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onViewProof} className="flex-1 rounded-[8px] py-2 text-xs font-semibold text-white"
          style={{ background: 'var(--brand-navy-900)' }}>View Proof</button>
        <button onClick={onReturnToMission} className="flex-1 rounded-[8px] border border-[#E2E8F0] py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          Return to Mission
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function AddProofModal({ mission, experiment, onClose, onSaved }) {
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
  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | done | error
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

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
    } catch (e) {
      setUploadState('error');
      return null;
    }
  };

  const handleSave = async () => {
    if (submittingRef.current) return;
    if (!data.title.trim()) { setError('Title is required.'); return; }
    if (fileError) return;
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
      const proof = await base44.entities.ProofOfWork.create({
        user_id: user.id,
        mission_id: mission.id,
        experiment_id: experiment.id,
        path_tested: experiment.path_name || '',
        title: data.title.trim(),
        category: data.category,
        description: data.description,
        external_url: data.external_url || undefined,
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
      onSaved(proof);
    } catch (err) {
      setError('Failed to save proof. Please try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const canSave = data.title.trim() && !saving && uploadState !== 'uploading' && !fileError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#050816]">Add Proof of Work</h2>
          <button onClick={onClose} aria-label="Close modal" disabled={saving}><X size={20} className="text-[#64748B]" /></button>
        </div>
        <p className="text-sm text-[#64748B] mb-5">Document evidence of completing this mission.</p>

        {/* Read-only context */}
        <div className="mb-5 rounded-xl p-3 border border-[#E2E8F0] bg-[#F8FAFC] space-y-1.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Mission</p>
            <p className="text-sm font-semibold text-[#050816]">{mission.title}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Experiment</p>
            <p className="text-sm text-[#334155]">{experiment.title}</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}

        <div className="space-y-4">
          {/* Title */}
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Title <span className="text-red-500">*</span></span>
            <input name="title" value={data.title} onChange={ch} placeholder="What did you produce or complete?" className={inputCls} />
          </label>

          {/* Category + Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#334155] block mb-1">Category</span>
              <select name="category" value={data.category} onChange={ch} className={inputCls}>
                {['report','model','case_study','article','post','newsletter','video','podcast','prototype','landing_page','service_pilot','interview_notes','simulation','presentation','database','community','volunteer','other']
                  .map(c => <option key={c} value={c}>{c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>)}
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
            <span className="text-sm font-semibold text-[#334155] block mb-1">External link (optional)</span>
            <input name="external_url" value={data.external_url} onChange={ch} placeholder="https://..." className={inputCls} />
          </label>

          {/* Skills */}
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Skills demonstrated (comma-separated)</span>
            <input name="skills_demonstrated" value={data.skills_demonstrated} onChange={ch}
              placeholder="Financial modeling, writing, Python..." className={inputCls} />
          </label>

          {/* Privacy */}
          <label className="block">
            <span className="text-sm font-semibold text-[#334155] block mb-1">Privacy</span>
            <select name="visibility" value={data.visibility} onChange={ch} className={inputCls}>
              <option value="private">Private — only visible to me</option>
              <option value="public">Public — shareable</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {saving
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Saving Proof…</span>
              : uploadState === 'uploading'
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />Uploading…</span>
              : 'Save Proof'}
          </button>
        </div>
      </div>
    </div>
  );
}