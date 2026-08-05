import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CalendarDays, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import RoadmapSection from '@/components/RoadmapSection';
import { PageSkeleton, SkCards } from '@/components/PageSkeleton';

export default function Roadmap() {
  const [r, setR] = useState();
  // `loaded` is separate from `r` on purpose: a student with no roadmap yet
  // gets undefined back, and testing `r` alone left them on the loading state
  // forever with no way to tell that apart from a slow fetch.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    base44.entities.Roadmap.list('-created_date', 1)
      .then(x => setR(x[0]))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <PageSkeleton eyebrow action actionWidth={172}>
        <SkCards count={3} h={196} gap={20} r={24} />
      </PageSkeleton>
    );
  }

  if (!r) {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Personal roadmap"
          title="No roadmap yet."
          description="Your roadmap is built from your paths and experiments. Start an experiment and it will appear here."
        />
        <Link to="/journey" className="tp-body font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
          Go to My Journey →
        </Link>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Personal roadmap"
        title={r.title}
        description="Specific actions, sequenced around what matters now, not a list of everything you could do."
        action={
          <Link to="/calendar"
            className="tp-body flex items-center gap-2 rounded-[10px] px-6 py-3.5 font-semibold text-white transition hover:-translate-y-px"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            <CalendarDays size={16} /> Open this week
          </Link>
        }
      />

      {/* Feasibility assessment */}
      {r.feasibility_assessment && (
        <div className="mb-6 flex items-start gap-3 rounded-[20px] p-6" style={{ background: 'var(--surface-dark-700)', border: '1px solid rgba(31,58,95,0.30)' }}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-navy-900)' }} />
          <div>
            <p className="tp-eyebrow mb-2" style={{ color: 'var(--brand-navy-900)' }}>Feasibility assessment</p>
            <p className="tp-prose text-[color:var(--ink-300)]">{r.feasibility_assessment}</p>
          </div>
        </div>
      )}

      {r.goals_to_defer?.length > 0 && (
        <div className="mb-6 rounded-[16px] p-4" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.25)' }}>
          <p className="tp-eyebrow text-[color:var(--warning-700)] mb-2">Goals to defer for now</p>
          <ul className="space-y-1">{r.goals_to_defer.map((g, i) => <li key={i} className="tp-body text-[color:var(--ink-700)]">· {g}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <RoadmapSection title="Your next 30 days" items={r.thirty_day_plan} />
        <RoadmapSection title="Semester direction" items={r.semester_plan} />
        <RoadmapSection title="Skills to build" items={r.skill_plan} />
        <RoadmapSection title="Networking plan" items={r.networking_plan} />
        <RoadmapSection title="Wellness and recovery" items={r.wellness_plan} />
        {r.personal_brand_plan && (
          <RoadmapSection
            title="Personal brand moves"
            items={Object.values(r.personal_brand_plan || {}).flat().filter(x => typeof x === 'string').slice(0, 6)}
          />
        )}
      </div>
    </main>
  );
}