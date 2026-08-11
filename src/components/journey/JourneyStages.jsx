import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { STAGES, STAGE_INDEX } from '@/lib/journey';

/**
 * The cycle spine — the record of one journey, not a progress bar.
 *
 * Each of the six stages carries what the student actually produced there, so
 * the same element answers "where am I" and "what have I built". A stage that
 * is still empty says so, which is the honest and useful reading: it shows
 * exactly where the cycle stopped. The gold rail runs only as far as the work
 * does, so there is no percentage to inflate.
 */

const NOT_YET = 'Nothing yet';

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * What each stage has to show for itself. Derived only from records the student
 * already has — nothing new is stored.
 */
export function buildStageDetail({ counts, currentPath, nextExperiment, experimentsDone }) {
  return {
    explore: {
      value: counts.paths ? plural(counts.paths, 'path compared', 'paths compared') : NOT_YET,
      to: counts.paths ? '/paths' : null,
    },
    choose: {
      value: currentPath?.path_name || 'No direction chosen yet',
      to: '/paths',
    },
    test: {
      value: nextExperiment?.title
        || (experimentsDone ? plural(experimentsDone, 'experiment finished', 'experiments finished') : 'Not started'),
      to: counts.experiments ? '/experiments' : null,
    },
    prove: {
      value: counts.proof ? plural(counts.proof, 'piece of evidence', 'pieces of evidence') : NOT_YET,
      to: counts.proof ? '/evidence' : null,
    },
    reflect: {
      value: counts.reflections ? plural(counts.reflections, 'reflection', 'reflections') : NOT_YET,
      to: counts.reflections ? '/reflect' : null,
    },
    decide: {
      value: counts.reflections && experimentsDone ? 'Ready to decide' : NOT_YET,
      to: counts.reflections && experimentsDone ? '/reflect' : null,
    },
  };
}

function Node({ state }) {
  if (state === 'done') {
    return (
      <span
        className="grid h-[22px] w-[22px] place-items-center rounded-full"
        style={{ background: 'var(--brand-gold-500)', color: 'var(--brand-navy-900)' }}
      >
        <Check size={12} strokeWidth={3.5} aria-hidden="true" />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span
        className="grid h-[22px] w-[22px] place-items-center rounded-full"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 0 0 4px rgba(214,182,106,0.45)' }}
      >
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: 'var(--brand-gold-500)' }} />
      </span>
    );
  }
  return (
    <span
      className="block h-[22px] w-[22px] rounded-full"
      style={{ background: 'var(--background-primary)', boxShadow: 'inset 0 0 0 2px var(--border-light)' }}
    />
  );
}

export default function JourneyStages({ stage, detail }) {
  const activeIdx = STAGE_INDEX[stage] ?? 0;

  return (
    <section aria-label="Your journey so far">
      {/* A section heading, in the marketing page's own words and at its own
          size. This was an 11px caps label, which is how a section title ends
          up quieter than the rows underneath it. */}
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>
        Your cycle
      </h2>

      {/* Same measure as the instruction panel above, so the two elements read
          as one column rather than a panel with a wide list under it. */}
      <ol className="mt-5 max-w-2xl">
        {STAGES.map((s, i) => {
          const state = i < activeIdx ? 'done' : i === activeIdx ? 'current' : 'todo';
          const d = detail?.[s.key];
          // A stage that hasn't happened yet shows the question it will answer;
          // one that has shows what it produced.
          const line = state === 'todo' ? s.question : d?.value || s.question;
          const to = state === 'todo' ? null : d?.to;

          const body = (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-5">
              <p
                className="tp-card shrink-0 sm:w-[120px]"
                style={{ color: state === 'todo' ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                {s.label}
              </p>
              <p
                className="tp-body min-w-0 flex-1"
                style={{
                  color: state === 'current' ? 'var(--brand-navy-700)' : 'var(--text-secondary)',
                  fontWeight: state === 'current' ? 600 : 400,
                  overflowWrap: 'anywhere',
                }}
              >
                {line}
              </p>
              {to && (
                <ChevronRight
                  size={16}
                  className="hidden shrink-0 self-center sm:block"
                  style={{ color: 'var(--text-muted)' }}
                  aria-hidden="true"
                />
              )}
            </div>
          );

          return (
            <li key={s.key} className="relative flex gap-4">
              {/* Rail: gold as far as the work goes, hairline after. */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[10px] top-[28px] w-[2px]"
                  style={{ background: i < activeIdx ? 'var(--brand-gold-500)' : 'var(--border-light)' }}
                />
              )}

              <span
                className="relative z-[1] shrink-0 pt-[9px]"
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <Node state={state} />
              </span>

              {to ? (
                <Link to={to} className="journey-stage-row -mx-3 flex min-w-0 flex-1 rounded-[var(--r-control)] px-3 py-3.5">
                  {body}
                </Link>
              ) : (
                <div className="-mx-3 flex min-w-0 flex-1 px-3 py-3.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
