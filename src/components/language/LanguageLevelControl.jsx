/**
 * The compact "Language Level" control. Same component wherever the setting
 * appears, so the student learns it once.
 *
 * It changes wording only. The label under it says so, because a student who
 * thinks a setting might reset their progress will not touch it.
 */
import { Languages } from 'lucide-react';
import { LEVELS, LEVEL_HINTS, LEVEL_LABELS } from '@/lib/language-level';

export default function LanguageLevelControl({ level, onChange, hint = true, className = '' }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tp-eyebrow inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <Languages size={12} /> Language level
        </span>
        <div className="relative">
          <select
            value={level}
            onChange={e => onChange(e.target.value)}
            aria-label="Language level"
            className="field-select tp-meta appearance-none rounded-[var(--r-control)] border bg-white py-1.5 pl-2.5 pr-7 font-bold"
            style={{ borderColor: 'var(--border-light)', color: 'var(--brand-navy-700)' }}
          >
            {LEVELS.map(l => (
              <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
            ))}
          </select>
          <span className="field-select-chevron pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>▾</span>
        </div>
      </div>
      {hint && (
        <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {LEVEL_HINTS[level]} Changing this changes the wording only, never the task or your progress.
        </p>
      )}
    </div>
  );
}