import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ExternalLink, Instagram, Youtube, Linkedin, BadgeCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { SkGrid } from '@/components/PageSkeleton';

const FILTER_TAGS = ['All', 'Founder', 'Creator', 'Finance', 'Consulting', 'Startup', 'Fitness', 'Healthcare', 'Technology', 'Media', 'Personal Brand', 'Social Impact', 'Freelancing'];

// Sample curated profiles shown when db is empty
const SAMPLE_PROFILES = [
  {
    name: 'Sahil Bloom',
    category: ['Creator', 'Finance', 'Personal Brand'],
    role: 'Investor, Writer, Creator',
    company: 'SRB Ventures',
    short_bio: 'Former investment banker who left finance to build a media business around curiosity and ideas. Now manages a venture fund and writes to 500,000+ subscribers.',
    starting_point: 'Worked in private equity at Altamont Capital. Grew up as a D1 baseball player at Stanford.',
    milestones: ['Started writing on Twitter in 2020', 'Grew to 500K+ followers in 18 months', 'Launched paid newsletter Curiosity Chronicle', 'Launched SRB Ventures fund', 'Built a personal brand before launching business ventures'],
    skills: ['Writing', 'Audience building', 'Capital allocation', 'Community building'],
    lessons: ['Start sharing your thinking publicly before you feel ready', 'Your unique background becomes leverage when combined with consistent output', 'Traditional paths create optionality, but they are not the only path'],
    student_takeaways: 'Sahil shows that a traditional career can be a launchpad rather than a ceiling. He used finance skills as credibility and converted them into a platform. The key lesson: start writing now.',
    twitter_url: 'https://twitter.com/SahilBloom',
    website_url: 'https://sahilbloom.com',
    source_urls: ['https://sahilbloom.com', 'https://twitter.com/SahilBloom'],
    verified: true,
    last_reviewed: '2025-01-01',
  },
  {
    name: 'Ali Abdaal',
    category: ['Creator', 'Personal Brand', 'Technology'],
    role: 'YouTuber, Entrepreneur',
    company: 'Part-Time YouTuber',
    short_bio: 'Former NHS doctor turned full-time content creator and entrepreneur. Built one of the largest educational YouTube channels while working as a physician.',
    starting_point: 'Medical student at Cambridge University. Started YouTube as a side project.',
    milestones: ['Started YouTube in 2017 while in medical school', 'Grew to 5M+ subscribers', 'Launched Part-Time YouTuber Academy (paid course)', 'Left medicine to focus on entrepreneurship and content full-time'],
    skills: ['YouTube production', 'Audience building', 'Online education', 'Time management'],
    lessons: ['Start as a side project before making it your main thing', 'A traditional credential adds credibility to your content', 'Build the audience before you build the product'],
    student_takeaways: 'Ali demonstrates that you do not have to choose between a traditional career and building a creative business early. His biggest advantage was starting in school with zero pressure.',
    youtube_url: 'https://youtube.com/@aliabdaal',
    website_url: 'https://aliabdaal.com',
    source_urls: ['https://aliabdaal.com'],
    verified: true,
    last_reviewed: '2025-01-01',
  },
];

export default function CreatorLibrary() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    base44.entities.CreatorProfiles.filter({ active: true }).then(data => {
      setProfiles(data.length ? data : SAMPLE_PROFILES);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'All' ? profiles : profiles.filter(p => p.category?.includes(filter));

  if (selected) {
    const p = selected;
    return (
      <main className="app-page">
        <button onClick={() => setSelected(null)} className="tp-body mb-7 font-semibold transition hover:opacity-80" style={{ color: 'var(--brand-navy-900)' }}>← Back to profiles</button>
        <div className="rounded-[24px] border border-[color:var(--ink-200)] bg-white p-7 sm:p-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="tp-page text-[color:var(--surface-dark-900)]">{p.name}</h1>
              <p className="tp-lead mt-2 text-[color:var(--ink-500)]">{p.role}{p.company ? ` · ${p.company}` : ''}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.category?.map((c, i) => <span key={i} className="tp-meta rounded-full px-2.5 py-1 font-semibold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>{c}</span>)}
                {p.verified && <span className="tp-meta rounded-full px-2.5 py-1 font-bold" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>Verified profile</span>}
              </div>
            </div>
            <div className="flex gap-3">
              {p.instagram_url && <a href={p.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--ink-500)] hover:text-[var(--brand-navy-900)]"><Instagram size={20} /></a>}
              {p.youtube_url && <a href={p.youtube_url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--ink-500)] hover:text-[var(--brand-navy-900)]"><Youtube size={20} /></a>}
              {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--ink-500)] hover:text-[var(--brand-navy-900)]"><Linkedin size={20} /></a>}
              {p.website_url && <a href={p.website_url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--ink-500)] hover:text-[var(--brand-navy-900)]"><ExternalLink size={20} /></a>}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-3">Overview</h2>
              <p className="tp-prose text-[color:var(--ink-700)]">{p.short_bio}</p>
            </div>
            {p.starting_point && (
              <div>
                <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-3">Starting point</h2>
                <p className="tp-prose text-[color:var(--ink-700)]">{p.starting_point}</p>
              </div>
            )}
            {p.milestones?.length > 0 && (
              <div>
                <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-3">Major milestones</h2>
                <ol className="space-y-2">{p.milestones.map((m, i) => (
                  <li key={i} className="tp-body flex gap-3 text-[color:var(--ink-700)]">
                    <span className="shrink-0 font-bold" style={{ color: 'var(--brand-navy-900)' }}>{i + 1}.</span>{m}
                  </li>
                ))}</ol>
              </div>
            )}
            {p.lessons?.length > 0 && (
              <div>
                <h2 className="tp-section text-[color:var(--surface-dark-900)] mb-3">Honest lessons</h2>
                <ul className="space-y-2">{p.lessons.map((l, i) => <li key={i} className="tp-body flex gap-2 text-[color:var(--ink-700)]"><span style={{ color: 'var(--brand-navy-900)' }}>·</span>{l}</li>)}</ul>
              </div>
            )}
            {p.student_takeaways && (
              <div className="rounded-[16px] p-5" style={{ background: 'var(--ink-100)', border: '1px solid rgba(31,58,95,0.15)' }}>
                <h2 className="tp-section mb-2.5" style={{ color: 'var(--brand-navy-900)' }}>What you can take away</h2>
                <p className="tp-prose text-[color:var(--ink-700)]">{p.student_takeaways}</p>
              </div>
            )}
            {p.source_urls?.length > 0 && (
              <p className="tp-meta text-[color:var(--ink-400)]">Sources: {p.source_urls.join(', ')}
                {p.last_reviewed && ` · Reviewed ${new Date(p.last_reviewed).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      {/* The title was word-for-word the same as the Blueprint Library's.
          With the page-name eyebrow above it the two headings were at least
          distinguishable; without it they were the same page twice. */}
      <PageHeader
        title="People who took the path first."
        description="Curated profiles of founders, creators, and professionals, with honest stories rather than highlight reels. All profiles use public information and are reviewed for accuracy."
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {FILTER_TAGS.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className="tp-meta rounded-full px-4 py-2 font-semibold transition border"
            style={filter === t ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' } : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
            {t}
          </button>
        ))}
      </div>

      {/* One row reserved, and the region holds that height once loaded, so
          the note underneath does not slide when the grid turns out shorter
          than the skeleton. */}
      <div style={{ minHeight: 200 }}>
      {loading ? (
        <SkGrid count={3} h={200} cols={3} r={20} />
      ) : filtered.length === 0 ? (
        <div className="tp-body rounded-[24px] border border-dashed border-[color:var(--ink-200)] px-8 py-14 text-center text-[color:var(--ink-500)]">
          No profiles in this category yet. More are being added regularly.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <button key={p.id || i} onClick={() => setSelected(p)}
              className="rounded-[20px] border border-[color:var(--ink-200)] bg-white p-5 text-left transition hover:shadow-md hover:border-[rgba(31,58,95,0.25)] hover:-translate-y-0.5">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {p.category?.slice(0, 2).map((c, ci) => (
                  <span key={ci} className="tp-meta rounded-full px-2.5 py-0.5 font-semibold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>{c}</span>
                ))}
                {p.verified && <BadgeCheck size={14} className="text-[color:var(--success-700)]" aria-label="Verified profile" />}
              </div>
              <h3 className="tp-card text-[color:var(--surface-dark-900)]">{p.name}</h3>
              <p className="tp-meta text-[color:var(--ink-500)] mt-1">{p.role}{p.company ? ` · ${p.company}` : ''}</p>
              <p className="tp-body mt-3 text-[color:var(--ink-700)] line-clamp-3">{p.short_bio}</p>
            </button>
          ))}
        </div>
      )}
      </div>

      <div className="mt-10 rounded-[20px] p-5" style={{ background: 'var(--ink-100)' }}>
        <p className="tp-eyebrow text-[color:var(--ink-500)] mb-2">About these profiles</p>
        <p className="tp-prose text-[color:var(--ink-700)]">All profiles use publicly available information. Unscripted does not scrape protected social-media content, fabricate histories, or claim private information. Profiles are reviewed periodically for accuracy. Dates shown indicate last review.</p>
      </div>
    </main>
  );
}