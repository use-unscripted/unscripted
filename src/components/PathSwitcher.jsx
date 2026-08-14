import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Star, Circle, PauseCircle, CheckCircle2, Archive } from 'lucide-react';

const STATUS_CFG = {
  active:    { label: 'Active',    bg: 'var(--success-50)', text: 'var(--success-700)', Icon: Circle },
  draft:     { label: 'Draft',     bg: 'var(--ink-100)', text: 'var(--ink-500)', Icon: Circle },
  paused:    { label: 'Paused',    bg: 'var(--warning-50)', text: 'var(--warning-700)', Icon: PauseCircle },
  completed: { label: 'Completed', bg: 'var(--info-50)', text: 'var(--info-700)', Icon: CheckCircle2 },
  archived:  { label: 'Archived',  bg: 'var(--ink-100)', text: 'var(--ink-400)', Icon: Archive },
  exploring: { label: 'Exploring', bg: 'var(--ink-100)', text: 'var(--brand-navy-700)', Icon: Circle },
};

function statusCfg(s) { return STATUS_CFG[s] || STATUS_CFG.exploring; }

export default function PathSwitcher({ paths = [], selectedId, onChange, showAll = true, className = '' }) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Position dropdown relative to button on open
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: rect.width,
        zIndex: 99999,
      });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = selectedId === 'all' ? null : paths.find(p => p.id === selectedId);
  const cfg = selected ? statusCfg(selected.status) : null;

  const activePaths = paths.filter(p => ['active', 'draft', 'exploring'].includes(p.status));
  const otherPaths = paths.filter(p => !['active', 'draft', 'exploring'].includes(p.status));

  const dropdown = open && (
    <div
      ref={dropdownRef}
      className="anim-scale-in w-72 rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white shadow-xl py-1.5 overflow-y-auto"
      style={{ ...dropdownStyle, maxHeight: '320px' }}
      onWheel={e => e.stopPropagation()}
    >
      {showAll && (
        <button
          onClick={() => { onChange('all'); setOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-[color:var(--ink-100)] ${selectedId === 'all' ? 'bg-[color:var(--ink-100)]' : ''}`}
        >
          <span className="font-semibold text-[color:var(--ink-700)]">All Paths</span>
        </button>
      )}

      {activePaths.length > 0 && (
        <>
          <p className="tp-eyebrow px-4 pt-2.5 pb-1.5 text-[color:var(--ink-400)]">Active</p>
          {activePaths.map(p => {
            const c = statusCfg(p.status);
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-[color:var(--ink-100)] ${selectedId === p.id ? 'bg-[color:var(--ink-100)]' : ''}`}
              >
                {p.is_primary_focus && <Star size={13} className="shrink-0" style={{ color: 'var(--brand-gold-500)' }} />}
                {!p.is_primary_focus && <div className="w-[13px] shrink-0" />}
                <span className="flex-1 font-semibold text-[color:var(--surface-dark-900)] text-left truncate">{p.path_name}</span>
                <span className="tp-meta shrink-0 rounded-full px-2.5 py-0.5 font-bold" style={{ background: c.bg, color: c.text }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </>
      )}

      {otherPaths.length > 0 && (
        <>
          <p className="tp-eyebrow px-4 pt-2.5 pb-1.5 text-[color:var(--ink-400)]">Other</p>
          {otherPaths.map(p => {
            const c = statusCfg(p.status);
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-[color:var(--ink-100)] ${selectedId === p.id ? 'bg-[color:var(--ink-100)]' : ''}`}
              >
                <div className="w-[13px] shrink-0" />
                <span className="flex-1 font-semibold text-[color:var(--ink-700)] text-left truncate">{p.path_name}</span>
                <span className="tp-meta shrink-0 rounded-full px-2.5 py-0.5 font-bold" style={{ background: c.bg, color: c.text }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </>
      )}

      {paths.length === 0 && (
        <p className="tp-body px-4 py-3 text-[color:var(--ink-400)]">No paths yet.</p>
      )}
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        className="ui-press flex items-center gap-2 rounded-[var(--r-control)] border bg-white px-3 py-2 text-sm font-semibold min-w-[180px] max-w-[280px]"
        style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-navy-700)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
      >
        {selected ? (
          <>
            {selected.is_primary_focus && <Star size={13} className="shrink-0" style={{ color: 'var(--brand-gold-500)' }} />}
            <span className="flex-1 truncate text-left">{selected.path_name}</span>
            <span className="tp-meta shrink-0 rounded-full px-2.5 py-0.5 font-bold" style={{ background: cfg.bg, color: cfg.text }}>
              {cfg.label}
            </span>
          </>
        ) : (
          <span className="flex-1 text-left text-[color:var(--ink-500)]">All Paths</span>
        )}
        <ChevronDown size={14} className={`shrink-0 text-[color:var(--ink-400)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {createPortal(dropdown, document.body)}
    </div>
  );
}