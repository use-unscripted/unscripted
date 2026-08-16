import ValidationQueueRow from '@/components/admin/ValidationQueueRow';

/**
 * The shortlist first, then the full ranking.
 *
 * The shortlist is not simply the top eight scores: within one Path it prefers a
 * different KIND of work each time, so a Path contributes a core task, a
 * decision and a human interaction before it contributes a second work sample.
 */
export default function ValidationPriorityQueue({ data, onStrategic }) {
  const { shortlist = [], queue = [], factors = [], internal_usage = [], unattributed_experiments = 0 } = data || {};
  const realAccounts = data?.class_counts?.real_beta_user || 0;
  const unclassified = data?.class_counts?.unclassified || 0;

  return (
    <div className="space-y-6">
      {/* Usage frequency is two of the seven factors. With nobody classified as a
          real student they both read zero for everything, and the ranking is
          running on Path importance, dimension gaps and validation weakness
          alone. Better said out loud than silently assumed. */}
      {realAccounts === 0 && (
        <div className="rounded-[var(--r-control)] px-4 py-3 text-xs"
          style={{ background: 'var(--warning-50)', border: '1px solid var(--warning-700)', color: 'var(--warning-700)' }}>
          No account is classified as a real student yet{unclassified ? `, and ${unclassified} are unclassified` : ''}, so
          recommendation and selection frequency count zero for every experiment. Classify accounts on the funnel page and
          this ranking sharpens. Nothing here guesses which accounts were real.
        </div>
      )}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">
          Validate these next ({shortlist.length})
        </h3>
        <p className="mt-1 text-xs text-[color:var(--ink-500)]">
          Ranked on real student usage, Path importance, the dimensions it would cover, and how weak its validation is
          today. Within a Path, different kinds of work are preferred over near-identical work samples.
        </p>
        <div className="mt-2.5 space-y-2">
          {shortlist.length === 0
            ? <p className="text-sm text-[color:var(--ink-500)]">Nothing is eligible: every usable experiment is already multi-professional validated, or none has any stored usage.</p>
            : shortlist.map((row, i) => (
              <ValidationQueueRow key={row.validation_id} row={row} rank={i + 1} factors={factors} onStrategic={onStrategic} />
            ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">
          Full ranking ({queue.length})
        </h3>
        <div className="mt-2.5 space-y-2">
          {queue.map(row => (
            <ValidationQueueRow key={row.validation_id} row={row} factors={factors} onStrategic={onStrategic} />
          ))}
        </div>
      </section>

      {(internal_usage.length > 0 || unattributed_experiments > 0) && (
        <section className="rounded-[var(--r-control)] bg-[color:var(--ink-50)] px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Held out of the numbers</h3>
          {unattributed_experiments > 0 && (
            <p className="mt-1 text-[11px] text-[color:var(--ink-500)]">
              {unattributed_experiments} student experiment{unattributed_experiments === 1 ? '' : 's'} could not be linked
              to a validation record by id, blueprint key or title, so they are counted nowhere rather than guessed.
            </p>
          )}
          {internal_usage.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {internal_usage.slice(0, 8).map(r => (
                <li key={r.validation_id} className="font-mono text-[11px] text-[color:var(--ink-500)]">
                  internal only · {r.title} · {r.recommended_students} recommended · {r.selected_students} selected
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}