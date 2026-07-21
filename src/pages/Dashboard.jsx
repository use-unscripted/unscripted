import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowRight, Flame, CheckCircle, Clock, AlertTriangle, Users, FileText, RotateCcw, Star, Plus, Target } from 'lucide-react';
import PathSwitcher from '@/components/PathSwitcher';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const STATUS_CFG = {
  active:    { bg: '#F0FDF4', text: '#15803D', label: 'Active' },
  exploring: { bg: '#F8ECEF', text: '#8B0C21', label: 'Exploring' },
  paused:    { bg: '#FFFBEB', text: '#B45309', label: 'Paused' },
  completed: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Completed' },
  draft:     { bg: '#F1F5F9', text: '#64748B', label: 'Draft' },
};

function pathStatusCfg(s) { return STATUS_CFG[s] || STATUS_CFG.exploring; }

export default function Dashboard() {
  const [paths, setPaths] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('all');
  const [experiments, setExperiments] = useState([]);
  const [outreach, setOutreach] = useState([]);
  const [proof, setProof] = useState([]);
  const [reflections, setReflections] = useState([]);

  const load = async () => {
    const [ps, exps, out, prf, refs] = await Promise.all([
      base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      base44.entities.Experiments.list('-created_date', 50).catch(() => []),
      base44.entities.OutreachContacts.list('-created_date', 50).catch(() => []),
      base44.entities.ProofOfWork.list('-created_date', 50).catch(() => []),
      base44.entities.WeeklyReflections.list('-created_date', 1).catch(() => []),
    ]);
    const pathList = Array.isArray(ps) ? ps : [];
    setPaths(pathList);
    setExperiments(Array.isArray(exps) ? exps : []);
    setOutreach(Array.isArray(out) ? out : []);
    setProof(Array.isArray(prf) ? prf : []);
    setReflections(Array.isArray(refs) ? refs : []);

    // Auto-select primary focus if nothing selected
    const primary = pathList.find(p => p.is_primary_focus);
    if (primary && selectedPathId === 'all') {
      setSelectedPathId(primary.id);
    }
  };

  useEffect(() => { load(); }, []);

  // Selected path object
  const selectedPath = selectedPathId === 'all' ? null : paths.find(p => p.id === selectedPathId);

  // Filter data by selected path
  const filteredExps = selectedPath
    ? experiments.filter(e => e.path_name === selectedPath.path_name)
    : experiments;

  const filteredOutreach = selectedPath
    ? outreach.filter(c => c.path_being_tested === selectedPath.path_name || filteredExps.some(e => e.id === c.experiment_id))
    : outreach;

  const filteredProof = selectedPath
    ? proof.filter(p => p.path_tested === selectedPath.path_name || filteredExps.some(e => e.id === p.experiment_id))
    : proof;

  const activeExps = filteredExps.filter(e => e.status === 'in_progress');
  const plannedExps = filteredExps.filter(e => e.status === 'planned');
  const completedExps = filteredExps.filter(e => e.status === 'completed');
  const overdueOutreach = filteredOutreach.filter(c => c.followup_date && new Date(c.followup_date) < new Date() && !['completed', 'responded'].includes(c.response_status));
  const nextExp = activeExps[0] || plannedExps[0];

  const pct = filteredExps.length ? Math.round(completedExps.length / filteredExps.length * 100) : 0;

  const primaryPath = paths.find(p => p.is_primary_focus);
  const otherActivePaths = paths.filter(p => !p.is_primary_focus && ['active', 'exploring', 'draft'].includes(p.status));

  // First experiment (for days remaining calc)
  const firstExp = filteredExps[filteredExps.length - 1];
  const daysLeft = firstExp?.created_date ? daysUntil(
    new Date(new Date(firstExp.created_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  ) : null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">

      {/* Path switcher row */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <PathSwitcher
            paths={paths.filter(p => !['archived'].includes(p.status))}
            selectedId={selectedPathId}
            onChange={setSelectedPathId}
            showAll
          />
          {selectedPath && (
            <span className="text-xs text-[#64748B]">
              Showing data for <strong className="text-[#050816]">{selectedPath.path_name}</strong>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link to="/paths"
            className="text-xs font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
            Manage paths →
          </Link>
        </div>
      </div>

      {/* Primary Focus banner */}
      <section className="mb-6 rounded-[22px] p-7 text-white" style={{ background: '#081225', border: '1px solid rgba(139,12,33,0.30)' }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {primaryPath?.is_primary_focus && <Star size={13} style={{ color: '#8B0C21' }} />}
              <p className="text-xs font-bold uppercase tracking-[.14em]" style={{ color: '#8B0C21' }}>
                {selectedPath ? `Viewing: ${selectedPath.path_name}` : primaryPath ? 'Primary Focus' : 'No primary path set'}
              </p>
            </div>
            <h2 className="font-heading text-2xl font-bold text-white">
              {selectedPath?.path_name || primaryPath?.path_name || 'No path selected yet'}
            </h2>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
              {daysLeft !== null && <span><span className="font-bold text-white">{daysLeft}</span> days remaining</span>}
              <span><span className="font-bold text-white">{completedExps.length}</span> of {filteredExps.length} experiments done</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/paths"
              className="shrink-0 rounded-[10px] border border-[rgba(139,12,33,0.4)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[rgba(139,12,33,0.2)] text-center">
              Manage paths →
            </Link>
            <Link to="/paths"
              className="shrink-0 rounded-[10px] border border-[rgba(255,255,255,0.1)] px-4 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 text-center">
              <Plus size={12} className="inline mr-1" /> Create another path
            </Link>
          </div>
        </div>

        {filteredExps.length > 0 && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Path-test progress</span>
              <span>{completedExps.length}/{filteredExps.length} experiments · {pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#8B0C21' }} />
            </div>
          </div>
        )}

        {nextExp && (
          <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#8B0C21' }}>
              <Flame size={13} /> Next best action
            </div>
            <p className="font-semibold text-white">{nextExp.title}</p>
            <p className="text-sm text-slate-400 mt-1">{nextExp.objective}</p>
            <Link to="/experiments" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
              View in Missions <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {!nextExp && filteredExps.length === 0 && (
          <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-sm text-slate-300">No experiments yet. <Link to="/experiments" className="font-semibold" style={{ color: '#8B0C21' }}>Start your first mission →</Link></p>
          </div>
        )}
      </section>

      {/* Other active paths strip */}
      {otherActivePaths.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#94A3B8] mb-3">Other Active Paths</p>
          <div className="flex gap-3 flex-wrap">
            {otherActivePaths.map(p => {
              const cfg = pathStatusCfg(p.status);
              const pathExps = experiments.filter(e => e.path_name === p.path_name);
              const donePct = pathExps.length ? Math.round(pathExps.filter(e => e.status === 'completed').length / pathExps.length * 100) : 0;
              return (
                <button key={p.id} onClick={() => setSelectedPathId(p.id)}
                  className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 text-left hover:border-[rgba(139,12,33,0.3)] transition min-w-[160px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                  </div>
                  <p className="text-sm font-bold text-[#050816] truncate">{p.path_name}</p>
                  {pathExps.length > 0 && (
                    <div className="mt-2">
                      <div className="h-1 rounded-full overflow-hidden bg-[#F1F5F9]">
                        <div className="h-full rounded-full" style={{ width: `${donePct}%`, background: '#8B0C21' }} />
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">{donePct}% done</p>
                    </div>
                  )}
                </button>
              );
            })}
            <Link to="/paths"
              className="rounded-[16px] border border-dashed border-[#E2E8F0] p-4 flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#8B0C21] hover:border-[rgba(139,12,33,0.3)] transition min-w-[120px]">
              <Plus size={14} /> Add path
            </Link>
          </div>
        </section>
      )}

      {/* Overdue outreach */}
      {overdueOutreach.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-[16px] p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)' }}>
          <AlertTriangle size={16} className="shrink-0 text-[#B45309] mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#B45309]">{overdueOutreach.length} overdue follow-up{overdueOutreach.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-[#334155] mt-0.5">Follow up, reschedule, or mark complete.</p>
          </div>
          <Link to="/outreach" className="text-xs font-semibold" style={{ color: '#8B0C21' }}>Review →</Link>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* This week's missions */}
        <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold text-[#050816]">This Week's Missions</h2>
            <Link to="/experiments" className="text-xs font-semibold" style={{ color: '#8B0C21' }}>All missions →</Link>
          </div>
          {activeExps.length === 0 && plannedExps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] p-6 text-center text-sm text-[#64748B]">
              No active missions. <Link to="/experiments" className="font-semibold" style={{ color: '#8B0C21' }}>Start one →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {[...activeExps, ...plannedExps].slice(0, 4).map(exp => {
                const s = exp.status === 'in_progress' ? { bg: '#FFFBEB', text: '#B45309', label: 'In Progress' } : { bg: '#F1F5F9', text: '#334155', label: 'Planned' };
                return (
                  <div key={exp.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#FAFAF9', border: '1px solid #E2E8F0' }}>
                    <span className="mt-0.5 rounded-full px-2 py-0.5 text-xs font-bold shrink-0" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#050816] truncate">{exp.title}</p>
                      {exp.estimated_hours && <p className="text-xs text-[#64748B] mt-0.5"><Clock size={10} className="inline mr-1" />~{exp.estimated_hours}h</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Proof of work */}
        <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold text-[#050816]">Proof of Work</h2>
            <Link to="/proof" className="text-xs font-semibold" style={{ color: '#8B0C21' }}>All entries →</Link>
          </div>
          {filteredProof.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] p-6 text-center text-sm text-[#64748B]">
              No proof submitted yet. Complete a mission to add your first entry.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProof.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#FAFAF9', border: '1px solid #E2E8F0' }}>
                  <CheckCircle size={15} className="shrink-0 mt-0.5" style={{ color: '#15803D' }} />
                  <div>
                    <p className="text-sm font-semibold text-[#050816]">{p.title}</p>
                    <p className="text-xs text-[#64748B] mt-0.5 capitalize">{p.category?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Outreach */}
        <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold text-[#050816]">Upcoming Conversations</h2>
            <Link to="/outreach" className="text-xs font-semibold" style={{ color: '#8B0C21' }}>All outreach →</Link>
          </div>
          {filteredOutreach.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] p-6 text-center text-sm text-[#64748B]">
              No contacts yet. Informational interviews are your highest-leverage experiment.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOutreach.filter(c => ['sent', 'responded', 'call_scheduled'].includes(c.response_status)).slice(0, 3).map(c => (
                <div key={c.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: '#FAFAF9', border: '1px solid #E2E8F0' }}>
                  <Users size={14} className="shrink-0 mt-0.5" style={{ color: '#8B0C21' }} />
                  <div>
                    <p className="text-sm font-semibold text-[#050816]">{c.name}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{c.role}{c.company && ` · ${c.company}`}</p>
                  </div>
                </div>
              ))}
              {filteredOutreach.filter(c => ['sent', 'responded', 'call_scheduled'].includes(c.response_status)).length === 0 && (
                <div className="rounded-xl border border-dashed border-[#E2E8F0] p-4 text-center text-sm text-[#64748B]">
                  No active outreach. <Link to="/outreach" className="font-semibold" style={{ color: '#8B0C21' }}>Start reaching out →</Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Weekly reflection */}
        <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold text-[#050816]">Weekly Reflection</h2>
            <Link to="/reflection" className="text-xs font-semibold" style={{ color: '#8B0C21' }}>Go →</Link>
          </div>
          {reflections.length === 0 ? (
            <div className="rounded-[16px] p-5 text-center" style={{ background: '#F8ECEF', border: '1px solid rgba(139,12,33,0.2)' }}>
              <p className="font-heading font-bold text-[#050816] text-sm">No reflection this week yet</p>
              <p className="mt-1 text-xs text-[#334155]">Reflections update your path assessment. They take 5 minutes.</p>
              <Link to="/reflection"
                className="mt-4 inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-xs font-semibold text-white transition hover:-translate-y-px"
                style={{ background: '#8B0C21' }}>
                Start reflection <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-2 mb-3">
                <CheckCircle size={15} style={{ color: '#15803D' }} className="shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-[#050816]">Reflection completed this week</p>
              </div>
              {reflections[0]?.generated_summary && (
                <p className="text-sm text-[#334155] leading-6 line-clamp-3">{reflections[0].generated_summary}</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Quick links */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { to: '/proof', label: 'Submit proof', sub: 'Document a completed mission', Icon: FileText },
          { to: '/outreach', label: 'Track outreach', sub: 'Log a new contact or follow-up', Icon: Users },
          { to: '/reflection', label: 'Reflect', sub: 'Update your path assessment', Icon: RotateCcw },
        ].map(({ to, label, sub, Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-[16px] border border-[#E2E8F0] bg-white p-4 transition hover:border-[rgba(139,12,33,0.25)] hover:shadow-sm hover:-translate-y-0.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: '#F8ECEF' }}>
              <Icon size={16} style={{ color: '#8B0C21' }} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#050816]">{label}</p>
              <p className="text-xs text-[#64748B]">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}