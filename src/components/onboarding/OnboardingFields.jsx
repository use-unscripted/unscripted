/**
 * The controls the intake's new questions need, and nothing else.
 *
 * Each one is uncontrolled about layout and controlled about value: it takes
 * the answer and a setter, and the page decides where it sits. Touch targets
 * are at least 44px because the intake is mostly used on a phone.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

const inputCls =
  'w-full rounded-[var(--r-control)] border px-3 py-2.5 text-base md:text-sm outline-none transition focus:border-[color:var(--brand-navy-900)]';
const inputStyle = { borderColor: 'var(--border-light)', background: 'var(--background-secondary)' };

export function Chip({ label, selected, onClick, small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center rounded-full border px-4 font-bold ${small ? 'min-h-[36px] text-[12px]' : 'min-h-[44px] text-[13px]'}`}
      style={{
        borderColor: selected ? 'var(--brand-navy-900)' : 'var(--ink-200)',
        background: selected ? 'var(--brand-navy-900)' : 'var(--brand-white)',
        color: selected ? '#fff' : 'var(--text-primary)',
      }}
    >
      {label}
    </button>
  );
}

/** A 1-10 baseline. The numbers are the control; no slider, no drag. */
export function Scale({ label, description, value, onChange, lowLabel, highLabel }) {
  return (
    <div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {description && (
        <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      )}
      <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className="min-h-[44px] rounded-[var(--r-control)] border text-sm font-bold"
            style={{
              borderColor: value === n ? 'var(--brand-navy-900)' : 'var(--ink-200)',
              background: value === n ? 'var(--brand-navy-900)' : 'var(--brand-white)',
              color: value === n ? '#fff' : 'var(--text-primary)',
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>{lowLabel}</span>
        <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>{highLabel}</span>
      </div>
    </div>
  );
}

/** A free list. Enter adds, the x removes, and an empty list is a valid answer. */
export function Tags({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    if (!value.some(v => v.toLowerCase() === text.toLowerCase())) onChange([...value, text]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } }}
          className={inputCls}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={add}
          className="ui-press inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-control)] border px-4 text-sm font-bold"
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '44px' }}
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map(v => (
            <span
              key={v}
              className="inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-[13px] font-bold"
              style={{ borderColor: 'var(--ink-200)', background: 'var(--brand-white)', color: 'var(--text-primary)' }}
            >
              {v}
              <button type="button" onClick={() => onChange(value.filter(x => x !== v))} aria-label={`Remove ${v}`}>
                <X size={13} style={{ color: 'var(--ink-400)' }} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tap any that apply, with an optional note underneath. */
export function ChipsMulti({ options, value = [], onChange, note, onNote, noteLabel, notePlaceholder }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <Chip key={o.value} label={o.label} selected={value.includes(o.value)} onClick={() => toggle(o.value)} />
        ))}
      </div>
      {noteLabel && (
        <label className="mt-4 block">
          <span className="tp-meta mb-2 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {noteLabel}
          </span>
          <input value={note || ''} placeholder={notePlaceholder} onChange={e => onNote(e.target.value)}
            className={inputCls} style={inputStyle} />
        </label>
      )}
    </>
  );
}

/**
 * One row per activity, five answers per row.
 *
 * "Never experienced this" is a real answer rather than a blank, because a
 * student who has never sold anything has told us about their exposure, not
 * their preference, and the two must not be stored as the same thing.
 */
export function Matrix({ items, responses, value = [], onChange }) {
  const answerFor = (activity) => value.find(v => v.activity === activity)?.response || '';
  const set = (activity, response) => {
    const rest = value.filter(v => v.activity !== activity);
    onChange(answerFor(activity) === response ? rest : [...rest, { activity, response }]);
  };

  return (
    <div className="space-y-4">
      {items.map(activity => (
        <div key={activity} className="rounded-[var(--r-control)] border p-3" style={{ borderColor: 'var(--border-light)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{activity}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {responses.map(r => (
              <Chip key={r.value} small label={r.label} selected={answerFor(activity) === r.value}
                onClick={() => set(activity, r.value)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** How much each factor matters. Several can be essential at once. */
export function ValuesGrid({ factors, levels, value = [], onChange, settings, setting, onSetting }) {
  const importanceFor = (factor) => value.find(v => v.factor === factor)?.importance || null;
  const set = (factor, importance) => {
    const rest = value.filter(v => v.factor !== factor);
    onChange(importanceFor(factor) === importance ? rest : [...rest, { factor, importance }]);
  };

  return (
    <div className="space-y-4">
      {factors.map(factor => (
        <div key={factor} className="rounded-[var(--r-control)] border p-3" style={{ borderColor: 'var(--border-light)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{factor}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {levels.map(l => (
              <Chip key={l.value} small label={l.label} selected={importanceFor(factor) === l.value}
                onClick={() => set(factor, l.value)} />
            ))}
          </div>
        </div>
      ))}
      <div>
        <p className="tp-meta mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Remote or in person
        </p>
        <div className="flex flex-wrap gap-2">
          {settings.map(s => (
            <Chip key={s.value} label={s.label} selected={setting === s.value}
              onClick={() => onSetting(setting === s.value ? '' : s.value)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * What the student has actually done. Tapping a kind records it; the detail
 * fields are folded away, because the answer we need is the list and the
 * detail is a bonus.
 */
export function Experiences({ kinds, value = [], onChange }) {
  const [open, setOpen] = useState(null);
  const entryFor = (kind) => value.find(e => e.kind === kind) || null;

  const toggle = (kind) => {
    if (entryFor(kind)) {
      onChange(value.filter(e => e.kind !== kind));
      if (open === kind) setOpen(null);
      return;
    }
    onChange([...value, { kind }]);
    setOpen(kind);
  };

  const patch = (kind, field, v) =>
    onChange(value.map(e => (e.kind === kind ? { ...e, [field]: v } : e)));

  return (
    <div className="space-y-2">
      {kinds.map(kind => {
        const entry = entryFor(kind);
        const isOpen = open === kind && entry;
        return (
          <div key={kind} className="rounded-[var(--r-control)] border" style={{ borderColor: entry ? 'var(--brand-navy-900)' : 'var(--border-light)' }}>
            <div className="flex items-center gap-2 p-2.5">
              <button
                type="button"
                onClick={() => toggle(kind)}
                aria-pressed={!!entry}
                className="flex min-h-[40px] flex-1 items-center text-left text-sm font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                <span
                  className="mr-3 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border"
                  style={{
                    borderColor: entry ? 'var(--brand-navy-900)' : 'var(--ink-200)',
                    background: entry ? 'var(--brand-navy-900)' : 'transparent',
                    color: '#fff',
                    fontSize: 12,
                  }}
                >
                  {entry ? '✓' : ''}
                </span>
                {kind}
              </button>
              {entry && (
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : kind)}
                  className="tp-meta inline-flex min-h-[40px] items-center gap-1 px-2 font-semibold"
                  style={{ color: 'var(--brand-navy-700)' }}
                >
                  Details {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>

            {isOpen && (
              <div className="space-y-3 border-t p-3" style={{ borderColor: 'var(--border-light)' }}>
                {[
                  { field: 'enjoyed', label: 'What did you enjoy?' },
                  { field: 'disliked', label: 'What did you dislike?' },
                  { field: 'learned', label: 'What did you learn?' },
                ].map(f => (
                  <label key={f.field} className="block">
                    <span className="tp-meta mb-1.5 block font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {f.label} <span className="font-normal">· optional</span>
                    </span>
                    <input value={entry[f.field] || ''} onChange={e => patch(kind, f.field, e.target.value)}
                      className={inputCls} style={inputStyle} />
                  </label>
                ))}
                <div>
                  <p className="tp-meta mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Would you do something similar again?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[{ value: 'yes', label: 'Yes' }, { value: 'maybe', label: 'Maybe' }, { value: 'no', label: 'No' }].map(o => (
                      <Chip key={o.value} small label={o.label} selected={entry.again === o.value}
                        onClick={() => patch(kind, 'again', entry.again === o.value ? '' : o.value)} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}