/**
 * The compact "Language Level" control. Same component wherever the setting
 * appears, so the student learns it once.
 *
 * It changes wording only. The label under it says so, because a student who
 * thinks a setting might reset their progress will not touch it.
 */
import { Languages } from 'lucide-react';
import { LEVELS, LEVEL_HINTS, LEVEL_LABELS } from '@/lib/language-level';
import FieldSelect from '@/components/ui/FieldSelect';

export default function LanguageLevelControl({ level, onChange, hint = true, className = '' }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tp-eyebrow inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <Languages size={12} /> Language level
        </span>
        <FieldSelect
          value={level}
          onChange={onChange}
          ariaLabel="Language level"
          options={LEVELS.map(l => ({ value: l, label: LEVEL_LABELS[l] }))}
          className="w-auto font-bold"
        />
      </div>
      {hint && (
        <p className="tp-meta mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {LEVEL_HINTS[level]} Changing this changes the wording only, never the task or your progress.
        </p>
      )}
    </div>
  );
}