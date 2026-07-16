import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, AlertTriangle, TrendingUp } from 'lucide-react';
import ProfileCard from '@/components/ProfileCard';
import PageHeader from '@/components/PageHeader';

const Chips = ({ items }) => (
  <div className="flex flex-wrap gap-2">
    {items?.map(x => (
      <span key={x} className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#334155]">{x}</span>
    ))}
  </div>
);

export default function AmbitionProfile() {
  const [p, setP] = useState();
  useEffect(() => { base44.entities.AmbitionProfile.list('-created_date', 1).then(x => setP(x[0])); }, []);

  if (!p) return (
    <div className="grid min-h-screen place-items-center" style={{ background: '#F8FAFC' }}>
      <p className="text-[#64748B]">Loading your profile...</p>
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8" style={{ background: '#F8FAFC' }}>
      <PageHeader
        eyebrow="Your ambition profile"
        title={`You are a ${p.archetype}.`}
        description="This is a working hypothesis — not a box. Use it to make sharper decisions and update it as you create evidence."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <ProfileCard label="Identity statement" dark>
          <p className="text-xl font-semibold leading-8">"{p.identity_statement}"</p>
        </ProfileCard>
        <ProfileCard label="Core motivations"><Chips items={p.motivations} /></ProfileCard>
        <ProfileCard label="Best-fit paths"><Chips items={p.best_fit_paths} /></ProfileCard>
        <ProfileCard label="Strengths"><Chips items={p.strengths} /></ProfileCard>
        <ProfileCard label="Biggest risk">
          <div className="flex gap-3">
            <AlertTriangle className="shrink-0 text-amber-500" size={18} />
            <p className="text-sm leading-6 text-[#334155]">{p.biggest_risk}</p>
          </div>
        </ProfileCard>
        <ProfileCard label="Biggest opportunity">
          <div className="flex gap-3">
            <TrendingUp className="shrink-0 text-[#10B981]" size={18} />
            <p className="text-sm leading-6 text-[#334155]">{p.biggest_opportunity}</p>
          </div>
        </ProfileCard>
        <ProfileCard label="Stop doing">
          <p className="text-sm leading-6 text-[#334155]">{p.stop_doing}</p>
        </ProfileCard>
        <ProfileCard label="Start doing">
          <p className="text-sm leading-6 text-[#334155]">{p.start_doing}</p>
        </ProfileCard>
      </div>
      <Link
        to="/roadmap"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5"
        style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', boxShadow: '0 12px 30px rgba(37,99,235,0.25)' }}
      >
        Open my roadmap <ArrowRight size={18} />
      </Link>
    </main>
  );
}