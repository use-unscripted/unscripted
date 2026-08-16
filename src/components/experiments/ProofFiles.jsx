/**
 * The file attachments on a piece of proof. Up to MAX_FILES of them: a deck plus
 * the spreadsheet behind it plus two screenshots is one piece of work, not four.
 *
 * Selection and validation only. Uploading and saving stay in AddProofFlow.
 */
import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Film, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

export const MAX_FILES = 10;

const VIDEO_EXTS = new Set(['mp4','webm','mov','avi','mkv','m4v','wmv','ogv','3gp','3g2']);
const VIDEO_MIMES = new Set(['video/mp4','video/webm','video/quicktime','video/x-msvideo','video/x-matroska','video/x-ms-wmv','video/ogg','video/3gpp','video/3gpp2']);
const ALLOWED_EXTS = new Set([...VIDEO_EXTS,'pdf','doc','docx','ppt','pptx','txt','html','png','jpg','jpeg','webp','svg','csv','xls','xlsx','json','mp3','wav']);
const VIDEO_MAX = 100 * 1024 * 1024;
const FILE_MAX  =  50 * 1024 * 1024;

export const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.html,.png,.jpg,.jpeg,.webp,.svg,.csv,.xls,.xlsx,.json,.mp3,.wav,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.ogv,.3gp,.3g2';

export function getExt(name) { return (String(name || '').split('.').pop() || '').toLowerCase(); }
export function isVideo(file) { return VIDEO_EXTS.has(getExt(file.name)) || VIDEO_MIMES.has(file.type); }

export function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

export function validateFile(file) {
  const ext = getExt(file.name);
  if (!ALLOWED_EXTS.has(ext)) return `${file.name}: unsupported file type. Upload a PDF, image, video, audio, spreadsheet, or document.`;
  const vid = isVideo(file);
  if (file.size > (vid ? VIDEO_MAX : FILE_MAX))
    return vid ? `${file.name}: video exceeds the 100 MB limit. Compress it or paste a link instead.` : `${file.name}: file exceeds the 50 MB limit. Reduce size or paste a link.`;
  return null;
}

/** One attached file, with its upload state. */
function FileRow({ file, state, onRemove }) {
  const vid = isVideo(file);
  return (
    <div className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--ink-100)' }}>
          {vid ? <Film size={18} style={{ color: 'var(--brand-navy-700)' }} /> : <FileText size={18} style={{ color: 'var(--brand-navy-700)' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="tp-body font-semibold text-[color:var(--surface-dark-900)] truncate">{file.name}</p>
          <p className="tp-meta text-[color:var(--ink-500)]">{fmtSize(file.size)} · {getExt(file.name).toUpperCase()}</p>
          {state === 'uploading' && (
            <div className="tp-meta mt-1 flex items-center gap-2" style={{ color: 'var(--brand-navy-700)' }}>
              <Loader2 size={12} className="animate-spin" /> Uploading…
            </div>
          )}
          {state === 'done' && <div className="tp-meta mt-1 flex items-center gap-1 text-green-600"><CheckCircle size={12} /> Uploaded</div>}
          {state === 'error' && <div className="tp-meta mt-1 flex items-center gap-1 text-red-600"><AlertCircle size={12} /> Upload failed</div>}
        </div>
        {state !== 'uploading' && (
          <button onClick={onRemove} aria-label={`Remove ${file.name}`} className="shrink-0 text-[color:var(--ink-400)] hover:text-red-500 transition">
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProofFiles({ files, states = {}, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const full = files.length >= MAX_FILES;

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length) onAdd(dropped);
  }, [onAdd]);

  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <FileRow key={`${f.name}-${f.size}-${i}`} file={f} state={states[i]} onRemove={() => onRemove(i)} />
      ))}

      {!full && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`rounded-[var(--r-control)] border-2 border-dashed px-6 py-7 text-center cursor-pointer transition ${dragging ? 'border-[color:var(--brand-navy-900)] bg-[color:var(--ink-100)]' : 'border-[color:var(--ink-200)] bg-[color:var(--ink-50)] hover:border-[color:var(--brand-navy-900)] hover:bg-[color:var(--ink-100)]'}`}>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files || []);
              if (picked.length) onAdd(picked);
              // Let the same file be picked again after a removal.
              e.target.value = '';
            }}
          />
          <Upload size={22} className="mx-auto mb-2 text-[color:var(--ink-400)]" />
          <p className="tp-body font-semibold text-[color:var(--ink-700)]">
            {files.length ? 'Add another file' : 'Click or drag files here'}
          </p>
          <p className="tp-meta mt-1 text-[color:var(--ink-400)]">
            Up to {MAX_FILES} files · videos up to 100 MB · all other files up to 50 MB
          </p>
          <p className="tp-meta mt-0.5 text-[color:var(--ink-400)]">PDF, DOC, PPT, XLS, image, video, audio</p>
        </div>
      )}

      {full && (
        <p className="tp-meta text-[color:var(--ink-500)]">
          That is the maximum of {MAX_FILES} files. Remove one to attach something else.
        </p>
      )}
    </div>
  );
}