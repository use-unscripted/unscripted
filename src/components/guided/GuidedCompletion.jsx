/**
 * The end of the experiment: what they did, then straight into the existing
 * reflection and decision flow.
 */
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GuidedCompletion({ guide, experiment, stepsDone, total, conversations, evidenceCount, minutes }) {
  const facts = [
    `${stepsDone} of ${total} steps completed`,
    conversations ? `${conversations} professional conversation${conversations === 1 ? '' : 's'}` : null,
    `${evidenceCount} piece${evidenceCount === 1 ? '' : 's'} of evidence created`,
    minutes ? `about ${minutes} minutes of recorded work` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--brand-gold-500)', boxShadow: '0 10px 30px rgba(31,58,95,0.08)' }}>
      <p className="tp-eyebrow flex items-center gap-1.5" style={{ color: 'var(--success-700)' }}>
        <CheckCircle2 size={14} /> Experiment complete
      </p>
      <h1 className="tp-page mt-3" style={{ color: 'var(--text-primary)' }}>You completed this experiment.</h1>
      <p className="tp-lead mt-2" style={{ color: 'var(--text-secondary)' }}>{guide.guide_title}</p>

      <ul className="mt-4 space-y-1.5">
        {facts.map((f, i) => (
          <li key={i} className="tp-body" style={{ color: 'var(--text-secondary)' }}>· {f}</li>
        ))}
      </ul>

      <p className="tp-body mt-4" style={{ color: 'var(--text-secondary)' }}>
        What comes next: what this told you about the path, and whether to continue, adjust, or test
        something else.
      </p>

      <Link
        to={experiment?.id ? `/reflect?experimentId=${experiment.id}` : '/evidence?tab=reflect'}
        className="ui-press tp-body mt-5 inline-flex w-full items-center justify-center rounded-[var(--r-control)] px-6 font-bold text-white sm:w-auto"
        style={{ background: 'var(--brand-navy-900)', minHeight: '52px' }}
      >
        Reflect on what you learned
      </Link>
    </section>
  );
}