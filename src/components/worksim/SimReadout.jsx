/**
 * The read-out, rendered.
 *
 * Everything a student reads here is written in `src/lib/work-sim-readout.js`
 * and handed over as data. This file draws it and adds no sentences of its own,
 * which is the whole point: the anti-horoscope rules in that module are enforced
 * on the strings it authors, so a rule can only be broken here by writing new
 * copy. Four short labels are the exception (the page title, the three names for
 * a row with nothing in it, the two words beside a check, and the line shown if
 * the read-out cannot be built) and none of them make a claim about anybody.
 *
 * Three things are load bearing:
 *
 * **The four blocks always draw, in order, whatever the data holds.** Block C
 * has no reference spec written yet, so it draws the module's own account of why
 * it is empty instead of quietly disappearing. A block that vanishes is a block
 * nobody notices is missing.
 *
 * **A row with no gap is a result, not a hole.** `gap` and `no_gap` both draw at
 * full weight with their numbers in the copy. Only the three statuses that have
 * nothing to compare (`no_prediction`, `no_outcome`, `not_comparable`) get the
 * quieter treatment and a label saying which piece is absent. Same geometry, so
 * the degraded screen reads as deliberate rather than broken.
 *
 * **No score, no percentage, no verdict, no tick beside a count.** The checks
 * carry a word each and no colour, because "three of five passed" with a green
 * tick next to it is exactly the summary judgement this product is sold on not
 * making.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { buildWorkSimReadout } from '@/lib/work-sim-readout';

/** Rows that put a number against a prediction. These draw at full weight. */
const CLAIM_STATUSES = new Set(['gap', 'no_gap']);

/** What is missing, for the rows where something is. */
const ABSENCE_LABELS = {
  no_prediction: 'No prediction',
  no_outcome: 'Nothing recorded',
  not_comparable: 'No number to compare',
};

function Falsifier({ label, text }) {
  if (!text) return null;
  return (
    <div className="app-inset mt-3.5 p-3.5" style={{ background: 'var(--background-secondary)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="tp-meta mt-1.5" style={{ color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  );
}

function Block({ heading, children }) {
  return (
    <section className="app-card tp-card-body" aria-label={heading}>
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>{heading}</h2>
      {children}
    </section>
  );
}

function PredictionRow({ row, falsifierLabel }) {
  const claim = CLAIM_STATUSES.has(row.status);
  const absence = ABSENCE_LABELS[row.status] || null;

  return (
    <div data-testid={`prediction-${row.id}`} data-status={row.status} className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="tp-card" style={{ color: 'var(--text-primary)' }}>{row.label}</h3>
        {absence && (
          <span className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>{absence}</span>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {row.lines.map((line, i) => (
          <p
            key={i}
            className="tp-body tp-prose"
            style={{ color: claim ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            {line}
          </p>
        ))}
      </div>

      <Falsifier label={falsifierLabel} text={row.falsifier} />
    </div>
  );
}

function CheckRow({ row, falsifierLabel }) {
  const Icon = row.passed ? Check : Minus;
  return (
    <div data-testid={`check-${row.id}`} className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2.5">
        <Icon size={17} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="tp-body font-semibold" style={{ color: 'var(--text-primary)' }}>{row.criterion}</p>
          <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {row.passed ? 'Passed' : 'Did not pass'}
          </p>
          {row.evidence && (
            <p className="tp-body tp-prose mt-2 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {row.evidence.text}
            </p>
          )}
          <Falsifier label={falsifierLabel} text={row.falsifier} />
        </div>
      </div>
    </div>
  );
}

function SpecColumn({ label, text, byline = null }) {
  return (
    <div>
      <p className="tp-label" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {byline && <p className="tp-meta mt-0.5" style={{ color: 'var(--text-muted)' }}>{byline}</p>}
      <pre
        className="tp-body app-inset mt-2.5 max-h-96 overflow-auto whitespace-pre-wrap p-4 font-body"
        style={{ background: 'var(--background-secondary)', color: 'var(--text-secondary)' }}
      >{text}</pre>
    </div>
  );
}

function Divided({ children }) {
  return (
    <div className="mt-5 divide-y" style={{ borderColor: 'var(--border-light)' }}>
      {children}
    </div>
  );
}

function Fallback() {
  return (
    <section className="app-card tp-card-body">
      <h1 className="tp-section" style={{ color: 'var(--text-primary)' }}>Your read-out</h1>
      <p className="tp-body tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>
        Your run is saved. The read-out did not build, so there is nothing here to show you. We are
        not going to fill the gap with numbers we made up.
      </p>
      <Link to="/journey" className="tp-control ui-press app-cta-secondary mt-5" style={{ minHeight: '48px' }}>
        Back to My Journey
      </Link>
    </section>
  );
}

export default function SimReadout({ run, measurement, sim = null, reference = null }) {
  const readout = useMemo(() => {
    try {
      return buildWorkSimReadout(run, measurement, { sim, reference });
    } catch {
      // The module throws when its own rules are broken, which is a code defect
      // and not anything a student typed. Better an honest empty screen than a
      // white one.
      return null;
    }
  }, [run, measurement, sim, reference]);

  if (!readout) return <Fallback />;

  const { predictions, checks, comparison, limits } = readout.blocks;
  const byline = comparison.reference
    ? [comparison.reference.author, comparison.reference.role].filter(Boolean).join(' · ')
    : null;

  return (
    <div className="space-y-6">
      <header>
        {readout.simulation.title && (
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
            {[readout.simulation.title, readout.simulation.career_name].filter(Boolean).join(' · ')}
          </p>
        )}
        <h1 className="tp-page mt-1.5" style={{ color: 'var(--text-primary)' }}>Your read-out</h1>
        {readout.note && (
          <p className="tp-body tp-prose mt-2.5" style={{ color: 'var(--text-secondary)' }}>{readout.note}</p>
        )}
      </header>

      {/* Block A. */}
      <Block heading={predictions.heading}>
        <Divided>
          {predictions.rows.map(row => (
            <PredictionRow key={row.id} row={row} falsifierLabel={predictions.falsifier_label} />
          ))}
        </Divided>
      </Block>

      {/* Block B. The note is where the degraded run says so, in the module's
          own words rather than in an icon. */}
      <Block heading={checks.heading}>
        <p className="tp-body tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{checks.note}</p>

        {checks.rows.length > 0 && (
          <Divided>
            {checks.rows.map(row => (
              <CheckRow key={row.id} row={row} falsifierLabel={checks.falsifier_label} />
            ))}
          </Divided>
        )}

        {checks.model_notes.length > 0 && (
          <div className="mt-6">
            <p className="tp-label" style={{ color: 'var(--text-primary)' }}>{checks.model_notes_label}</p>
            <Divided>
              {checks.model_notes.map(row => (
                <CheckRow key={row.id} row={row} falsifierLabel={checks.falsifier_label} />
              ))}
            </Divided>
          </div>
        )}

        {checks.not_scored.length > 0 && (
          <div className="app-inset mt-6 p-4" style={{ background: 'var(--background-secondary)' }}>
            <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>{checks.not_scored_label}</p>
            <ul className="mt-2 space-y-1.5">
              {checks.not_scored.map(item => (
                <li key={item.id} data-testid={`not-scored-${item.id}`} className="tp-meta" style={{ color: 'var(--text-secondary)' }}>
                  {item.criterion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Block>

      {/* Block C. Nobody has written the reference spec, so the block stays and
          says so. It is never filled in with ours. */}
      <Block heading={comparison.heading}>
        {comparison.intro && (
          <p className="tp-body tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{comparison.intro}</p>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {comparison.student_spec && (
            <SpecColumn label={comparison.student_spec.label} text={comparison.student_spec.text} />
          )}

          {comparison.reference && (
            <SpecColumn label={comparison.reference.label} byline={byline} text={comparison.reference.text} />
          )}

          {comparison.missing && (
            <div
              data-testid="comparison-missing"
              className="app-inset flex items-center p-4"
              style={{ background: 'var(--background-secondary)' }}
            >
              <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>{comparison.missing.body}</p>
            </div>
          )}
        </div>
      </Block>

      {/* Block D. Fixed text, always drawn, never conditional. */}
      <Block heading={limits.heading}>
        <p className="tp-body tp-prose mt-2" style={{ color: 'var(--text-secondary)' }}>{limits.body}</p>
      </Block>

      <Link to="/journey" className="tp-control ui-press app-cta-secondary" style={{ minHeight: '48px' }}>
        Back to My Journey
      </Link>
    </div>
  );
}
