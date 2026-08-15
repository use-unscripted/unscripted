/**
 * The experiment at a glance, plus its own progress. This is the header of the
 * container everything else hangs off.
 */
import { Clock } from 'lucide-react';
import LanguageLevelControl from '@/components/language/LanguageLevelControl';
import useLanguageLevel from '@/hooks/useLanguageLevel';

export default function ExperimentOverview({ experiment, path }) {
  // Wording preference for this path. Nothing about the experiment changes with it.
  const language = useLanguageLevel({ path, experiment });

  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
        Active experiment{path?.path_name ? ` · ${path.path_name}` : ''}
      </p>
      <h1 className="tp-page mt-3" style={{ color: 'var(--text-primary)' }}>
        {experiment.title}
      </h1>
      {experiment.objective && (
        <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)' }}>{experiment.objective}</p>
      )}

      <div className="tp-meta mt-5 flex flex-wrap items-center gap-5" style={{ color: 'var(--text-muted)' }}>
        {experiment.estimated_hours && <span className="flex items-center gap-1"><Clock size={12} /> ~{experiment.estimated_hours}h</span>}
        {experiment.deadline && <span>Due {new Date(experiment.deadline).toLocaleDateString()}</span>}
      </div>

      <LanguageLevelControl level={language.level} onChange={language.setLevel} hint={false} className="mt-4" />

      {experiment.expected_learning && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-light)' }}>
          <p className="tp-eyebrow" style={{ color: 'var(--text-muted)' }}>What this should teach you</p>
          <p className="tp-body mt-1.5" style={{ color: 'var(--text-secondary)' }}>{experiment.expected_learning}</p>
        </div>
      )}
    </section>
  );
}