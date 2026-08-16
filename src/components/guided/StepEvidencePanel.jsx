/**
 * "What demonstrates that you completed this step?" — asked inside the step, so
 * the student never maps proof to an experiment afterwards. Saves through the
 * existing ProofOfWork chain with a per-step key, so pressing save twice updates
 * one record instead of creating two.
 */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { EVIDENCE_TYPES } from '@/lib/mission-completion';
import { saveStepEvidence } from '@/lib/guide-progress';
import { MAX_FILES, fmtSize, getExt } from '@/components/experiments/ProofFiles';

const field = {
  borderColor: 'var(--border-light)',
  background: 'var(--background-secondary)',
};

export default function StepEvidencePanel({ guide, stepNumber, step, experiment, mission, path, existing, onSaved, keySuffix, heading }) {
  const [type, setType] = useState(null);
  const [title, setTitle] = useState(step?.title || '');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  /* The evidence form was reached. Its pair, evidence_completed, fires on save,
     so the two together say whether students who got here finished. */
  useEffect(() => {
    if (existing || !experiment?.id) return;
    import('@/lib/analytics/decision-funnel-events')
      .then(m => m.evidenceStarted({ experimentId: experiment.id, pathId: experiment.path_id || path?.id, step: stepNumber }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment?.id, stepNumber, Boolean(existing)]);

  const pickFile = async (e) => {
    const chosen = Array.from(e.target.files || []).slice(0, MAX_FILES - files.length);
    e.target.value = '';
    if (!chosen.length) return;
    setError('');
    setUploading(true);
    try {
      const uploaded = await Promise.all(chosen.map(async (f) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        return { file_url, file_name: f.name, file_size: f.size, mime_type: f.type };
      }));
      setFiles(prev => [...prev, ...uploaded].slice(0, MAX_FILES));
    } catch {
      setError('That file did not upload. Try again, or describe it instead.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const proof = await saveStepEvidence({
        guide, stepNumber, step, experiment, mission, path, keySuffix,
        evidence: { type: type || 'other', title, description, external_url: url, files },
      });
      onSaved(proof);
    } catch {
      setError('We could not save that. Nothing was half-saved. Press save again.');
    } finally {
      setSaving(false);
    }
  };

  if (existing) {
    return (
      <div className="mt-4 rounded-[var(--r-control)] p-4" style={{ background: 'var(--success-50)', border: '1px solid #BBF7D0' }}>
        <p className="tp-body flex items-center gap-2 font-bold" style={{ color: '#166534' }}>
          <CheckCircle2 size={15} /> Evidence saved for this step
        </p>
        <p className="tp-body mt-1 flex items-center gap-1.5" style={{ color: '#166534' }}>
          <FileText size={13} /> {existing.title}
        </p>
      </div>
    );
  }

  const nothingYet = files.length === 0 && !url.trim() && !description.trim();

  return (
    <div className="mt-4 rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
        {heading || 'What demonstrates that you completed this step?'}
      </p>
      {!heading && step?.proof_capture && (
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{step.proof_capture}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {EVIDENCE_TYPES.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className="tp-meta rounded-[var(--r-control)] px-3 font-bold"
            style={type === t.key
              ? { background: 'var(--brand-navy-900)', color: '#fff', minHeight: '44px' }
              : { background: '#fff', color: 'var(--text-primary)', border: '1px solid var(--border-light)', minHeight: '44px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        <label className="block">
          <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Title</span>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="mt-1 w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm" style={field} />
        </label>
        <label className="block">
          <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Link (optional)</span>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://"
            className="mt-1 w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm" style={field} />
        </label>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Files (optional)</span>
            <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>
              {files.length} of {MAX_FILES} attached
            </span>
          </div>
          {files.map((f, i) => (
            <div key={f.file_url + i}
              className="mt-1.5 flex items-center gap-2 rounded-[var(--r-control)] border px-3 py-2"
              style={{ borderColor: 'var(--border-light)', background: '#fff' }}>
              <FileText size={14} style={{ color: 'var(--brand-navy-700)' }} className="shrink-0" />
              <span className="tp-meta min-w-0 flex-1 truncate font-semibold" style={{ color: 'var(--text-primary)' }}>{f.file_name}</span>
              <span className="tp-meta shrink-0" style={{ color: 'var(--text-muted)' }}>
                {fmtSize(f.file_size || 0)} · {getExt(f.file_name).toUpperCase()}
              </span>
              <button type="button" aria-label={`Remove ${f.file_name}`}
                onClick={() => setFiles(prev => prev.filter((_, n) => n !== i))}
                className="shrink-0 text-[color:var(--ink-400)] hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <input ref={inputRef} type="file" multiple onChange={pickFile} className="hidden" />
          {files.length < MAX_FILES ? (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="tp-body mt-1.5 flex w-full items-center justify-center gap-2 rounded-[var(--r-control)] border border-dashed px-3 font-semibold"
              style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)', minHeight: '48px' }}>
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                : <><Upload size={14} /> {files.length ? 'Add another file' : 'Choose files — you can pick several at once'}</>}
            </button>
          ) : (
            <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
              That is the maximum of {MAX_FILES} files. Remove one to attach something else.
            </p>
          )}
        </div>
        <label className="block">
          <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Or describe what you completed</span>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
            className="mt-1 w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base outline-none md:text-sm" style={field} />
        </label>
      </div>

      {error && <p className="tp-body mt-2 font-semibold" style={{ color: 'var(--danger-700)' }}>{error}</p>}

      <button type="button" onClick={save} disabled={saving || uploading || nothingYet}
        className="ui-press tp-body mt-3 w-full rounded-[var(--r-control)] px-5 font-bold text-white disabled:opacity-50 sm:w-auto"
        style={{ background: 'var(--brand-navy-900)', minHeight: '48px' }}>
        {saving ? 'Saving…' : 'Save this evidence'}
      </button>
    </div>
  );
}