/**
 * The context the reflection loaded on its own: path, experiment, missions,
 * outreach, proof, baseline clarity. Shown so the student can see nothing had to
 * be re-selected by hand.
 */
import { Target, Users, FileText, Compass } from 'lucide-react';

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

export default function ReflectionContextCard({ ctx }) {
  const { experiment, path, completedMissions, missions, proof, outreach, baselineClarity, endedEarly } = ctx;
  return (
    <section className="rounded-[var(--r-surface)] bg-white p-5 sm:p-6" style={{ border: '1px solid var(--border-light)' }}>
      <p className="tp-eyebrow" style={{ color: 'var(--brand-navy-700)' }}>
        Concluding your experiment{path?.path_name ? ` · ${path.path_name}` : ''}
      </p>
      <h1 className="tp-page mt-3" style={{ color: 'var(--text-primary)' }}>
        {experiment.title}
      </h1>
      {endedEarly && experiment.pause_reason && (
        <p className="tp-lead mt-3" style={{ color: 'var(--text-secondary)' }}>
          Ended early. Your reason: “{experiment.pause_reason}”
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat Icon={Target} label="Missions" value={`${completedMissions.length}/${missions.length}`} />
        <Stat Icon={FileText} label="Evidence" value={proof.length} />
        <Stat Icon={Users} label="Conversations" value={outreach.length} />
        <Stat Icon={Compass} label="Baseline clarity" value={baselineClarity ?? 'Not set'} />
      </div>
    </section>
  );
}