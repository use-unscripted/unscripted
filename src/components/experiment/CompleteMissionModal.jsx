/**
 * "What demonstrates that you completed this?" is the only way a mission is
 * marked complete, so proof is never an afterthought on a separate page.
 * The upload happens once and is held in state, so a retry after a failure
 * never uploads the same file twice.
 */
import { useState, useRef } from 'react';
import { X, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { EVIDENCE_TYPES, completeMissionWithProof } from '@/lib/mission-completion';

export default function CompleteMissionModal({ mission, experiment, path, onClose, onCompleted }) {
  const [type, setType] = useState(null);
  const [title, setTitle] = useState(mission.title || '');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const pickFile = async (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setError(null);
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: chosen });
      setFile({ file_url, file_name: chosen.name, file_size: chosen.size, mime_type: chosen.type });
    } catch {
      setError('That file didn’t upload. Try again, or use a link instead.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (saving || !type) return;
    setError(null);
    setSaving(true);
    try {
      const result = await completeMissionWithProof({
        mission,
        experiment,
        path,
        evidence: { type, title, description, external_url: url, file },
      });
      onCompleted(result);
    } catch (err) {
      console.error('[mission] completion failed at stage: save_proof', err?.message);
      setError('We couldn’t save that. Nothing was half-saved. Press Save again.');
      setSaving(false);
    }
  };

  const needsSomething = !title.trim() || (!file && !url.trim() && !description.trim());

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="anim-modal max-h-[92vh] w-full overflow-y-auto rounded-t-[20px] bg-white p-6 sm:max-w-lg sm:rounded-[20px]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="tp-section" style={{ color: 'var(--text-primary)' }}>
              What demonstrates that you completed this?
            </h3>
            <p className="tp-lead mt-1.5" style={{ color: 'var(--text-secondary)' }}>{mission.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EVIDENCE_TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className="tp-meta rounded-[10px] px-3 py-2.5 font-bold"
              style={type === t.key
                ? { background: 'var(--brand-navy-900)', color: '#fff' }
                : { background: 'var(--background-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {type && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Title</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="mt-1 w-full rounded-[10px] border px-3 py-2.5 text-base md:text-sm outline-none"
                style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
              />
            </label>

            <label className="block">
              <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Link (optional)</span>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://"
                className="mt-1 w-full rounded-[10px] border px-3 py-2.5 text-base md:text-sm outline-none"
                style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
              />
            </label>

            <div>
              <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>File (optional)</span>
              <input ref={inputRef} type="file" onChange={pickFile} className="hidden" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed px-3 py-3 text-sm font-semibold"
                style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
              >
                {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                  : file ? <>Attached: {file.file_name}</>
                  : <><Upload size={14} /> Choose a file</>}
              </button>
            </div>

            <label className="block">
              <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>What did you produce or learn?</span>
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1 w-full rounded-[10px] border px-3 py-2.5 text-base md:text-sm outline-none"
                style={{ borderColor: 'var(--border-light)', background: 'var(--background-secondary)' }}
              />
            </label>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-[10px] p-3" style={{ background: 'var(--danger-50)', border: '1px solid #FECACA' }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--danger-700)' }} />
            <p className="tp-body" style={{ color: '#991B1B' }}>{error}</p>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border py-3 text-sm font-semibold"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!type || needsSomething || saving || uploading}
            className="flex-1 rounded-[10px] py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--brand-navy-900)' }}
          >
            {saving ? 'Saving…' : 'Save and complete'}
          </button>
        </div>
      </div>
    </div>
  );
}