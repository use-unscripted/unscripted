/**
 * "What you expected" against "what you experienced", for one experiment.
 *
 * Only ever renders what was actually answered. A historical experiment with no
 * baseline shows its outcome figures and says the expectation was never
 * recorded, rather than drawing an arrow from a number nobody gave.
 */
import { ArrowRight, Gauge, Activity } from 'lucide-react';
import { comparison, whatChanged } from '@/lib/expectation-reality';

function Pair({ row }) {
  const tone = row.delta === null || row.delta === 0
    ? 'var(--text-secondary)'
    : row.delta > 0 ? 'var(--success-700)' : 'var(--warning-700)';

  return (
    <div className="border-b border-[color:var(--ink-200)] py-3 last:border-0">
      <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
      {row.state === 'compared' ? (
        <div className="tp-body mt-1 flex flex-wrap items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <span>{row.preLabel} <strong style={{ color: 'var(--text-primary)' }}>{row.expected}/10</strong></span>
          <ArrowRight size={13} style={{ color: 'var(--ink-300)' }} />
          <span>{row.postLabel} <strong style={{ color: 'var(--text-primary)' }}>{row.actual}/10</strong></span>
          {row.delta !== 0 && (
            <span className="tp-meta rounded-full px-2 py-0.5 font-bold" style={{ background: 'var(--ink-100)', color: tone }}>
              {row.delta > 0 ? `+${row.delta}` : row.delta}
            </span>
          )}
        </div>
      ) : row.state === 'outcome_only' ? (
        <p className="tp-body mt-1" style={{ color: 'var(--text-secondary)' }}>
          {row.postLabel} <strong style={{ color: 'var(--text-primary)' }}>{row.actual}/10</strong>
          <span className="tp-meta"> · no expectation was recorded before this experiment</span>
        </p>
      ) : (
        <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>Not recorded.</p>
      )}
    </div>
  );
}

function Written({ label, value }) {
  if (!value) return null;
  return (
    <p className="tp-body mt-2 rounded-[var(--r-control)] px-3.5 py-2.5" style={{ background: 'var(--ink-50)', color: 'var(--ink-700)' }}>
      <span className="font-semibold">{label}: </span>{value}
    </p>
  );
}

/** Counts only, kept away from anything the student rated. */
function Behavioral({ b }) {
  if (!b) return null;
  const rows = [
    b.missions_completed !== null && b.missions_total !== null && { label: 'Missions completed', value: `${b.missions_completed} of ${b.missions_total}` },
    b.missions_skipped !== null && b.missions_skipped > 0 && { label: 'Missions skipped', value: String(b.missions_skipped) },
    b.minutes_spent !== null && { label: 'Time spent', value: `${b.minutes_spent} minutes` },
    b.optional_work_completed && { label: 'Optional work completed', value: 'Yes' },
    b.professional_conversation_completed !== null && { label: 'Professional conversation', value: b.professional_conversation_completed ? 'Completed' : 'Not completed' },
    typeof b.evidence_submitted === 'number' && { label: 'Evidence submitted', value: String(b.evidence_submitted) },
    b.desire_to_repeat !== null && b.desire_to_repeat !== undefined && { label: 'Desire to repeat', value: `${b.desire_to_repeat}/10` },
  ].filter(Boolean);
  if (!rows.length) return null;

  return (
    <div className="mt-5 rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-tertiary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <Activity size={12} /> What you did
      </p>
      <div className="mt-2">
        {rows.map(r => (
          <div key={r.label} className="tp-body flex items-center justify-between gap-3 py-1.5">
            <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.value}</span>
          </div>
        ))}
      </div>
      <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
        Counts only. Finishing something is not read as enjoying it, and finding it hard is not read as a poor fit.
      </p>
    </div>
  );
}

export default function ExpectationReality({ m, behavioral }) {
  const c = comparison(m);
  if (!c.hasOutcome) return null;
  const changes = whatChanged(m);
  const b = behavioral || m?.behavioral_snapshot || null;

  return (
    <div>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--brand-navy-700)' }}>
        <Gauge size={12} /> What you expected vs what you experienced
      </p>

      <div className="mt-2">
        {c.rows.map(r => <Pair key={r.key} row={r} />)}
        {c.outcomes.map(r => (
          <div key={r.key} className="flex items-center justify-between gap-3 border-b border-[color:var(--ink-200)] py-3 last:border-0">
            <span className="tp-body" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
            <span className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{r.value}/10</span>
          </div>
        ))}
        {typeof m.system_performance_score === 'number' && (
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="tp-body" style={{ color: 'var(--text-secondary)' }}>Unscripted's rating of the work</span>
            <span className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{m.system_performance_score}/10</span>
          </div>
        )}
      </div>

      {!c.hasBaseline && (
        <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
          No expectations were recorded before this experiment, so there is nothing to compare against. Only what you reported afterwards is shown.
        </p>
      )}

      <div className="mt-5">
        <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>What changed?</p>
        <ul className="mt-2 space-y-1.5">
          {changes.map((line, i) => (
            <li key={i} className="tp-body flex gap-2" style={{ color: 'var(--ink-700)' }}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--brand-navy-700)' }} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
          These are your own answers placed side by side. Unscripted does not claim to know why they moved.
        </p>
      </div>

      {(m.biggest_expected_positive || m.biggest_concern || m.expectation_prediction) && (
        <div className="mt-5">
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>What you said beforehand</p>
          <Written label="Expected to like most" value={m.biggest_expected_positive} />
          <Written label="Main concern" value={m.biggest_concern} />
          <Written label="What you thought this would tell you" value={m.expectation_prediction} />
        </div>
      )}

      {(m.biggest_positive || m.biggest_negative || m.surprise_reflection || m.assumption_that_changed) && (
        <div className="mt-5">
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>What you said afterwards</p>
          <Written label="Best part" value={m.biggest_positive} />
          <Written label="Worst part" value={m.biggest_negative} />
          <Written label="Biggest surprise" value={m.surprise_reflection} />
          <Written label="An assumption that changed" value={m.assumption_that_changed} />
        </div>
      )}

      <Behavioral b={b} />
    </div>
  );
}