/**
 * What the student sees when they open an experiment: enough to know what they
 * are walking into, and one button. The instructions themselves live in the
 * steps, not here.
 */
import { Clock, ListChecks, Target, FileText } from 'lucide-react';

function Fact({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-navy-700)' }} />
      <p className="tp-body" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{label}: </span>{value}
      </p>
    </div>
  );
}

export default function GuidedOverview({ guide, experiment, path, progress, onBegin }) {
  const { total, completed, pct, started, resumeStep } = progress;
  const label = !started ? 'Begin experiment' : completed.length ? 'Continue where you left off' : 'Continue experiment';

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
        Experiment{path?.path_name || experiment?.path_name ? ` · ${path?.path_name || experiment.path_name}` : ''}
      </p>
      <h1 className="tp-page mt-3" style={{ color: 'var(--text-primary)' }}>{guide.guide_title}</h1>

      <div className="mt-4 space-y-2.5">
        <Fact icon={Target} label="What you are testing" value={guide.objective || experiment?.objective} />
        <Fact icon={ListChecks} label="Why it matters" value={experiment?.expected_learning} />
        <Fact icon={Clock} label="Time" value={guide.estimated_time ? `about ${guide.estimated_time} in total` : null} />
        <Fact icon={ListChecks} label="Steps" value={total ? `${total} short steps, one at a time` : null} />
        <Fact icon={FileText} label="What you end up with" value={guide.deliverable || guide.proof_requirement} />
      </div>

      <div className="mt-5">
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--background-tertiary)' }}>
          <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-gold-500)' }} />
        </div>
        <p className="tp-meta mt-2" style={{ color: 'var(--text-muted)' }}>
          {completed.length
            ? `${completed.length} of ${total} steps complete. You left off on step ${resumeStep}.`
            : 'Not started yet.'}
        </p>
      </div>

      <button
        type="button"
        onClick={onBegin}
        className="ui-press tp-body mt-5 inline-flex w-full items-center justify-center rounded-[var(--r-control)] px-6 font-bold text-white sm:w-auto"
        style={{ background: 'var(--brand-navy-900)', minHeight: '52px' }}
      >
        {label}
      </button>
    </section>
  );
}