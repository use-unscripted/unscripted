import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CalendarDays, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import RoadmapSection from '@/components/RoadmapSection';

export default function Roadmap() {
  const [r, setR] = useState();
  useEffect(() => { base44.entities.Roadmap.list('-created_date', 1).then(x => setR(x[0])); }, []);

  if (!r) return <div className="p-10 text-[color:var(--ink-500)]">Loading roadmap...</div>;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Personal roadmap"
        title={r.title}
        description="Specific actions, sequenced around what matters now — not a list of everything you could do."
        action={
          <Link to="/calendar"
            className="flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
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
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--brand-navy-900)' }}>Feasibility assessment</p>
            <p className="text-sm text-[color:var(--ink-300)] leading-6">{r.feasibility_assessment}</p>
          </div>
        </div>
      )}

      {r.goals_to_defer?.length > 0 && (
        <div className="mb-6 rounded-[16px] p-4" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.25)' }}>
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--warning-700)] mb-2">Goals to defer for now</p>
          <ul className="space-y-1">{r.goals_to_defer.map((g, i) => <li key={i} className="text-sm text-[color:var(--ink-700)]">· {g}</li>)}</ul>
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