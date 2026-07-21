import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Mail, CheckCircle, Clock, ExternalLink, Phone, Pencil, ChevronDown, Beaker, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import AddContactModal, { ContactSuccessToast } from '@/components/outreach/AddContactModal';
import PathSwitcher from '@/components/PathSwitcher';
import SoftDeleteConfirm, { softDeletePayload } from '@/components/SoftDeleteConfirm';

const ALL_STATUS_OPTIONS = [
  { value: 'not_sent', label: 'Not contacted', bg: '#F1F5F9', text: '#334155' },
  { value: 'planning', label: 'Planning', bg: '#EFF6FF', text: '#1D4ED8' },
  { value: 'sent', label: 'Contacted', bg: '#FFFBEB', text: '#B45309' },
  { value: 'follow_up_needed', label: 'Follow-up needed', bg: '#FEF3C7', text: '#D97706' },
  { value: 'call_scheduled', label: 'Meeting scheduled', bg: '#F8ECEF', text: '#8B0C21' },
  { value: 'responded', label: 'Completed', bg: '#F0FDF4', text: '#15803D' },
  { value: 'no_response', label: 'No response', bg: '#F1F5F9', text: '#64748B' },
  { value: 'completed', label: 'Closed', bg: '#F0FDF4', text: '#15803D' },
  { value: 'other', label: 'Other', bg: '#F1F5F9', text: '#334155' },
];

const CONTACT_TYPE_LABELS = {
  informational_interview: 'Info Interview', networking: 'Networking', mentor: 'Mentor',
  recruiter: 'Recruiter', alumni: 'Alumni', industry_professional: 'Industry Pro',
  founder: 'Founder', investor: 'Investor', potential_customer: 'Potential Customer',
  potential_partner: 'Potential Partner', other: 'Other',
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ContactCard({ c, experimentsMap, missionsMap, onEdit, onStatusChange, onToggleThankYou, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exp = c.experiment_id ? experimentsMap[c.experiment_id] : null;
  const mission = c.mission_id ? missionsMap[c.mission_id] : null;
  const s = ALL_STATUS_OPTIONS.find(x => x.value === c.response_status) || ALL_STATUS_OPTIONS[0];
  const isOverdue = c.followup_date && new Date(c.followup_date) < new Date() && !['completed','responded'].includes(c.response_status);

  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-5">
      {confirmDelete && (
        <SoftDeleteConfirm
          itemName={c.name}
          onConfirm={() => { setConfirmDelete(false); onDelete(c); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {c.contact_type && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: '#F8ECEF', color: '#8B0C21' }}>
                {CONTACT_TYPE_LABELS[c.contact_type] || c.contact_type}
              </span>
            )}
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: s.bg, color: s.text }}>
              {s.label}
            </span>
            {c.thank_you_sent && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold flex items-center gap-1" style={{ background: '#F0FDF4', color: '#15803D' }}>
                <CheckCircle size={10} /> Thank-you sent
              </span>
            )}
          </div>
          <h3 className="font-heading font-bold text-[#050816] leading-snug">{c.name}</h3>
          {(c.role || c.company) && (
            <p className="text-sm text-[#334155]">
              {c.role}{c.role && c.company ? ' · ' : ''}{c.company}
            </p>
          )}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(v => !v)} className="rounded-lg p-1.5 text-[#94A3B8] hover:text-[#334155] hover:bg-[#F1F5F9] transition" aria-label="More actions">
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-[#E2E8F0] bg-white shadow-lg py-1">
              <button onClick={() => { setMenuOpen(false); onEdit(c); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#334155] hover:bg-[#F8FAFC]">
                <Pencil size={13} /> Edit contact
              </button>
              <button onClick={() => { setMenuOpen(false); onToggleThankYou(c); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#334155] hover:bg-[#F8FAFC]">
                <CheckCircle size={13} /> {c.thank_you_sent ? 'Unmark thank-you' : 'Mark thank-you sent'}
              </button>
              <button onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-500 hover:bg-red-50">
                <Trash2 size={13} /> Delete contact
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contact methods */}
      <div className="flex flex-wrap gap-3 mb-3">
        {c.email && (
          <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#8B0C21] transition">
            <Mail size={12} />{c.email}
          </a>
        )}
        {c.phone && (
          <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#8B0C21] transition">
            <Phone size={12} />{c.phone}
          </a>
        )}
        {c.profile_url && (
          <a href={c.profile_url.startsWith('http') ? c.profile_url : 'https://' + c.profile_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#8B0C21] transition">
            <ExternalLink size={12} />LinkedIn
          </a>
        )}
        {c.website_url && (
          <a href={c.website_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#8B0C21] transition">
            <ExternalLink size={12} />Website
          </a>
        )}
      </div>

      {/* Status selector */}
      <div className="mb-3">
        <select value={c.response_status} onChange={e => onStatusChange(c.id, e.target.value)}
          className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs outline-none"
          style={{ background: s.bg, color: s.text }}>
          {ALL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-3 text-xs text-[#94A3B8] mb-3">
        {c.date_contacted && <span>First contact: <span className="text-[#64748B] font-medium">{fmtDate(c.date_contacted)}</span></span>}
        {c.followup_date && (
          <span className={isOverdue ? 'text-[#B91C1C] font-semibold' : ''}>
            {isOverdue ? '⚠ Follow-up overdue: ' : 'Follow-up: '}
            <span className="font-medium">{fmtDate(c.followup_date)}</span>
          </span>
        )}
      </div>

      {/* Notes preview */}
      {c.notes && <p className="text-xs text-[#64748B] line-clamp-2 mb-3">{c.notes}</p>}

      {/* Experiment / Path / Mission */}
      {(exp || c.path_being_tested || mission) && (
        <div className="pt-3 border-t border-[#F1F5F9] flex flex-wrap gap-3">
          {exp && (
            <span className="flex items-center gap-1 text-xs text-[#64748B]">
              <Beaker size={11} />Experiment: <span className="font-semibold text-[#334155]">{exp.title}</span>
            </span>
          )}
          {(c.path_being_tested || exp?.path_name) && (
            <span className="text-xs text-[#94A3B8]">Path: {c.path_being_tested || exp?.path_name}</span>
          )}
          {mission && (
            <span className="text-xs text-[#94A3B8]">Mission: <span className="font-semibold text-[#64748B]">{mission.title}</span></span>
          )}
        </div>
      )}
    </div>
  );
}

export default function OutreachTracker() {
  const navigate = useNavigate();
  const [paths, setPaths] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState('all');
  const [contacts, setContacts] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | contact object
  const [templates, setTemplates] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterExp, setFilterExp] = useState('all');
  const [loadError, setLoadError] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const toastTimer = useRef(null);

  const load = async () => {
    setLoadError(false);
    try {
      const [c, e, m, ps] = await Promise.all([
        base44.entities.OutreachContacts.list('-updated_date', 200).catch(() => null),
        base44.entities.Experiments.list('-created_date', 200).catch(() => []),
        base44.entities.Missions.list('-created_date', 200).catch(() => []),
        base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      ]);
      if (c === null) { setLoadError(true); } else { setContacts(Array.isArray(c) ? c.filter(x => !x.deletion_status || x.deletion_status === 'active') : []); }
      setExperiments(Array.isArray(e) ? e : []);
      setMissions(Array.isArray(m) ? m : []);
      setPaths(Array.isArray(ps) ? ps : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const experimentsMap = Object.fromEntries(experiments.map(e => [e.id, e]));
  const missionsMap = Object.fromEntries(missions.map(m => [m.id, m]));

  const updateStatus = async (id, response_status) => {
    await base44.entities.OutreachContacts.update(id, { response_status });
    setContacts(prev => prev.map(c => c.id === id ? { ...c, response_status } : c));
  };

  const toggleThankYou = async (c) => {
    const thank_you_sent = !c.thank_you_sent;
    await base44.entities.OutreachContacts.update(c.id, { thank_you_sent });
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, thank_you_sent } : x));
  };

  const handleDelete = async (c) => {
    const user = await base44.auth.me();
    await base44.entities.OutreachContacts.update(c.id, softDeletePayload(user.id));
    setContacts(prev => prev.filter(x => x.id !== c.id));
  };

  const handleSaved = (saved, experimentTitle, missionTitle) => {
    setModal(null);
    load();
    setSuccessToast({ contact: saved, experimentTitle, missionTitle });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);
  };

  const selectedPath = selectedPathId === 'all' ? null : paths.find(p => p.id === selectedPathId);
  const pathExps = selectedPath ? experiments.filter(e => e.path_name === selectedPath.path_name) : experiments;

  const overdue = contacts.filter(c => c.followup_date && new Date(c.followup_date) < new Date() && !['completed','responded'].includes(c.response_status));

  // Filtered contacts
  const filtered = contacts.filter(c => {
    if (selectedPath) {
      const matchesPath = c.path_being_tested === selectedPath.path_name || pathExps.some(e => e.id === c.experiment_id);
      if (!matchesPath) return false;
    }
    if (filterStatus !== 'all' && c.response_status !== filterStatus) return false;
    if (filterExp !== 'all' && c.experiment_id !== filterExp) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const exp = c.experiment_id ? experimentsMap[c.experiment_id] : null;
      const mission = c.mission_id ? missionsMap[c.mission_id] : null;
      if (![c.name, c.company, c.role, c.email, c.phone, exp?.title, c.path_being_tested, mission?.title]
        .some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      {modal && (
        <AddContactModal
          contact={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {successToast && (
        <ContactSuccessToast
          contact={successToast.contact}
          experimentTitle={successToast.experimentTitle}
          missionTitle={successToast.missionTitle}
          onViewContact={() => setSuccessToast(null)}
          onOpenExperiment={() => { setSuccessToast(null); navigate('/experiments'); }}
          onDismiss={() => setSuccessToast(null)}
        />
      )}

      <PageHeader
        eyebrow="Outreach tracker"
        title="Networking done intentionally."
        description="Track every professional conversation. Follow up on time. Build real relationships."
        action={
          <button onClick={() => setModal('new')}
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white shrink-0"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            <Plus size={16} /> Add Contact
          </button>
        }
      />

      {paths.length > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <PathSwitcher
            paths={paths.filter(p => p.status !== 'archived')}
            selectedId={selectedPathId}
            onChange={setSelectedPathId}
            showAll
          />
          {selectedPath && <span className="text-xs text-[#94A3B8]">Contacts for <strong className="text-[#334155]">{selectedPath.path_name}</strong></span>}
        </div>
      )}

      {paths.length > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <PathSwitcher
            paths={paths.filter(p => p.status !== 'archived')}
            selectedId={selectedPathId}
            onChange={setSelectedPathId}
            showAll
          />
          {selectedPath && <span className="text-xs text-[#94A3B8]">Contacts for <strong className="text-[#334155]">{selectedPath.path_name}</strong></span>}
        </div>
      )}

      {overdue.length > 0 && (
        <div className="mb-6 rounded-[16px] p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.25)' }}>
          <p className="text-xs font-bold uppercase tracking-wide text-[#B45309] mb-1">Follow-ups overdue</p>
          <p className="text-sm text-[#334155]">{overdue.length} contact{overdue.length > 1 ? 's' : ''} need follow-up. Reschedule or mark complete.</p>
        </div>
      )}

      {/* Search + Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, email, experiment…"
            className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#8B0C21]" />
        </div>
        {experiments.length > 0 && (
          <select value={filterExp} onChange={e => setFilterExp(e.target.value)}
            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]">
            <option value="all">All experiments</option>
            {experiments.map(exp => <option key={exp.id} value={exp.id}>{exp.title}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]">
          <option value="all">All statuses</option>
          {ALL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Email Templates */}
      <div className="mb-6">
        <button onClick={() => setTemplates(!templates)} className="text-sm font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
          {templates ? 'Hide' : 'View'} outreach templates →
        </button>
        {templates && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Cold email', body: 'Hi [Name],\n\nI came across your work at [Company] and was impressed by [specific detail]. I\'m a [Year] at [School] studying [Major] and exploring a career in [field].\n\nWould you be open to a 20-minute call to share your perspective on [specific question]? I have availability [times].\n\nThank you for considering it.\n\n[Your Name]' },
              { label: 'Alumni email', body: 'Hi [Name],\n\nI\'m [Your Name], a [Year] at [Shared School] studying [Major]. I found your profile through [Alumni Network/LinkedIn] and have been following your work at [Company].\n\nWould you be willing to share 20 minutes to talk about your experience in [field]? I would especially value your perspective on [specific question].\n\nThank you — and go [School Mascot]!\n\n[Your Name]' },
              { label: 'LinkedIn message', body: 'Hi [Name] — I\'m a [Year] at [School] exploring [field]. I\'d love to hear how you got into your current role at [Company]. Would you be open to a brief 20-minute call? Happy to work around your schedule.' },
              { label: 'Follow-up', body: 'Hi [Name],\n\nI wanted to follow up on my previous note. I completely understand you\'re busy, and I appreciate your time. If a 20-minute call doesn\'t work, even a brief email with one piece of advice would be incredibly helpful.\n\nThank you again.\n\n[Your Name]' },
              { label: 'Thank-you note', body: 'Hi [Name],\n\nThank you for taking the time to speak with me. Your insight about [specific thing they said] was genuinely valuable and I\'ve already begun [action taken].\n\nI\'ll keep you updated on my progress. Thank you again for your generosity.\n\n[Your Name]' },
            ].map(t => (
              <div key={t.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#8B0C21' }}>{t.label}</p>
                <pre className="text-xs text-[#334155] whitespace-pre-wrap font-body leading-5">{t.body}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading outreach contacts…</div>
      ) : loadError ? (
        <div className="rounded-[24px] border border-dashed border-red-200 p-16 text-center">
          <h3 className="font-heading text-xl font-bold text-[#050816]">We couldn't load your outreach contacts.</h3>
          <p className="mt-2 text-sm text-[#64748B]">There was a problem fetching your records. Please try again.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white" style={{ background: '#8B0C21' }}>Retry</button>
            <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">Return to Dashboard</button>
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-16 text-center">
          <Mail size={32} className="mx-auto mb-4 text-[#CBD5E1]" />
          <h3 className="font-heading text-xl font-bold text-[#050816]">No contacts added yet.</h3>
          <p className="mt-2 text-sm text-[#64748B]">Add people connected to your experiments so you can track outreach, conversations, and follow-ups.</p>
          <button onClick={() => setModal('new')} className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
            style={{ background: '#8B0C21' }}><Plus size={16} /> Add Contact</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-12 text-center">
          <p className="font-heading text-lg font-bold text-[#050816]">No results match your filters.</p>
          <p className="mt-2 text-sm text-[#64748B]">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#94A3B8] mb-4">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(c => (
              <ContactCard
                key={c.id}
                c={c}
                experimentsMap={experimentsMap}
                missionsMap={missionsMap}
                onEdit={setModal}
                onStatusChange={updateStatus}
                onToggleThankYou={toggleThankYou}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}