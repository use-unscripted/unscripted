import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';

const PRIORITIES = ['income', 'lifestyle', 'autonomy', 'stability', 'creativity', 'impact', 'flexibility', 'prestige'];

const RISK_COLORS = { low: { bg: '#F0FDF4', text: '#15803D' }, medium: { bg: '#FFFBEB', text: '#B45309' }, high: { bg: '#FEF2F2', text: '#B91C1C' } };

function PathCard({ rec, expanded, onToggle }) {
  const d = rec.generated_detail || {};
  const risk = d.risk_level || 'medium';
  const rc = RISK_COLORS[risk] || RISK_COLORS.medium;

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-heading text-xl font-bold text-[#050816]">{rec.path_name}</h2>
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: rc.bg, color: rc.text }}>
                {risk} risk
              </span>
              {rec.confidence_level && (
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#F8ECEF', color: '#8B0C21' }}>
                  {rec.confidence_level} fit confidence
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-[#334155]">{rec.fit_reason}</p>
          </div>
          <button onClick={onToggle} className="shrink-0 rounded-xl border border-[#E2E8F0] p-2 hover:bg-[#F8FAFC] transition">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {rec.concern && (
          <div className="mt-4 rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)' }}>
            <p className="text-xs font-bold text-[#B45309] uppercase tracking-wide mb-1">Potential concern</p>
            <p className="text-sm text-[#334155]">{rec.concern}</p>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-[#E2E8F0] p-6 space-y-5">
          {d.day_to_day && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Day-to-day reality</p>
              <p className="text-sm text-[#334155] leading-6">{d.day_to_day}</p>
            </div>
          )}
          {d.lifestyle && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Lifestyle</p>
              <p className="text-sm text-[#334155] leading-6">{d.lifestyle}</p>
            </div>
          )}
          {d.income_trajectory && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Income trajectory</p>
              <p className="text-sm text-[#334155]">{d.income_trajectory}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {d.advantages?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] mb-2" style={{ color: '#15803D' }}>Advantages</p>
                <ul className="space-y-1">{d.advantages.map((a, i) => <li key={i} className="text-sm text-[#334155]">· {a}</li>)}</ul>
              </div>
            )}
            {d.drawbacks?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] mb-2" style={{ color: '#B91C1C' }}>Drawbacks</p>
                <ul className="space-y-1">{d.drawbacks.map((d2, i) => <li key={i} className="text-sm text-[#334155]">· {d2}</li>)}</ul>
              </div>
            )}
          </div>
          {rec.current_gaps?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#64748B] mb-2">Your current gaps</p>
              <div className="flex flex-wrap gap-2">{rec.current_gaps.map((g, i) => (
                <span key={i} className="rounded-full border border-[#E2E8F0] px-3 py-1 text-xs text-[#334155]">{g}</span>
              ))}</div>
            </div>
          )}
          {rec.first_experiment && (
            <div className="rounded-xl p-4" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
              <p className="text-xs font-bold uppercase tracking-[.12em] mb-2" style={{ color: '#8B0C21' }}>First low-risk experiment</p>
              <p className="text-sm text-[#334155]">{rec.first_experiment}</p>
            </div>
          )}
          <Link
            to={`/experiments/new?recId=${rec.id}&pathName=${encodeURIComponent(rec.path_name)}`}
            className="inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
            style={{ color: '#8B0C21' }}>
            Start an Experiment for This Path <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function PathComparison() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('fit');

  const load = async () => {
    const data = await base44.entities.PathRecommendations.list('-created_date', 10);
    setRecs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generatePaths = async () => {
    setGenerating(true);
    const [profiles, goals] = await Promise.all([
      base44.entities.StudentProfile.list('-created_date', 1),
      base44.entities.Goals.list('-created_date', 20),
    ]);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Unscripted, a life-design platform for ambitious college students. Based on this student's profile and goals, recommend 4 realistic career and life paths. Include both traditional and non-traditional options where appropriate. Be honest about tradeoffs. The student must remain the decision-maker.

Student profile: ${JSON.stringify(profiles[0])}
Goals: ${JSON.stringify(goals)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path_name: { type: 'string' },
                fit_reason: { type: 'string' },
                concern: { type: 'string' },
                readiness_score: { type: 'number' },
                confidence_level: { type: 'string' },
                current_gaps: { type: 'array', items: { type: 'string' } },
                first_experiment: { type: 'string' },
                generated_detail: {
                  type: 'object',
                  properties: {
                    day_to_day: { type: 'string' },
                    lifestyle: { type: 'string' },
                    income_trajectory: { type: 'string' },
                    risk_level: { type: 'string' },
                    advantages: { type: 'array', items: { type: 'string' } },
                    drawbacks: { type: 'array', items: { type: 'string' } },
                  }
                }
              }
            }
          }
        }
      }
    });
    await base44.entities.PathRecommendations.bulkCreate(result.paths || []);
    await load();
    setGenerating(false);
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Path comparison"
        title="Three paths worth testing."
        description="These recommendations are based on your profile and selected paths. None is objectively correct. Your job is to test and learn."
      />

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading your paths...</div>
      ) : recs.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-16 text-center">
          <h3 className="font-heading text-xl font-bold text-[#050816]">No path recommendations yet.</h3>
          <p className="mt-2 text-sm text-[#64748B]">Complete your intake first, or generate recommendations now.</p>
          <button onClick={generatePaths} disabled={generating}
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            {generating ? 'Generating...' : 'Generate My Path Recommendations'} <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-[#64748B]">{recs.length} paths recommended based on your profile</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B]">Sort by:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#334155] outline-none">
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {recs.map(rec => (
              <PathCard key={rec.id} rec={rec}
                expanded={expandedId === rec.id}
                onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)} />
            ))}
          </div>

          <div className="mt-8 rounded-[20px] p-6 text-center" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
            <p className="text-sm font-semibold text-[#334155]">
              These are recommendations based on what you shared, not a verdict. The goal is to help you test paths intelligently — not choose one permanently.
            </p>
          </div>

          <button onClick={generatePaths} disabled={generating}
            className="mt-4 text-sm font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
            {generating ? 'Regenerating...' : 'Regenerate recommendations'}
          </button>
        </>
      )}
    </main>
  );
}