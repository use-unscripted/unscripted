import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, AlertTriangle, TrendingUp } from 'lucide-react';
import ProfileCard from '@/components/ProfileCard';
import PageHeader from '@/components/PageHeader';
import { SkHeader, SkGrid } from '@/components/PageSkeleton';

const Chips = ({ items }) => (
  <div className="flex flex-wrap gap-2">
    {items?.map(x => (
      <span key={x} className="tp-meta rounded-full border border-[color:var(--ink-200)] bg-[color:var(--page-surface)] px-3 py-1.5 font-semibold text-[color:var(--ink-700)]">{x}</span>
    ))}
  </div>
);

export default function AmbitionProfile() {
  const [p, setP] = useState();
  useEffect(() => { base44.entities.AmbitionProfile.list('-created_date', 1).then(x => setP(x[0])); }, []);

  // A centred line of text on an otherwise empty screen, replaced by a full
  // two-column page, is the most violent swap on the site. Stand the page up
  // where it will actually be instead.
  if (!p) return (
    <main className="app-page" style={{ background: 'var(--page-surface)' }}>
      <SkHeader eyebrow />
      <SkGrid count={4} h={210} cols={2} gap={20} r={24} />
    </main>
  );

  return (
    <main className="app-page" style={{ background: 'var(--page-surface)' }}>
      <PageHeader
        eyebrow="Your Unscripted Profile"
        title={`You are a ${p.archetype}.`}
        description="This is a working hypothesis, not a box. Use it to make sharper decisions and update it as you create evidence."
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
            <p className="tp-body text-[color:var(--ink-700)]">{p.biggest_risk}</p>
          </div>
        </ProfileCard>
        <ProfileCard label="Biggest opportunity">
          <div className="flex gap-3">
            <TrendingUp className="shrink-0" size={18} style={{ color: 'var(--success-700)' }} />
            <p className="tp-body text-[color:var(--ink-700)]">{p.biggest_opportunity}</p>
          </div>
        </ProfileCard>
        <ProfileCard label="Stop doing">
          <p className="tp-prose text-[color:var(--ink-700)]">{p.stop_doing}</p>
        </ProfileCard>
        <ProfileCard label="Start doing">
          <p className="tp-prose text-[color:var(--ink-700)]">{p.start_doing}</p>
        </ProfileCard>
      </div>
      <Link
        to="/roadmap"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-[10px] px-6 py-4 font-semibold text-white transition hover:-translate-y-px"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}
      >
        Open my roadmap <ArrowRight size={18} />
      </Link>
    </main>
  );
}