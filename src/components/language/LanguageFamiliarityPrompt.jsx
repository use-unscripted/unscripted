/**
 * Asked once per path, at the start of an experiment, and skippable. Never
 * inferred from a major, a school, an age or a previous path: those predict how
 * a student is supposed to sound, not what they actually know.
 */
import { FAMILIARITY_OPTIONS } from '@/lib/language-level';

export default function LanguageFamiliarityPrompt({ careerName, onChoose, onSkip }) {
  return (
    <section
      className="rounded-[var(--r-surface)] bg-white p-5"
      style={{ border: '1px solid var(--brand-gold-500)' }}
    >
      <p className="tp-card" style={{ color: 'var(--text-primary)' }}>
        How familiar are you with the language used in {careerName ? `${careerName}` : 'this field'}?
      </p>
      <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>
        This only changes how the steps are worded. You can change it at any time, and it is not a
        judgement of ability.
      </p>
      <div className="mt-4 space-y-2">
        {FAMILIARITY_OPTIONS.map(opt => (
          <button
            key={opt.level}
            type="button"
            onClick={() => onChoose(opt.level)}
            className="tp-body w-full rounded-[var(--r-control)] border px-4 text-left font-semibold"
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)', minHeight: '48px' }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="touch-reach tp-meta mt-3 font-semibold"
        style={{ color: 'var(--brand-navy-700)' }}
      >
        Skip for now
      </button>
    </section>
  );
}