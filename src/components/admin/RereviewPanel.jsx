import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import RevisionDiff from '@/components/admin/RevisionDiff';

const box = 'w-full rounded-lg border border-[color:var(--ink-200)] px-2.5 py-1.5 text-xs';

/**
 * The re-review workspace for one experiment: what changed, what the previous
 * reviewers said, who is assigned, and the decision. Historical reviews are
 * listed in full, superseded ones included — nothing here removes them.
 */
export default function RereviewPanel({ row, onAssign, onSubmitReview }) {
  const { validation: v, versions = [], reviews = [] } = row;
  const current = versions.find(x => x.is_current) || versions[0] || null;
  const previous = versions.find(x => x !== current) || null;
  const version = Number(v.experiment_version || 1);
  const thisVersion = reviews.filter(r => Number(r.experiment_version) === version);
  const history = reviews.filter(r => Number(r.experiment_version) !== version);

  const [reviewer, setReviewer] = useState({ reviewer_id: '', reviewer_display: v.pending_reviewer_display || '' });
  const [form, setForm] = useState({
    reviewer_display: v.pending_reviewer_display || '',
    reviewer_role: '',
    realism_rating: '',
    workstyle_validity_rating: '',
    recommendations: '',
  });
  const [busy, setBusy] = useState('');

  const run = async (key, fn) => { setBusy(key); try { await fn(); } finally { setBusy(''); } };
  const decide = (approval_status) => run(approval_status, () => onSubmitReview(row, {
    ...form,
    realism_rating: form.realism_rating === '' ? null : Number(form.realism_rating),
    workstyle_validity_rating: form.workstyle_validity_rating === '' ? null : Number(form.workstyle_validity_rating),
    approval_status,
  }));

  return (
    <div className="mt-3 space-y-4 border-t border-[color:var(--ink-200)] pt-3">
      <section>
        <h4 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Change summary</h4>
        <p className="mt-1 text-xs text-[color:var(--ink-700)]">
          {v.rereview_reason || current?.change_summary || 'No recorded change summary.'}
        </p>
        <p className="mt-1 font-mono text-[11px] text-[color:var(--ink-400)]">
          v{previous?.experiment_version ?? v.previous_experiment_version ?? '?'} &rarr; v{version}
          {typeof current?.validation_level_before === 'number'
            ? ` · validation level ${current.validation_level_before} → ${current.validation_level_after}`
            : ''}
          {current?.reviews_superseded ? ` · ${current.reviews_superseded} review(s) superseded` : ''}
        </p>
      </section>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">What changed</h4>
        <div className="mt-1.5"><RevisionDiff version={current} /></div>
      </section>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">
          Previous reviews (kept on file)
        </h4>
        {history.length === 0 ? (
          <p className="mt-1 text-xs text-[color:var(--ink-500)]">No reviews of earlier versions.</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {history.map(r => (
              <li key={r.id} className="rounded-lg bg-[color:var(--ink-50)] p-2.5 text-xs text-[color:var(--ink-700)]">
                <span className="font-semibold">
                  v{r.experiment_version ?? '?'} · {r.approval_status}
                </span>{' '}
                · {r.reviewer_display || r.reviewer_role || 'Verified professional'}
                {r.review_date ? ` · ${new Date(r.review_date).toLocaleDateString()}` : ''}
                {r.recommendations ? <p className="mt-1 text-[color:var(--ink-500)]">{r.recommendations}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">Assigned reviewer</h4>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input className={`${box} max-w-[220px]`} placeholder="Reviewer name or role"
            value={reviewer.reviewer_display}
            onChange={e => setReviewer(s => ({ ...s, reviewer_display: e.target.value }))} />
          <input className={`${box} max-w-[180px]`} placeholder="Reviewer id (optional)"
            value={reviewer.reviewer_id}
            onChange={e => setReviewer(s => ({ ...s, reviewer_id: e.target.value }))} />
          <button type="button" disabled={Boolean(busy) || !reviewer.reviewer_display.trim()}
            onClick={() => run('assign', () => onAssign(row, reviewer))}
            className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] disabled:opacity-60">
            {busy === 'assign' && <Loader2 size={11} className="animate-spin" />} Assign
          </button>
          {v.pending_reviewer_display && (
            <span className="text-xs text-[color:var(--ink-500)]">Currently: {v.pending_reviewer_display}</span>
          )}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-400)]">
          Updated review for v{version}
        </h4>
        {thisVersion.length > 0 && (
          <p className="mt-1 text-xs text-[color:var(--ink-500)]">
            {thisVersion.length} review(s) already recorded against this version.
          </p>
        )}
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          <input className={box} placeholder="Reviewer display" value={form.reviewer_display}
            onChange={e => setForm(s => ({ ...s, reviewer_display: e.target.value }))} />
          <input className={box} placeholder="Reviewer role" value={form.reviewer_role}
            onChange={e => setForm(s => ({ ...s, reviewer_role: e.target.value }))} />
          <input className={box} type="number" min="1" max="5" placeholder="Realism 1-5" value={form.realism_rating}
            onChange={e => setForm(s => ({ ...s, realism_rating: e.target.value }))} />
          <input className={box} type="number" min="1" max="5" placeholder="Workstyle validity 1-5"
            value={form.workstyle_validity_rating}
            onChange={e => setForm(s => ({ ...s, workstyle_validity_rating: e.target.value }))} />
        </div>
        <textarea className={`${box} mt-2`} rows={2} placeholder="Comments" value={form.recommendations}
          onChange={e => setForm(s => ({ ...s, recommendations: e.target.value }))} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[['approved', 'Approve new version'], ['changes_requested', 'Request changes'], ['rejected', 'Reject']].map(([id, label]) => (
            <button key={id} type="button" disabled={Boolean(busy)} onClick={() => decide(id)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              style={id === 'approved'
                ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' }
                : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
              {busy === id && <Loader2 size={11} className="animate-spin" />} {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}