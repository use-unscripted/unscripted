import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Map, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function SavedRoadmaps() {
  const [items, setItems] = useState([]);
  useEffect(() => { base44.entities.Roadmap.list('-created_date', 50).then(setItems); }, []);

  return (
    <main className="app-page">
      <PageHeader
        title="Your paths, saved."
        description="Revisit earlier strategies and see how your direction evolves as you create evidence."
      />
      <div className="space-y-4">
        {items.map((r, i) => (
          <Link
            to="/roadmap"
            key={r.id}
            className="flex items-center gap-5 rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md hover:border-[rgba(31,58,95,0.25)]"
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-[var(--r-control)] shrink-0"
              style={{ background: '#F8ECEF' }}
            >
              <Map style={{ color: 'var(--brand-navy-900)' }} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="tp-card truncate text-[color:var(--surface-dark-800)]">{r.title}</h2>
              <p className="tp-meta mt-1.5 text-[color:var(--ink-500)]">
                Created {new Date(r.created_date).toLocaleDateString()} · {r.thirty_day_plan?.length || 0} milestones
              </p>
            </div>
            <span className="tp-eyebrow hidden text-[color:var(--ink-400)] sm:block">VERSION {items.length - i}</span>
            <ArrowRight className="text-[color:var(--ink-300)] shrink-0" size={18} />
          </Link>
        ))}
        {!items.length && (
          <div className="tp-body rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] px-8 py-14 text-center text-[color:var(--ink-400)]">
            Your first roadmap will appear here.
          </div>
        )}
      </div>
    </main>
  );
}