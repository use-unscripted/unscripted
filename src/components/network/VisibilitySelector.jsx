import { useState } from 'react';
import { Eye, Lock, Users, Globe } from 'lucide-react';
import { VISIBILITY_OPTIONS } from '@/lib/network-utils';

const ICONS = { private: Lock, followers: Users, my_university: Eye, all_unscripted: Globe };

/**
 * Inline visibility selector for a Path or Proof record.
 * Props: value, onChange(newValue), disabled
 */
export default function VisibilitySelector({ value = 'private', onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const current = VISIBILITY_OPTIONS.find(o => o.value === value) || VISIBILITY_OPTIONS[0];
  const Icon = ICONS[current.value] || Lock;

  const select = (opt) => {
    if (opt.value === value) { setOpen(false); return; }
    if (opt.value !== 'private') {
      setConfirming(opt);
    } else {
      onChange(opt.value);
      setOpen(false);
    }
  };

  const confirm = () => {
    onChange(confirming.value);
    setConfirming(null);
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-50"
        style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
      >
        <Icon size={11} /> {current.label}
      </button>

      {open && !confirming && (
        <div className="absolute z-50 left-0 top-full mt-1 w-52 rounded-[14px] border border-[#E2E8F0] bg-white shadow-lg overflow-hidden">
          {VISIBILITY_OPTIONS.map(opt => {
            const OIcon = ICONS[opt.value];
            return (
              <button key={opt.value} type="button" onClick={() => select(opt)}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-[#F8FAFC] transition"
              >
                <OIcon size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{opt.label}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {confirming && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 rounded-[14px] border border-[#E2E8F0] bg-white shadow-lg p-4">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Change visibility?</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            This will make this item visible to <strong>{confirming.label}</strong>. {confirming.desc}
          </p>
          <div className="flex gap-2">
            <button onClick={confirm} className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
              Confirm
            </button>
            <button onClick={() => { setConfirming(null); setOpen(false); }}
              className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close overlay */}
      {(open || confirming) && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirming(null); }} />
      )}
    </div>
  );
}