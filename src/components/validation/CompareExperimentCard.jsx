import { Link } from 'react-router-dom';
import { Clock, Users, Star, Check, Circle } from 'lucide-react';
import StrengthMeter from '@/components/validation/StrengthMeter';

/** One experiment in the comparison: strength, value for you, and the trade-off. */
export default function CompareExperimentCard({ row, isBestNextTest, isBestValidated }) {
  const { experiment, validation, strength, value, minutes } = row;
  const time = validation?.estimated_minutes_low && validation?.estimated_minutes_high
    ? `${validation.estimated_minutes_low}-${validation.estimated_minutes_high} min`
    : minutes ? `about ${Math.round(minutes)} min` : null;

  return (
    <section
      className="app-card flex flex-col p-5"
      style={isBestNextTest ? { border: '1px solid var(--brand-gold-500)' } : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isBestNextTest && (
          <span
            className="tp-meta inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold"
            style={{ background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }}
          >
            <Star size={12} /> Best next test for you
          </span>
        )}
        {isBestValidated && !isBestNextTest && (
          <span
            className="tp-meta inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold"
            style={{ background: 'var(--ink-100)', color: 'var(--text-secondary)' }}
          >
            Most validated
          </span>
        )}
      </div>

      <h3 className="tp-card mt-3" style={{ color: 'var(--text-primary)' }}>{experiment.title}</h3>
      {validation?.what_it_does && (
        <p className="tp-meta mt-1" style={{ color: 'var(--text-secondary)' }}>{validation.what_it_does}</p>
      )}

      <div className="mt-4"><StrengthMeter strength={strength} compact /></div>
      <div className="tp-meta mt-2 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ color: 'var(--text-muted)' }}>
        <span>{strength.validation_level_meta.label}</span>
        <span className="flex items-center gap-1"><Users size={12} /> {strength.reviewer_count}</span>
        {time && <span className="flex items-center gap-1"><Clock size={12} /> {time}</span>}
      </div>

      <div className="app-inset mt-4 p-3" style={{ background: 'var(--background-secondary)' }}>
        <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>Value for you</p>
        <p className="tp-card mt-0.5" style={{ color: 'var(--text-primary)' }}>{value.level_label}</p>
        <p className="tp-meta mt-0.5" style={{ color: 'var(--text-secondary)' }}>{value.headline}</p>
      </div>

      <ul className="mt-4 space-y-1.5">
        {(value.untested || []).slice(0, 3).map(d => (
          <li key={d.dimension} className="tp-meta flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
            <Check size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--success-700)' }} />
            Would answer: {d.label.toLowerCase()}
          </li>
        ))}
        {(validation?.career_characteristics_not_represented || []).slice(0, 2).map(c => (
          <li key={c} className="tp-meta flex items-start gap-2" style={{ color: 'var(--text-muted)' }}>
            <Circle size={11} className="mt-1 shrink-0" /> Cannot show: {c.toLowerCase()}
          </li>
        ))}
      </ul>

      <Link
        to={`/experiment?experimentId=${experiment.id}`}
        className={`ui-press tp-control mt-5 ${isBestNextTest ? 'app-cta' : 'app-cta-secondary'}`}
        style={{ minHeight: '48px' }}
      >
        {isBestNextTest ? 'Start this test' : 'Open this test'}
      </Link>
    </section>
  );
}