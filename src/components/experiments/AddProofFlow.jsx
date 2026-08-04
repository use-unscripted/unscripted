/**
 * AddProofFlow — one guided flow for logging proof of work, asked one question
 * at a time.
 *
 * Backs both entry points:
 *   - from a mission (mission + experiment handed in, so nothing is looked up
 *     and the "which experiment" question is skipped)
 *   - from the Proof of Work page (the student picks the experiment first)
 *
 * The "at least one proof source" rule used to be a hidden validation that only
 * surfaced after pressing save. Here it is the question the last step asks, and
 * one expression gates the button and the save so they can never disagree.
 *
 * Props: onClose, onSaved(proof, missionTitle), preselectedMission, preselectedExperiment
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, Upload, FileText, Film, CheckCircle, AlertCircle, RefreshCw, Trash2, ChevronRight, ChevronLeft, ChevronDown, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ProgressBar, OptionRow, GuidedStyles, footerCls } from '@/components/guided/GuidedPieces';
import { linksForExperiment } from '@/lib/career-cycle';

const inputCls = 'w-full rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-3 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]';
const bigInputCls = 'w-full rounded-2xl border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-4 py-4 text-base outline-none focus:border-[color:var(--brand-navy-900)]';

// footerCls comes from GuidedPieces. The panel below drops its own bottom
// padding (pb-0) so that bar can stick to the panel's edge, and its -mx values
// cancel these px values exactly — keep the two in step by changing the shared
// one, not by re-declaring it here.

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

const STATUS_LABELS = { draft:'Draft', planned:'Planned', in_progress:'In Progress', completed:'Completed', skipped:'Skipped' };

const MIN_NOTE = 20;

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
      <div className="rounded-xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--ink-100)' }}>
            {vid ? <Film size={18} style={{ color: 'var(--brand-navy-700)' }} /> : <FileText size={18} style={{ color: 'var(--brand-navy-700)' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[color:var(--surface-dark-900)] truncate">{file.name}</p>
            <p className="text-xs text-[color:var(--ink-500)]">{fmtSize(file.size)} · {getExt(file.name).toUpperCase()}</p>
            {uploadState === 'uploading' && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-navy-700)' }}>
                  <Loader2 size={12} className="animate-spin" /> Uploading...
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-[color:var(--ink-200)] overflow-hidden">
                  <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'var(--brand-navy-700)' }} />
                </div>
              </div>
            )}
            {uploadState === 'done' && <div className="mt-1 flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Uploaded</div>}
            {uploadState === 'error' && <div className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> Upload failed</div>}
          </div>
          {uploadState !== 'uploading' && (
            <button onClick={onRemove} aria-label="Remove file" className="shrink-0 text-[color:var(--ink-400)] hover:text-red-500 transition">
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
      className={`rounded-xl border-2 border-dashed px-6 py-7 text-center cursor-pointer transition ${dragging ? 'border-[color:var(--brand-navy-900)] bg-[color:var(--ink-100)]' : 'border-[color:var(--ink-200)] bg-[color:var(--ink-50)] hover:border-[color:var(--brand-navy-900)] hover:bg-[color:var(--ink-100)]'}`}>
      <input ref={inputRef} type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.html,.png,.jpg,.jpeg,.webp,.svg,.csv,.xls,.xlsx,.json,.mp3,.wav,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.ogv,.3gp,.3g2"
        className="hidden" onChange={e => { if (e.target.files[0]) onSelect(e.target.files[0]); }} />
      <Upload size={22} className="mx-auto mb-2 text-[color:var(--ink-400)]" />
      <p className="text-sm font-semibold text-[color:var(--ink-700)]">Click or drag a file here</p>
      <p className="mt-1 text-xs text-[color:var(--ink-400)]">Videos up to 100 MB · All other files up to 50 MB</p>
      <p className="mt-0.5 text-xs text-[color:var(--ink-400)]">PDF, DOC, PPT, XLS, image, video, audio</p>
    </div>
  );
}

// The ways to answer "show it". Any one of them counts, and a student can add
// more than one — a deck plus a note about how the pitch went is better
// evidence, not a conflict.
const PROOF_SOURCES = [
  { value: 'file', label: 'Upload a file', desc: 'A doc, deck, screenshot, or recording' },
  { value: 'link', label: 'Paste a link', desc: 'Google Drive, GitHub, YouTube, Notion…' },
  { value: 'note', label: 'Just write what happened', desc: 'A few sentences is plenty' },
];

// ── The flow ───────────────────────────────────────────────────────────────────
export default function AddProofFlow({ onClose, onSaved, preselectedMission, preselectedExperiment }) {
  // Only fetch what this entry point actually needs. The mission entry point is
  // handed both objects and must not wait on a round trip it never needed.
  const needExperiments = !preselectedExperiment;
  const needMissions = !preselectedMission;

  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loadingExperiments, setLoadingExperiments] = useState(needExperiments);

  const [selectedExpId, setSelectedExpId] = useState(preselectedExperiment?.id || '');
  const [selectedMissionId, setSelectedMissionId] = useState(preselectedMission?.id || '');

  const [initialData] = useState(() => ({
    title: preselectedMission?.title || '',
    category: 'other',
    description: '',
    external_url: '',
    completion_note: '',
    skills_demonstrated: '',
    visibility: 'private',
    completed_at: new Date().toISOString().split('T')[0],
  }));
  const [data, setData] = useState(initialData);

  const [sources, setSources] = useState([]);   // which of the three are open
  const skipFileRef = useRef(false);            // set by "save without the file"
  const [detailOpen, setDetailOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploadState, setUploadState] = useState('idle');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const steps = needExperiments ? ['experiment', 'title', 'proof'] : ['title', 'proof'];
  const lastIndex = steps.length - 1;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('fwd');
  const stepKey = steps[index];
  const advanceRef = useRef(null);
  const rootRef = useRef(null);
  const headingRef = useRef(null);

  useEffect(() => () => clearTimeout(advanceRef.current), []);

  const go = useCallback((to, direction) => {
    clearTimeout(advanceRef.current);
    setError('');          // a save error from the last screen is stale here
    setDir(direction);
    setIndex(to);
  }, []);
  const next = useCallback(() => go(Math.min(index + 1, lastIndex), 'fwd'), [go, index, lastIndex]);
  const back = useCallback(() => go(Math.max(index - 1, 0), 'back'), [go, index]);

  // A new question always starts at the top, even on a short screen. This
  // depends on the panel below carrying data-modal-scroll.
  //
  // Changing step unmounts whatever had focus, which drops it to <body> and
  // sends the next Tab into the page behind the overlay. Move it to the new
  // question — unless the step already autofocused a field of its own.
  useEffect(() => {
    rootRef.current?.closest('[data-modal-scroll]')?.scrollTo({ top: 0, behavior: 'smooth' });
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      needExperiments ? base44.entities.Experiments.list('-created_date', 200).catch(() => []) : Promise.resolve(null),
      needMissions ? base44.entities.Missions.list('-created_date', 200).catch(() => []) : Promise.resolve(null),
    ]).then(([exps, mis]) => {
      if (!alive) return;
      if (exps) setExperiments(Array.isArray(exps) ? exps : []);
      if (mis) setMissions(Array.isArray(mis) ? mis : []);
      setLoadingExperiments(false);
    });
    return () => { alive = false; };
  }, [needExperiments, needMissions]);

  const selectedExp = preselectedExperiment || experiments.find(e => e.id === selectedExpId) || null;
  const expMissions = missions.filter(m => m.experiment_id === selectedExpId);

  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));

  // A source counts only while its row is checked. Unchecking hides it from the
  // gate and from the payload without touching what was typed, so a stray tap
  // costs nothing.
  const fileOn = sources.includes('file');
  const linkOn = sources.includes('link');
  const noteOn = sources.includes('note');

  // One definition of "there is proof here", used by the button and by the save.
  const trimmedUrl = data.external_url.trim();
  const urlInvalid = linkOn && !!trimmedUrl && !isValidUrl(trimmedUrl);
  const fileBlocked = fileOn && !!fileError;
  const hasFile = fileOn && !!file;
  const hasUrl = linkOn && !!trimmedUrl && !urlInvalid;
  const hasNote = noteOn && data.completion_note.trim().length > MIN_NOTE;
  const hasProof = hasFile || hasUrl || hasNote;

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

  // Any number of these can be open at once. Unchecking one never erases what
  // was typed — the gate and the payload both read "checked AND filled", so the
  // screen and the rule still agree.
  const toggleSource = (value) => {
    setSources(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value);
      // Re-opening the file row starts clean rather than showing a stale
      // rejection from a file that was never kept.
      if (value === 'file') { setFileError(''); skipFileRef.current = false; }
      return [...prev, value];
    });
  };

  const chooseExperiment = (expId) => {
    setSelectedExpId(expId);
    setSelectedMissionId('');
    setError('');
    clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => {
      setDir('fwd');
      setIndex(i => Math.min(i + 1, lastIndex));
    }, 230);
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

    if (!data.title.trim()) { setError('Title is required.'); return; }
    if (!selectedExpId) { setError('Please select an experiment.'); return; }
    if (fileBlocked) return;

    // The same rule the button enforces. The button is not the gate.
    if (!hasProof) {
      setError('Please upload a file, provide a valid external link, or write a meaningful completion note (at least 20 characters).');
      return;
    }
    if (urlInvalid) {
      setError('External link must be a valid URL (e.g. https://...).');
      return;
    }

    // A mission must belong to the experiment it is being filed under.
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
      const wantFile = hasFile && !skipFileRef.current;
      let fileUrl = wantFile ? uploadedUrl : '';
      if (wantFile && uploadState !== 'done') {
        fileUrl = await doUpload();
        if (!fileUrl) {
          // Losing the whole entry because one upload failed is how a student
          // gives up. If they have other proof, offer to save without the file.
          setError(hasUrl || hasNote
            ? 'That file didn’t upload. Try again, or save what you have without it.'
            : 'File upload failed. Please try again.');
          setSaving(false);
          submittingRef.current = false;
          return;
        }
      }

      const user = await base44.auth.me();

      // The experiment comes from the prop when we were handed one. Only the
      // entry point that fetched a list checks membership of that list — the
      // mission entry point never had one and must not start needing one.
      const exp = preselectedExperiment || experiments.find(e => e.id === selectedExpId);
      if (!preselectedExperiment && !exp) {
        setError('Selected experiment not found.');
        setSaving(false);
        submittingRef.current = false;
        return;
      }

      const proof = await base44.entities.ProofOfWork.create({
        user_id: user.id,
        experiment_id: selectedExpId,
        mission_id: selectedMissionId || undefined,
        path_tested: exp.path_name || '',
        title: data.title.trim(),
        category: data.category,
        description: data.description,
        // Only checked sources reach the payload, so text left behind by an
        // unchecked row is never saved.
        external_url: (linkOn && trimmedUrl) || undefined,
        completion_note: noteOn ? data.completion_note : '',
        completed_at: data.completed_at || undefined,
        skills_demonstrated: data.skills_demonstrated
          ? data.skills_demonstrated.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        visibility: data.visibility,
        file_url: fileUrl || undefined,
        file_name: (wantFile && file?.name) || undefined,
        file_size: (wantFile && file?.size) || undefined,
        mime_type: (wantFile && file?.type) || undefined,
        // Cycle / path relationships resolved from the experiment itself, so
        // proof can never be filed under the wrong cycle.
        ...(await linksForExperiment(exp, missions.find(m => m.id === selectedMissionId))),
      });

      const chosenMission = selectedMissionId
        ? (preselectedMission?.id === selectedMissionId ? preselectedMission : missions.find(m => m.id === selectedMissionId))
        : null;
      onSaved(proof, chosenMission?.title || null);
    } catch {
      setError('Failed to save proof. Please try again.');
      setSaving(false);
      submittingRef.current = false;
    }
  };

  // Give up on the attachment and keep the rest, rather than losing the entry.
  const saveWithoutFile = () => { skipFileRef.current = true; handleSave(); };

  // The button and the save agree, so nothing is ever enabled and then rejected.
  const canSave = !!data.title.trim() && !!selectedExpId && !saving && uploadState !== 'uploading' && !fileBlocked && hasProof && !urlInvalid;

  // A disabled button must never be silent about why. Every condition that can
  // switch canSave off has a line here, ordered the way a student hits them.
  const blockedReason = saving || canSave ? null
    : fileBlocked ? `${fileError} Pick another, or uncheck “Upload a file”.`
    : urlInvalid ? 'That link isn’t a valid URL. Fix it, or uncheck “Paste a link”.'
    : !data.title.trim() ? 'Go back and give this a title.'
    : !selectedExpId ? 'Go back and pick an experiment.'
    : !hasProof ? 'Check one of the three above and fill it in. That’s all we need.'
    : null;

  const titled = !!data.title.trim();
  const noExperiments = !loadingExperiments && experiments.length === 0;

  const noteLen = data.completion_note.trim().length;
  const noteShort = MIN_NOTE + 1 - noteLen;
  const noteCounter = hasNote
    ? 'That counts as proof.'
    : noteLen === 0
      ? `A sentence or two, ${MIN_NOTE + 1} characters or more.`
      : `${noteShort} more character${noteShort === 1 ? '' : 's'} and this counts as proof.`;

  // Has the student put anything into this at all? Drives whether Escape is
  // allowed to throw it away.
  const isDirty = !!file
    || Object.keys(initialData).some(k => data[k] !== initialData[k])
    || selectedMissionId !== (preselectedMission?.id || '');

  // Escape and the close button are both blocked mid-save: the row is already
  // being created, and closing loses the toast and the page reload.
  const requestClose = useCallback(() => { if (!saving) onClose(); }, [saving, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      // Mid-composition keystrokes belong to the IME, not to us.
      if (e.isComposing || e.keyCode === 229) return;
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target?.tagName);
      // Escape only discards an empty form. Once there is work in here, closing
      // has to be deliberate — Cancel and the X still do it.
      if (e.key === 'Escape') { if (!isDirty) requestClose(); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (typing && e.target.tagName === 'TEXTAREA') return;
        // Never Enter-to-save: on the last step Enter does nothing.
        if (stepKey === 'experiment' && selectedExpId) { e.preventDefault(); next(); }
        else if (stepKey === 'title' && titled) { e.preventDefault(); next(); }
        return;
      }
      if (typing) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (stepKey === 'experiment' && n <= experiments.length) chooseExperiment(experiments[n - 1].id);
      else if (stepKey === 'proof' && n <= PROOF_SOURCES.length) toggleSource(PROOF_SOURCES[n - 1].value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Header context ───────────────────────────────────────────────────────────
  const chipCls = 'truncate rounded-full px-2.5 py-1 text-[11px] font-bold';
  const chip = preselectedMission ? (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className={chipCls} style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>{preselectedMission.title}</span>
      {selectedExp && <span className={chipCls} style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>{selectedExp.title}</span>}
    </div>
  ) : (
    <span className={chipCls} style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
      {selectedExp ? selectedExp.title : 'New proof'}
    </span>
  );

  const backButton = (
    <button onClick={back} disabled={saving}
      className="flex items-center gap-1 rounded-[10px] border px-4 py-3 text-sm font-semibold disabled:opacity-50"
      style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
      <ChevronLeft size={15} /> Back
    </button>
  );

  const cancelButton = (
    <button onClick={requestClose} disabled={saving}
      className="rounded-[10px] border px-4 py-3 text-sm font-semibold disabled:opacity-50"
      style={{ borderColor: 'var(--ink-200)', color: 'var(--text-primary)' }}>
      Cancel
    </button>
  );

  const continueButton = (enabled) => (
    <button onClick={next} disabled={!enabled}
      className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white disabled:opacity-40"
      style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
      Continue <ChevronRight size={15} />
    </button>
  );

  // ── Per-step content ─────────────────────────────────────────────────────────
  let question, hint, body, footer;

  if (stepKey === 'experiment') {
    question = 'Which experiment is this for?';
    hint = 'Whatever you did, it belongs to one of these.';
    body = loadingExperiments ? (
      <div className="py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />Loading your experiments…
      </div>
    ) : noExperiments ? (
      <div className="rounded-2xl border px-4 py-5 text-sm" style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)', color: 'var(--text-secondary)' }}>
        No experiments found. Create one first, then come back and log what you did.
      </div>
    ) : (
      <div className="space-y-2">
        {experiments.map((exp, i) => (
          <OptionRow
            key={exp.id}
            index={i}
            option={{ value: exp.id, label: exp.title, desc: exp.status ? (STATUS_LABELS[exp.status] || exp.status) : undefined }}
            selected={selectedExpId === exp.id}
            onSelect={() => chooseExperiment(exp.id)}
          />
        ))}
      </div>
    );
    footer = (
      <div className="flex items-center gap-3">
        {cancelButton}
        {noExperiments ? (
          <button onClick={requestClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            Close
          </button>
        ) : continueButton(!!selectedExpId)}
      </div>
    );
  } else if (stepKey === 'title') {
    question = 'What did you do?';
    hint = 'One line. The details are optional and come later.';
    body = (
      <>
        <input
          autoFocus
          name="title"
          value={data.title}
          onChange={ch}
          placeholder="e.g. Coffee chat with a product manager at Figma"
          className={bigInputCls}
        />
        {selectedExp?.path_name && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Filed under <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedExp.path_name}</span>
          </p>
        )}
      </>
    );
    footer = (
      <div className="flex items-center gap-3">
        {index > 0 ? backButton : cancelButton}
        {continueButton(titled)}
      </div>
    );
  } else {
    question = 'Show it.';
    hint = 'One of these is enough. Add more than one if you have it.';
    body = (
      <>
        <div className="space-y-2">
          {PROOF_SOURCES.map((s, i) => {
            const open = sources.includes(s.value);
            return (
              <div key={s.value}>
                <OptionRow option={s} index={i} selected={open} multi onSelect={() => toggleSource(s.value)} />

                {open && s.value === 'file' && (
                  <div className="anim-slide-up mt-2">
                    <FileDropZone file={file} uploadState={uploadState} onSelect={handleFileSelect} onRemove={handleRemoveFile} />
                    {fileError && (
                      <p className="mt-2 text-xs text-red-600 flex items-start gap-1.5" role="alert">
                        <AlertCircle size={13} className="shrink-0 mt-0.5" />{fileError}
                      </p>
                    )}
                    {uploadState === 'error' && (
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-xs text-red-600">Upload failed.</p>
                        <button onClick={() => { setUploadState('idle'); setUploadedUrl(''); skipFileRef.current = false; }} className="text-xs underline flex items-center gap-1" style={{ color: 'var(--brand-navy-700)' }}>
                          <RefreshCw size={11} /> Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {open && s.value === 'link' && (
                  <div className="anim-slide-up mt-2">
                    <input name="external_url" value={data.external_url} onChange={ch}
                      placeholder="https://…" className={inputCls} autoFocus />
                    {urlInvalid && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600" role="alert">
                        <AlertCircle size={13} className="shrink-0" />That does not look like a full link. Include https://
                      </p>
                    )}
                  </div>
                )}

                {open && s.value === 'note' && (
                  <div className="anim-slide-up mt-2">
                    <textarea name="completion_note" rows={4} value={data.completion_note} onChange={ch}
                      placeholder="Who did you talk to, what happened, what did you find out?" className={inputCls} autoFocus />
                    <p className="mt-1.5 text-xs" style={{ color: hasNote ? '#16A34A' : 'var(--text-secondary)' }}>
                      {noteCounter}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Everything optional lives behind this, closed. */}
        <button
          onClick={() => setDetailOpen(o => !o)}
          aria-expanded={detailOpen}
          className="mt-5 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left"
          style={{ borderColor: 'var(--ink-200)', background: 'var(--brand-white)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Add more detail <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>· optional</span>
          </span>
          <ChevronDown size={16} style={{ color: 'var(--ink-400)', transform: detailOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease-out)' }} />
        </button>

        {detailOpen && (
          <div className="anim-slide-up mt-2 space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--ink-200)', background: '#FAFBFC' }}>
            {!preselectedMission && expMissions.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Mission</span>
                <select value={selectedMissionId} onChange={e => setSelectedMissionId(e.target.value)} className={inputCls}>
                  <option value="">No specific mission (overall experiment)</option>
                  {expMissions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Proof type</span>
                <select name="category" value={data.category} onChange={ch} className={inputCls}>
                  {CATEGORIES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date completed</span>
                <input type="date" name="completed_at" value={data.completed_at} onChange={ch} className={inputCls} />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</span>
              <textarea rows={2} name="description" value={data.description} onChange={ch}
                placeholder="What is this and what does it show?" className={inputCls} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Skills demonstrated</span>
              <input name="skills_demonstrated" value={data.skills_demonstrated} onChange={ch}
                placeholder="Financial modeling, writing, Python…" className={inputCls} />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Visibility</span>
              <select name="visibility" value={data.visibility} onChange={ch} className={inputCls}>
                <option value="private">Private (only visible to me)</option>
                <option value="public">Public (shareable)</option>
              </select>
            </label>
          </div>
        )}
      </>
    );
    footer = (
      <>
        <div className="flex items-center gap-3">
          {index > 0 ? backButton : cancelButton}
          <button onClick={handleSave} disabled={!canSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] py-3 text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            {saving && uploadState === 'uploading'
              ? <><Loader2 size={15} className="animate-spin" />Uploading…</>
              : saving
              ? <><Loader2 size={15} className="animate-spin" />Saving…</>
              : <><Save size={15} />Save proof</>}
          </button>
        </div>
        {blockedReason && (
          <p className="mt-2.5 flex w-full items-center justify-center gap-1.5 text-center text-xs font-semibold"
            style={{ color: fileBlocked || urlInvalid ? '#DC2626' : 'var(--text-secondary)' }}>
            {(fileBlocked || urlInvalid) && <AlertCircle size={13} className="shrink-0" />}
            {blockedReason}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.55)' }}>
      {/* data-modal-scroll is what the scroll-to-top effect looks for, and
          px-6/pb-0/pt-6 (sm:px-8/pt-8) is what the sticky footer's -mx cancels.
          Changing either breaks something silently. */}
      <div
        data-modal-scroll
        className="anim-modal w-full max-w-xl max-h-[94vh] overflow-y-auto rounded-[24px] bg-white px-6 pb-0 pt-6 sm:px-8 sm:pt-8"
        style={{ boxShadow: '0 30px 80px rgba(5,8,22,0.28)' }}
      >
        <div ref={rootRef}>
          <GuidedStyles />

          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              {chip}
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {index + 1} of {steps.length}
                </span>
                <button onClick={requestClose} disabled={saving} aria-label="Close"
                  className="rounded-lg p-0.5 disabled:opacity-40" style={{ color: 'var(--ink-500)' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <ProgressBar value={(index + 1) / steps.length} />
          </div>

          <div key={index} className={dir === 'fwd' ? 'step-pane-fwd' : 'step-pane-back'}>
            <h2 ref={headingRef} tabIndex={-1} className="font-heading text-[26px] font-bold leading-tight outline-none" style={{ color: 'var(--surface-dark-900)' }}>
              {question}
            </h2>
            {hint && <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{hint}</p>}

            <div className="mt-5 min-h-[220px]">
              {error && (
                <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />{error}
                  </div>
                  {uploadState === 'error' && (hasUrl || hasNote) && !saving && (
                    <button onClick={saveWithoutFile}
                      className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Save without the file
                    </button>
                  )}
                </div>
              )}
              {body}
            </div>
          </div>

          <div className={footerCls}>{footer}</div>
        </div>
      </div>
    </div>
  );
}