import { useState } from 'react';
import { ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { FIT_DIMENSIONS } from '@/lib/career-fit-dimensions';

const COLOR = {
  ability_fit: 'var(--brand-navy-900)',
  enjoyment_fit: 'var(--brand-gold-600)',
  work_environment_fit: 'var(--info-600)',
  preference_fit: 'var(--brand-navy-700)',
  interest_fit: 'var(--success-700)',
};

function Row({ label, value, hint, color, observations }) {
  const measured = typeof value === 'number';
  return (
    <div>
      <div className="tp-meta flex items-baseline justify-between" style={{ color: 'var(--ink-500)' }}>
        <span>{label}</span>
        <span className="font-semibold" style={{ color: measured ? 'var(--surface-dark-900)' : 'var(--ink-400)' }}>
          {measured ? `${value}%` : 'Not measured yet'}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--ink-100)' }}>
        {measured && <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />}
      </div>
      {(hint || measured) && (
        <p className="tp-meta mt-1" style={{ color: 'var(--ink-400)' }}>
          {measured
            ? `From ${observations} relevant observation${observations === 1 ? '' : 's'}.${observations < 2 ? ' Not yet a repeated pattern.' : ''}`
            : hint}
        </p>
      )}
    </div>
  );
}

/**
 * The ability-versus-enjoyment reading for one career hypothesis.
 *
 * Ability and enjoyment sit side by side at the top because they are the two
 * dimensions the product must never collapse into each other. The remaining
 * dimensions, the self-versus-observed gap and the open dimensions live behind
 * "View fit breakdown" so the card stays clean.
 */
export default function FitBreakdown({ fit, overall, evidenceShare, compact = false }) {
  const [open, setOpen] = useState(false);
  if (!fit) return null;

  const { dimensions, scores, narrative, uncertain, self_perception: self, state } = fit;
  const ability = dimensions.ability_fit;
  const enjoyment = dimensions.enjoyment_fit;

  return (
    <div className="mt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Ability" value={ability.score} observations={ability.observations}
          color={COLOR.ability_fit}
          hint="Ability is still uncertain until reviewed performance or proof of work exists." />
        <Row label="Enjoyment" value={enjoyment.score} observations={enjoyment.observations}
          color={COLOR.enjoyment_fit}
          hint="Enjoyment is still uncertain until you rate how the work actually felt." />
      </div>

      <div className="mt-3 rounded-[var(--r-control)] p-3.5" style={{ background: 'white', border: '1px solid var(--border-light)' }}>
        <p className="tp-body font-semibold" style={{ color: 'var(--surface-dark-900)' }}>{narrative.headline}</p>
        <p className="tp-meta mt-1" style={{ color: 'var(--ink-500)' }}>{narrative.body}</p>
      </div>

      <button onClick={() => setOpen(o => !o)}
        className="tp-meta touch-reach mt-3 flex items-center gap-1.5 font-semibold"
        style={{ color: 'var(--brand-navy-700)' }}>
        <Scale size={13} /> {open ? 'Hide fit breakdown' : 'View fit breakdown'}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="mt-3 space-y-4 rounded-[var(--r-control)] p-4" style={{ background: 'white', border: '1px solid var(--border-light)' }}>
          {!compact && typeof overall === 'number' && (
            <p className="tp-meta" style={{ color: 'var(--ink-500)' }}>
              Overall fit of {overall}% blends these dimensions with this path's starting estimate, weighted by how much
              evidence each one carries. It is never ability alone.
              {typeof evidenceShare === 'number' && ` Measured evidence currently accounts for ${evidenceShare}% of it.`}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {FIT_DIMENSIONS.map(({ key, label, question }) => (
              <Row key={key} label={label} value={scores[key]} observations={dimensions[key].observations}
                color={COLOR[key]} hint={question} />
            ))}
          </div>

          <div>
            <p className="tp-eyebrow mb-1.5" style={{ color: 'var(--ink-500)' }}>Evidence confidence</p>
            <Row label="How much evidence stands behind these numbers" value={scores.evidence_confidence}
              observations={0} color="var(--brand-gold-600)" hint="" />
          </div>

          {self.discrepancy !== null && (
            <div className="rounded-[var(--r-control)] p-3" style={{ background: 'var(--ink-50)' }}>
              <p className="tp-eyebrow mb-1" style={{ color: 'var(--ink-500)' }}>How you rated yourself versus what was observed</p>
              <p className="tp-body" style={{ color: 'var(--ink-700)' }}>
                You rated your own performance at {self.self_rated_ability}%, and reviewed performance came out at {self.observed_ability}%.
                We are recording that gap rather than explaining it. Future work will show what it means.
              </p>
            </div>
          )}

          {uncertain.length > 0 && (
            <div>
              <p className="tp-eyebrow mb-1.5" style={{ color: 'var(--ink-500)' }}>Still uncertain</p>
              <ul className="space-y-1.5">
                {uncertain.map(u => (
                  <li key={u.key} className="tp-meta" style={{ color: 'var(--ink-500)' }}>{u.note}</li>
                ))}
              </ul>
            </div>
          )}

          {state === 'high_ability_low_enjoyment' && (
            <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
              Strong ability alone does not rank a career as ideal here, so this path is not promoted on that basis.
            </p>
          )}
          {state === 'developing_ability_high_enjoyment' && (
            <p className="tp-meta" style={{ color: 'var(--ink-400)' }}>
              Ability can develop with practice, so nothing here rules this path out.
            </p>
          )}
        </div>
      )}
    </div>
  );
}