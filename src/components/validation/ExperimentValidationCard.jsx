import { useState } from 'react';
import { ShieldCheck, Clock, Users } from 'lucide-react';
import StrengthMeter from '@/components/validation/StrengthMeter';
import PersonalValuePanel from '@/components/validation/PersonalValuePanel';
import TestsAndLimits from '@/components/validation/TestsAndLimits';
import HowValidatedPanel from '@/components/validation/HowValidatedPanel';
import RereviewNotice from '@/components/validation/RereviewNotice';
import { REREVIEW_LABEL } from '@/lib/experiment-revision';
import { Sk } from '@/components/PageSkeleton';

/**
 * The Experiment Validation Card, at the top of an experiment. Answers, in one
 * glance: how well validated this experiment is, how useful it is for this
 * student, what it tests, and what it cannot simulate.
 */
export default function ExperimentValidationCard({ reading, pathName }) {
  const [showHow, setShowHow] = useState(false);

  if (!reading) {
    return (
      <section className="app-card p-5 sm:p-6">
        <Sk h={16} w={180} />
        <div className="mt-4"><Sk h={64} /></div>
      </section>
    );
  }
  if (reading.error) return null;

  const { strength, value, validation, minutes } = reading;
  const timeLabel = validation?.estimated_minutes_low && validation?.estimated_minutes_high
    ? `${validation.estimated_minutes_low}-${validation.estimated_minutes_high} min`
    : minutes ? `about ${Math.round(minutes)} min` : null;

  return (
    <section className="app-card p-5 sm:p-6">
      {showHow && <HowValidatedPanel reading={reading} onClose={() => setShowHow(false)} />}

      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <ShieldCheck size={13} /> Experiment strength
      </p>
      <div className="mt-3"><StrengthMeter strength={strength} /></div>

      <RereviewNotice strength={strength} validation={validation} />

      <div className="tp-meta mt-4 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ color: 'var(--text-muted)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {/* While a material update is awaiting re-review, the previous
              version's badge would be a claim about work this experiment no
              longer asks for. */}
          {strength.rereview_pending ? REREVIEW_LABEL : strength.validation_level_meta.label}
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} /> {strength.reviewer_count} professional review{strength.reviewer_count === 1 ? '' : 's'}
        </span>
        {timeLabel && <span className="flex items-center gap-1"><Clock size={12} /> {timeLabel}</span>}
        {strength.last_reviewed_at && (
          <span>Last reviewed {new Date(strength.last_reviewed_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowHow(true)}
        className="app-cta-secondary tp-control mt-4 inline-flex"
      >
        How was this validated?
      </button>

      <div className="mt-5"><PersonalValuePanel value={value} pathName={pathName} /></div>

      <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border-light)' }}>
        <TestsAndLimits validation={validation} tests={value.tested.concat(value.untested)} />
      </div>

      {!strength.sufficient && (
        <p className="tp-meta mt-5" style={{ color: 'var(--text-muted)' }}>
          Your reaction to this experiment is still useful, but it has limited validation so far, so
          Unscripted will treat the evidence it produces cautiously.
        </p>
      )}
    </section>
  );
}