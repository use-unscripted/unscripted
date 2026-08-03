import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ExternalLink, Star } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { SkGrid } from '@/components/PageSkeleton';

const CATEGORY_LABELS = {
  ib_prep: 'Investment Banking', consulting_prep: 'Consulting', startup_fellowships: 'Startup Fellowships',
  entrepreneurship: 'Entrepreneurship', creator_education: 'Creator Education', brand_tools: 'Personal Brand',
  coding_tools: 'Coding & No-Code', fitness: 'Fitness', networking_tools: 'Networking', wellness: 'Wellness',
  simulations: 'Job Simulations', certifications: 'Certifications', competitions: 'Competitions',
  accelerators: 'Accelerators', scholarships: 'Scholarships', fellowships: 'Fellowships', other: 'Other',
};

const PRICE_STYLES = { free: { bg: 'var(--success-50)', text: 'var(--success-700)' }, paid: { bg: 'var(--ink-100)', text: 'var(--brand-navy-900)' }, freemium: { bg: 'var(--warning-50)', text: 'var(--warning-700)' } };

// Default curated resources shown when database is empty
const DEFAULT_RESOURCES = [
  { name: 'Forage', category: 'simulations', description: 'Free virtual job simulations from top companies including Goldman, BCG, JPMorgan, and more.', target_user: 'Students exploring specific roles or firms', price_type: 'free', external_url: 'https://forage.com', pros: ['Free', 'Built by actual companies', 'Adds to resume'], limitations: ['Completion not guaranteed to lead to interview'], recommendation_reason: 'Best way to test what a role actually involves before committing.', last_reviewed: '2025-01-01' },
  { name: 'Breaking Into Wall Street (BIWS)', category: 'ib_prep', description: 'The leading technical interview preparation resource for investment banking, with Excel, PowerPoint, and financial modeling courses.', target_user: 'Students targeting IB, PE, or VC', price_type: 'paid', estimated_cost: '$347–$497', external_url: 'https://breakingintowallstreet.com', pros: ['Industry standard', 'Comprehensive modeling practice'], limitations: ['Expensive', 'Assumes you already know you want IB'], recommendation_reason: 'Use this after confirming IB is the right path through information interviews.', last_reviewed: '2025-01-01' },
  { name: 'Lenny\'s Newsletter', category: 'creator_education', description: 'Practical product, growth, and career advice for people building in tech startups.', target_user: 'Students interested in product management or startup roles', price_type: 'freemium', external_url: 'https://lennysnewsletter.com', pros: ['Highly actionable', 'Written by a practitioner'], limitations: ['Tech-focused'], recommendation_reason: 'Strong example of how personal brand and expertise compound over time.', last_reviewed: '2025-01-01' },
  { name: 'Y Combinator Startup School', category: 'entrepreneurship', description: 'Free 10-week online course from the world\'s most prominent startup accelerator on how to build a company.', target_user: 'Students seriously considering a startup', price_type: 'free', external_url: 'https://startupschool.org', pros: ['Free', 'YC founders and partners teach it'], limitations: ['Requires significant time commitment'], recommendation_reason: 'Best structured way to assess startup fit before committing fully.', last_reviewed: '2025-01-01' },
  { name: 'Management Consulted', category: 'consulting_prep', description: 'Case interview preparation platform with practice cases, frameworks, and coaching.', target_user: 'Students targeting MBB or tier-2 consulting', price_type: 'freemium', external_url: 'https://managementconsulted.com', pros: ['Structured framework library', 'Case practice community'], limitations: ['Premium coaching is expensive'], recommendation_reason: 'Use after confirming consulting is right via conversations with consultants.', last_reviewed: '2025-01-01' },
  { name: 'Apollo.io (free tier)', category: 'networking_tools', description: 'Professional contact and outreach platform for finding verified work emails and managing networking outreach.', target_user: 'Students building intentional outreach lists', price_type: 'freemium', external_url: 'https://apollo.io', pros: ['Large verified database', 'Free tier available'], limitations: ['Terms of use apply — use for permitted outreach only'], recommendation_reason: 'Useful for finding contacts at companies you want to explore.', last_reviewed: '2025-01-01' },
  { name: 'Calm / Headspace', category: 'wellness', description: 'Meditation and mindfulness apps for stress management and sleep.', target_user: 'Students managing high workloads', price_type: 'freemium', external_url: 'https://calm.com', pros: ['Accessible', 'Evidence-based techniques'], limitations: ['Not a replacement for professional mental health support'], recommendation_reason: 'Unscripted recommends protecting mental clarity — performance depends on recovery.', last_reviewed: '2025-01-01' },
];

export default function ResourceHub() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    base44.entities.Resources.filter({ active: true }).then(data => {
      setResources(data.length ? data : DEFAULT_RESOURCES);
      setLoading(false);
    });
  }, []);

  const categories = ['all', ...new Set(resources.map(r => r.category))];
  const filtered = filter === 'all' ? resources : resources.filter(r => r.category === filter);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <PageHeader
        title="The right tool for each path."
        description="Unscripted recommends specialized resources — not to replace them, but to help you choose the right one at the right time."
      />

      {/* The category list is derived from the resources, so during the fetch
          it is a single "All categories" pill and then jumps to two wrapped
          rows. Reserve the loaded height. */}
      <div className="mb-8 flex flex-wrap content-start items-start gap-2" style={{ minHeight: 96 }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold transition border"
            style={filter === c ? { background: 'var(--brand-navy-900)', color: '#fff', borderColor: 'var(--brand-navy-900)' } : { background: 'white', color: 'var(--ink-700)', borderColor: 'var(--ink-200)' }}>
            {c === 'all' ? 'All categories' : CATEGORY_LABELS[c] || c}
          </button>
        ))}
      </div>

      {/* Two rows at the real card height, and the region holds that height
          once loaded. The card count is unknowable mid-fetch, so this is a
          deliberate middle: an empty library no longer yanks the note below it
          up the screen, and a full one only pushes it down by the rows the
          reserve did not cover. */}
      <div style={{ minHeight: 664 }}>
      {loading ? (
        <SkGrid count={6} h={324} cols={3} r={20} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r, i) => {
            const ps = PRICE_STYLES[r.price_type] || PRICE_STYLES.free;
            return (
              <div key={r.id || i} className={`rounded-[20px] border bg-white p-5 flex flex-col ${r.featured ? 'border-[rgba(31,58,95,0.35)]' : 'border-[color:var(--ink-200)]'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    {r.featured && <div className="flex items-center gap-1 text-xs font-bold mb-1" style={{ color: 'var(--brand-navy-900)' }}><Star size={11} /> Featured</div>}
                    <h3 className="font-heading font-bold text-[color:var(--surface-dark-900)]">{r.name}</h3>
                    <span className="text-xs" style={{ color: 'var(--ink-500)' }}>{CATEGORY_LABELS[r.category] || r.category}</span>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: ps.bg, color: ps.text }}>
                    {r.price_type === 'free' ? 'Free' : r.price_type === 'freemium' ? 'Freemium' : r.estimated_cost || 'Paid'}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--ink-700)] leading-6 flex-1">{r.description}</p>
                {r.recommendation_reason && (
                  <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--ink-100)', border: '1px solid rgba(31,58,95,0.15)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-navy-900)' }}>Why Unscripted recommends it</p>
                    <p className="text-xs text-[color:var(--ink-700)]">{r.recommendation_reason}</p>
                  </div>
                )}
                {r.limitations?.[0] && (
                  <p className="mt-2 text-xs text-[color:var(--ink-500)]"><strong>Note:</strong> {Array.isArray(r.limitations) ? r.limitations[0] : r.limitations}</p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  {r.last_reviewed && <span className="text-xs text-[color:var(--ink-400)]">Reviewed {new Date(r.last_reviewed).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                  {r.external_url && (
                    <a href={r.external_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-px"
                      style={{ background: 'var(--brand-navy-900)' }}>
                      Visit <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      <div className="mt-10 rounded-[20px] p-5" style={{ background: 'var(--ink-100)', border: '1px solid var(--ink-200)' }}>
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--ink-500)] mb-1">Coming later</p>
        <p className="text-sm text-[color:var(--ink-700)]">Live labor-market data, Apollo and Hunter integrations, campus-specific resource directories, and an affiliate marketplace are planned for future releases.</p>
      </div>
    </main>
  );
}