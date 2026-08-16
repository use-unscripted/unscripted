/**
 * "Your evidence so far" for ONE path, across every test run on it.
 *
 * Deliberately never says a career is resolved: coverage is described as the
 * share of what matters here that has evidence behind it, and the strongest
 * state a path reaches is still a hypothesis.
 */
import { Check, CircleDot, HelpCircle, AlertTriangle } from 'lucide-react';
import { confidenceBand } from '@/lib/journey-focus';

const MARK = {
  tested: { Icon: Check, color: 'var(--success-700)', hint: 'Evidence behind it' },
  partial: { Icon: CircleDot, color: 'var(--warning-700)', hint: 'One reading so far' },
  untested: { Icon: HelpCircle, color: 'var(--text-muted)', hint: 'Not tested yet' },
};

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-[var(--r-control)] p-3.5" style={{ background: 'var(--background-secondary)' }}>
      <p className="tp-meta font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="tp-card mt-1.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="tp-meta mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function EvidenceList({ title, items, icon: Icon, color }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <p className="tp-body flex items-center gap-1.5 font-bold" style={{ color: 'var(--text-primary)' }}>
        <Icon size={14} style={{ color }} /> {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((x, i) => (
          <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>
            {x.text}
            {x.source && <span className="tp-meta" style={{ color: 'var(--text-muted)' }}> · {x.source}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PathEvidenceSoFar({ history }) {
  if (!history) return null;
  const { path, testsCompleted, coverage, confidence, unknownRows, nextUnknown } = history;

  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="tp-section" style={{ color: 'var(--text-primary)' }}>Your evidence so far</h2>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>
        Everything you have tested on {path.path_name}, kept in one place as it builds.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Tests completed" value={testsCompleted} sub={testsCompleted === 0 ? 'Nothing concluded yet' : 'Each one concluded with a decision'} />
        <Stat
          label="Evidence coverage"
          value={coverage === null ? 'Not enough evidence' : `${coverage}%`}
          sub={coverage === null ? undefined : 'Of what matters most on this path'}
        />
        <Stat
          label="Current confidence"
          value={confidence === null ? 'Low' : confidenceBand(confidence)}
          sub="How well we understand the fit, not how good the career is"
        />
      </div>

      {unknownRows.length > 0 && (
        <div className="mt-5">
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>What you have tested</p>
          <ul className="mt-2 space-y-1.5">
            {unknownRows.map(row => {
              const mark = MARK[row.status] || MARK.untested;
              const Icon = row.contradicted ? AlertTriangle : mark.Icon;
              const color = row.contradicted ? 'var(--warning-700)' : mark.color;
              return (
                <li key={row.id} className="tp-body flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Icon size={14} className="mt-0.5 shrink-0" style={{ color }} aria-hidden="true" />
                  <span>
                    <span style={{ color: 'var(--text-primary)' }}>{row.label}</span>
                    <span className="tp-meta" style={{ color: 'var(--text-muted)' }}>
                      {' '}· {row.contradicted ? 'Your readings have gone both ways' : mark.hint}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="tp-meta mt-2.5" style={{ color: 'var(--text-muted)' }}>
            This is not a checklist that finishes. Testing everything here would not settle the career, and understanding
            can keep changing after it.
          </p>
        </div>
      )}

      <EvidenceList title="Strongest evidence" items={history.strongest} icon={Check} color="var(--success-700)" />
      <EvidenceList title="Contradictory evidence" items={history.contradictory} icon={AlertTriangle} color="var(--warning-700)" />

      {nextUnknown && (
        <div className="mt-5 rounded-[var(--r-control)] p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
          <p className="tp-body font-bold" style={{ color: 'var(--text-primary)' }}>
            Most important thing to test next: {nextUnknown.label}
          </p>
          {nextUnknown.question && (
            <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{nextUnknown.question}</p>
          )}
        </div>
      )}
    </section>
  );
}