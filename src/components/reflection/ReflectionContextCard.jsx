/**
 * Everything the reflection loaded on its own, so the student never re-enters
 * anything: the hypothesis being tested, the rationale it was built on, the
 * unknowns it started with, this experiment's test question, what they said they
 * expected beforehand, and the activity behind it.
 */
import { FlaskConical, Users, FileText, Compass } from 'lucide-react';

function Stat({ Icon, label, value }) {
  return (
    <div className="rounded-[var(--r-control)] p-3" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <Icon size={11} /> {label}
      </p>
      <p className="tp-section mt-1.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function Block({ label, children }) {
  if (!children) return null;
  return (
    <div className="mt-3">
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>{label}</p>
      <p className="tp-body mt-1" style={{ color: 'var(--ink-700)' }}>{children}</p>
    </div>
  );
}

export default function ReflectionContextCard({ ctx, measurement }) {
  const { experiment, path, completedExperiments, proof, outreach, baselineClarity, endedEarly } = ctx;
  const unknowns = (path?.unresolved_questions || []).map(q => q?.question).filter(Boolean).slice(0, 3);
  const expectations = [
    typeof measurement?.expected_enjoyment === 'number' && `expected enjoyment ${measurement.expected_enjoyment}/10`,
    typeof measurement?.expected_difficulty === 'number' && `expected difficulty ${measurement.expected_difficulty}/10`,
    measurement?.biggest_concern && `your main concern was “${measurement.biggest_concern}”`,
  ].filter(Boolean);

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
        Updating your hypothesis{path?.path_name ? ` · ${path.path_name}` : ''}
      </p>
      <h1 className="tp-page mt-3" style={{ color: 'var(--text-primary)' }}>{experiment.title}</h1>
      {endedEarly && experiment.pause_reason && (
        <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)' }}>
          Ended early. Your reason: “{experiment.pause_reason}”
        </p>
      )}

      <Block label="The hypothesis you are testing">{path?.why_this_may_fit || path?.why_it_fits || path?.fit_reason || null}</Block>
      {/* Only when it says something the line above did not. */}
      <Block label="Why you started here">
        {path?.goals_supported && path.goals_supported !== (path.why_this_may_fit || path.why_it_fits || path.fit_reason)
          ? path.goals_supported
          : null}
      </Block>
      <Block label="What this experiment set out to answer">{experiment.test_question || experiment.unresolved_question || experiment.objective || null}</Block>
      {unknowns.length > 0 && (
        <div className="mt-3">
          <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>Unknowns you started with</p>
          <ul className="mt-1 space-y-1">
            {unknowns.map((u, i) => (
              <li key={i} className="tp-body" style={{ color: 'var(--ink-700)' }}>· {u}</li>
            ))}
          </ul>
        </div>
      )}
      <Block label="What you said beforehand">{expectations.length ? `You ${expectations.join(', ')}.` : null}</Block>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat Icon={FlaskConical} label="Experiments completed" value={completedExperiments.length} />
        <Stat Icon={FileText} label="Evidence" value={proof.length} />
        <Stat Icon={Users} label="Conversations" value={outreach.length} />
        <Stat Icon={Compass} label="Baseline clarity" value={baselineClarity ?? 'Not set'} />
      </div>
    </section>
  );
}