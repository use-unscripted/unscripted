/**
 * Student control. The record is private; these are the four things the student
 * can choose to generate from it, one at a time. Private reflection writing is
 * left out unless they tick the box themselves.
 */
import { useState } from 'react';
import { Lock, Download, Copy, Check } from 'lucide-react';
import { EXPORTS, buildExport } from '@/lib/decision-record-export';

export default function DecisionRecordExports({ record, proof = [] }) {
  const [includeReflections, setIncludeReflections] = useState(false);
  const [preview, setPreview] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = (key) => {
    const text = buildExport(key, record, { includeReflections, proof });
    setPreview({ key, label: EXPORTS.find(e => e.key === key)?.label, text });
    setCopied(false);
  };

  const download = () => {
    const blob = new Blob([preview.text], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${preview.key}-record.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(preview.text).catch(() => null);
    setCopied(true);
  };

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Share it only if you want to</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        This record is private. Generate one of these when you choose to, and read it before you hand it to anyone.
      </p>

      <p className="tp-meta mt-4 flex items-center gap-2 rounded-[var(--r-control)] px-3 py-2.5" style={{ background: 'var(--background-tertiary)', color: 'var(--ink-700)' }}>
        <Lock size={13} className="shrink-0" /> Your reflection writing is left out of every export by default.
      </p>

      <label className="touch-target mt-3 flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={includeReflections} onChange={e => setIncludeReflections(e.target.checked)} className="h-4 w-4" />
        <span className="tp-body" style={{ color: 'var(--ink-700)' }}>Include my own notes and corrections</span>
      </label>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {EXPORTS.map(e => (
          <button key={e.key} onClick={() => generate(e.key)}
            className="ui-lift rounded-[var(--r-control)] border p-3.5 text-left"
            style={{ borderColor: 'var(--border-light)', background: 'var(--background-primary)' }}>
            <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>{e.label}</p>
            <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{e.sub}</p>
          </button>
        ))}
      </div>

      {preview && (
        <div className="mt-5">
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{preview.label} · preview</p>
          <pre className="tp-meta mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[var(--r-control)] p-3.5"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)', color: 'var(--ink-700)' }}>
            {preview.text}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <button onClick={download} className="ui-press app-cta tp-control" style={{ minHeight: '44px' }}>
              <Download size={15} /> Download
            </button>
            <button onClick={copy} className="ui-press app-cta-secondary tp-control" style={{ minHeight: '44px' }}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}