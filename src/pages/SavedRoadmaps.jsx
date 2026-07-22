import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Map, ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function SavedRoadmaps() {
  const [items, setItems] = useState([]);
  useEffect(() => { base44.entities.Roadmap.list('-created_date', 50).then(setItems); }, []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Roadmap history"
        title="Your paths, saved."
        description="Revisit earlier strategies and see how your direction evolves as you create evidence."
      />
      <div className="space-y-4">
        {items.map((r, i) => (
          <Link
            to="/roadmap"
            key={r.id}
            className="flex items-center gap-5 rounded-[20px] border border-[#E2E8F0] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md hover:border-[rgba(31,58,95,0.25)]"
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-xl shrink-0"
              style={{ background: '#F8ECEF' }}
            >
              <Map style={{ color: 'var(--brand-navy-900)' }} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading truncate font-bold text-[#07111F]">{r.title}</h2>
              <p className="mt-1 text-xs text-[#64748B]">
                Created {new Date(r.created_date).toLocaleDateString()} · {r.thirty_day_plan?.length || 0} milestones
              </p>
            </div>
            <span className="hidden text-xs font-bold text-[#94A3B8] sm:block">VERSION {items.length - i}</span>
            <ArrowRight className="text-[#CBD5E1] shrink-0" size={18} />
          </Link>
        ))}
        {!items.length && (
          <div className="rounded-[20px] border border-dashed border-[#E2E8F0] p-12 text-center text-[#94A3B8]">
            Your first roadmap will appear here.
          </div>
        )}
      </div>
    </main>
  );
}