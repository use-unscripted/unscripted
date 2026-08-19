/**
 * Which tests resolve which Conviction Gaps.
 *
 * Read-only, and deliberately unwilling to make a claim: below the sample every
 * rate is replaced by "Not enough data yet." and only the raw counts show. Every
 * row names the exact experiment version it belongs to.
 */
import { ShieldCheck } from 'lucide-react';
import { NOT_ENOUGH_DATA } from '@/lib/effectiveness-thresholds';

const Stat = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-[color:var(--ink-400)]">{label}</p>
    <p className="text-sm font-semibold text-[color:var(--ink-900)]">{value}</p>
  </div>
);

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const signed = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v}`);

export default function GapEffectivenessPanel({ data }) {
  if (!data) return null;
  const { chain = {}, groups = [], message, min_students, disclaimer } = data;

  return (
    <section className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-5">
      <h2 className="text-base font-bold text-[color:var(--ink-900)]">Conviction gaps and the tests aimed at them</h2>
      <p className="mt-1 text-xs text-[color:var(--ink-500)]">{disclaimer}</p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Gaps targeted" value={chain.gaps_targeted ?? 0} />
        <Stat label="Tests completed" value={chain.tests_completed ?? 0} />
        <Stat label="Expectations recorded" value={chain.expectations_recorded ?? 0} />
        <Stat label="Evidence created" value={chain.evidence_created ?? 0} />
        <Stat label="Conviction measured" value={chain.conviction_measured ?? 0} />
        <Stat label="Decisions after" value={chain.decisions_recorded ?? 0} />
      </div>

      {message && (
        <p className="mt-4 flex items-start gap-2 rounded-[var(--r-control)] px-4 py-3 text-xs text-[color:var(--ink-700)]"
          style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          {message} No test has been completed by {min_students} students at the same version yet, so no effectiveness reading is shown.
        </p>
      )}

      {groups.length > 0 && (
        <ul className="mt-4 space-y-3">
          {groups.map(g => (
            <li key={g.key} className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] p-4">
              <p className="text-sm font-semibold text-[color:var(--ink-900)]">{g.gap_area || 'Unassigned gap'}</p>
              <p className="text-xs text-[color:var(--ink-500)]">
                {g.blueprint_key || 'Unversioned test'} · version {g.experiment_version ?? 'unknown'}
                {g.role_blueprint_version ? ` · blueprint v${g.role_blueprint_version}` : ''}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Students" value={g.students} />
                <Stat label="Tests completed" value={g.tests_completed} />
                <Stat label="Evidence created" value={pct(g.evidence_rate)} />
                <Stat label="Conviction moved" value={pct(g.conviction_moved_rate)} />
                <Stat label="Mean confidence change" value={signed(g.mean_confidence_change)} />
                <Stat label="Mean interest change" value={signed(g.mean_interest_change)} />
                <Stat label="Decision followed" value={pct(g.decision_rate)} />
                <Stat label="Expectations recorded" value={g.expectations_recorded} />
              </div>
              {g.suppressed && (
                <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--warning-700)' }}>
                  {g.message || NOT_ENOUGH_DATA} Needs {g.required_students} students at this version; has {g.students}.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}