import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Mail, CheckCircle, Clock, ExternalLink, Phone, Pencil, ChevronDown, Beaker, Trash2, Users } from 'lucide-react';
import OutreachPlanModal from '@/components/outreach/OutreachPlanModal';
import PageHeader from '@/components/PageHeader';
import { Sk, SkControls, SkCards } from '@/components/PageSkeleton';
import AddContactModal, { ContactSuccessToast } from '@/components/outreach/AddContactModal';
import PathSwitcher from '@/components/PathSwitcher';
import SoftDeleteConfirm from '@/components/SoftDeleteConfirm';
import { safeExternalUrl } from '@/lib/safe-url';
import { useOutreachContacts, useUpdateContact, useDeleteContact } from '@/hooks/useOutreachContacts';

const ALL_STATUS_OPTIONS = [
  { value: 'not_sent', label: 'Not contacted', bg: 'var(--ink-100)', text: 'var(--ink-700)' },
  { value: 'planning', label: 'Planning', bg: 'var(--info-50)', text: 'var(--info-700)' },
  { value: 'sent', label: 'Contacted', bg: 'var(--warning-50)', text: 'var(--warning-700)' },
  { value: 'follow_up_needed', label: 'Follow-up needed', bg: '#FEF3C7', text: '#D97706' },
  { value: 'call_scheduled', label: 'Meeting scheduled', bg: 'var(--ink-100)', text: 'var(--brand-navy-700)' },
  { value: 'responded', label: 'Completed', bg: 'var(--success-50)', text: 'var(--success-700)' },
  { value: 'no_response', label: 'No response', bg: 'var(--ink-100)', text: 'var(--ink-500)' },
  { value: 'completed', label: 'Closed', bg: 'var(--success-50)', text: 'var(--success-700)' },
  // Deciding not to pursue somebody is a result, not a gap, so it gets its own
  // row rather than falling through to the first option and reading as "Not
  // contacted". Missing from this list, a closed contact was invisible here,
  // could not be set, and could not be filtered for.
  { value: 'closed', label: 'Closed out', bg: 'var(--ink-100)', text: 'var(--ink-700)' },
  { value: 'other', label: 'Other', bg: 'var(--ink-100)', text: 'var(--ink-700)' },
];

/**
 * The contact is finished with, one way or another. A follow up cannot be
 * overdue on somebody the student has closed out on purpose.
 */
const SETTLED_STATUSES = ['completed', 'responded', 'closed'];

/**
 * How to draw a status. An unknown stored value keeps its own name rather than
 * borrowing the first option's, because a row silently displaying as something
 * it is not is how the closed status went unnoticed in the first place.
 */
function statusStyle(stored) {
  const known = ALL_STATUS_OPTIONS.find(x => x.value === stored);
  if (known) return known;
  return {
    value: stored || 'not_sent',
    label: String(stored || 'Not contacted').replace(/_/g, ' '),
    bg: 'var(--ink-100)',
    text: 'var(--ink-700)',
  };
}

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
  const s = statusStyle(c.response_status);
  const isOverdue = c.followup_date && new Date(c.followup_date) < new Date() && !SETTLED_STATUSES.includes(c.response_status);
  // Contact URLs are typed by the student. Bare domains still get https://,
  // but anything that isn't http(s) after that is dropped rather than linked.
  const profileHref = safeExternalUrl(c.profile_url) || safeExternalUrl('https://' + (c.profile_url || ''));
  const websiteHref = safeExternalUrl(c.website_url) || safeExternalUrl('https://' + (c.website_url || ''));

  return (
    <div className="tp-card-body rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white">
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
              <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-700)' }}>
                {CONTACT_TYPE_LABELS[c.contact_type] || c.contact_type}
              </span>
            )}
            <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold" style={{ background: s.bg, color: s.text }}>
              {s.label}
            </span>
            {c.thank_you_sent && (
              <span className="tp-meta rounded-full px-2.5 py-0.5 font-bold flex items-center gap-1.5" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}>
                <CheckCircle size={12} /> Thank-you sent
              </span>
            )}
          </div>
          <h3 className="tp-card text-[color:var(--surface-dark-900)]">{c.name}</h3>
          {(c.role || c.company) && (
            <p className="tp-body mt-1 text-[color:var(--ink-700)]">
              {c.role}{c.role && c.company ? ' · ' : ''}{c.company}
            </p>
          )}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(v => !v)} className="rounded-lg p-1.5 text-[color:var(--ink-400)] hover:text-[color:var(--ink-700)] hover:bg-[color:var(--ink-100)] transition" aria-label="More actions">
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-44 rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white shadow-lg py-1">
              <button onClick={() => { setMenuOpen(false); onEdit(c); }}
                className="tp-meta w-full flex items-center gap-2 px-4 py-2.5 text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
                <Pencil size={13} /> Edit contact
              </button>
              <button onClick={() => { setMenuOpen(false); onToggleThankYou(c); }}
                className="tp-meta w-full flex items-center gap-2 px-4 py-2.5 text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">
                <CheckCircle size={13} /> {c.thank_you_sent ? 'Unmark thank-you' : 'Mark thank-you sent'}
              </button>
              <button onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="tp-meta w-full flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50">
                <Trash2 size={13} /> Delete contact
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contact methods */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
        {c.email && (
          <a href={`mailto:${c.email}`} className="tp-meta flex items-center gap-1.5 text-[color:var(--ink-500)] hover:text-[color:var(--brand-navy-700)] transition">
            <Mail size={13} />{c.email}
          </a>
        )}
        {c.phone && (
          <a href={`tel:${c.phone}`} className="tp-meta flex items-center gap-1.5 text-[color:var(--ink-500)] hover:text-[color:var(--brand-navy-700)] transition">
            <Phone size={13} />{c.phone}
          </a>
        )}
        {profileHref && (
          <a href={profileHref} target="_blank" rel="noopener noreferrer"
            className="tp-meta flex items-center gap-1.5 text-[color:var(--ink-500)] hover:text-[color:var(--brand-navy-700)] transition">
            <ExternalLink size={13} />LinkedIn
          </a>
        )}
        {websiteHref && (
          <a href={websiteHref} target="_blank" rel="noopener noreferrer"
            className="tp-meta flex items-center gap-1.5 text-[color:var(--ink-500)] hover:text-[color:var(--brand-navy-700)] transition">
            <ExternalLink size={13} />Website
          </a>
        )}
      </div>

      {/* Status selector */}
      <div className="mb-3">
        <select value={c.response_status} onChange={e => onStatusChange(c.id, e.target.value)}
          className="rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-base md:text-[13px] outline-none"
          style={{ background: s.bg, color: s.text }}>
          {ALL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Dates */}
      <div className="tp-meta flex flex-wrap gap-x-4 gap-y-2 text-[color:var(--ink-400)] mb-3">
        {c.date_contacted && <span>First contact: <span className="text-[color:var(--ink-500)] font-medium">{fmtDate(c.date_contacted)}</span></span>}
        {c.followup_date && (
          <span className={isOverdue ? 'text-[color:var(--danger-700)] font-semibold' : ''}>
            {isOverdue ? 'Follow-up overdue: ' : 'Follow-up: '}
            <span className="font-medium">{fmtDate(c.followup_date)}</span>
          </span>
        )}
      </div>

      {/* Notes preview */}
      {c.notes && <p className="tp-prose text-[color:var(--ink-500)] line-clamp-2 mb-3">{c.notes}</p>}

      {/* Experiment / Path / Mission */}
      {(exp || c.path_being_tested || mission) && (
        <div className="pt-3 border-t border-[color:var(--ink-100)] flex flex-wrap gap-3">
          {exp && (
            <span className="tp-meta flex items-center gap-1.5 text-[color:var(--ink-500)]">
              <Beaker size={13} />Experiment: <span className="font-semibold text-[color:var(--ink-700)]">{exp.title}</span>
            </span>
          )}
          {(c.path_being_tested || exp?.path_name) && (
            <span className="tp-meta text-[color:var(--ink-400)]">Path: {c.path_being_tested || exp?.path_name}</span>
          )}
          {mission && (
            <span className="tp-meta text-[color:var(--ink-400)]">Mission: <span className="font-semibold text-[color:var(--ink-500)]">{mission.title}</span></span>
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
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | contact object
  const [templates, setTemplates] = useState(false);
  const [outreachPlanPath, setOutreachPlanPath] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterExp, setFilterExp] = useState('all');
  const [loadError, setLoadError] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const toastTimer = useRef(null);

  // Contacts live in the query cache so every change to one shows immediately;
  // the supporting lists stay plain fetches.
  const { data: contactRows, isLoading: contactsLoading, isError: contactsFailed, refetch: refetchContacts } = useOutreachContacts();
  const contacts = contactRows || [];
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const load = async () => {
    setLoadError(false);
    try {
      const [e, m, ps] = await Promise.all([
        base44.entities.Experiments.list('-created_date', 200).catch(() => []),
        base44.entities.Missions.list('-created_date', 200).catch(() => []),
        base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      ]);
      refetchContacts();
      setExperiments(Array.isArray(e) ? e : []);
      setMissions(Array.isArray(m) ? m : []);
      setPaths(Array.isArray(ps) ? ps : []);
    } catch {
      setLoadError(true);
    } finally {
      setListsLoading(false);
    }
  };

  const loading = listsLoading || contactsLoading;

  useEffect(() => { load(); }, []);

  const experimentsMap = Object.fromEntries(experiments.map(e => [e.id, e]));
  const missionsMap = Object.fromEntries(missions.map(m => [m.id, m]));

  // Each of these repaints the card before the request finishes.
  const updateStatus = (id, response_status) => updateContact.mutate({ id, patch: { response_status } });

  const toggleThankYou = (c) => updateContact.mutate({ id: c.id, patch: { thank_you_sent: !c.thank_you_sent } });

  const handleDelete = (c) => deleteContact.mutate({ id: c.id });

  const handleSaved = (saved, experimentTitle, missionTitle) => {
    setModal(null);
    load();
    setSuccessToast({ contact: saved, experimentTitle, missionTitle });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSuccessToast(null), 8000);
  };

  const selectedPath = selectedPathId === 'all' ? null : paths.find(p => p.id === selectedPathId);
  const pathExps = selectedPath ? experiments.filter(e => e.path_name === selectedPath.path_name) : experiments;

  const overdue = contacts.filter(c => c.followup_date && new Date(c.followup_date) < new Date() && !SETTLED_STATUSES.includes(c.response_status));

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
    <main className="app-page">
      {outreachPlanPath && (
        <OutreachPlanModal
          path={outreachPlanPath}
          onClose={() => setOutreachPlanPath(null)}
          onContactSaved={() => load()}
        />
      )}
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
        title="Networking done intentionally."
        description="Track every professional conversation. Follow up on time. Build real relationships."
        action={
          <button onClick={() => setModal('new')}
            className="tp-body inline-flex items-center gap-2 rounded-[var(--r-control)] px-6 py-3 font-semibold text-white shrink-0"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            <Plus size={16} /> Add Contact
          </button>
        }
      />

      {/* Everything from here down depends on the fetch, so it swaps in one
          go behind a skeleton. Gating each piece separately meant the path
          switcher, the overdue banner and the two dropdowns each appeared on
          their own beat and shoved the contact list down three times. */}
      {loading && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Sk h={38} w={230} r={12} />
            <Sk h={13} w={150} r={5} />
          </div>
          <SkControls search filters={2} />
        </>
      )}

      {!loading && paths.length > 0 && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <PathSwitcher
            paths={paths.filter(p => p.status !== 'archived')}
            selectedId={selectedPathId}
            onChange={setSelectedPathId}
            showAll
          />
          {selectedPath && <span className="tp-meta text-[color:var(--ink-400)]">Contacts for <strong className="text-[color:var(--ink-700)]">{selectedPath.path_name}</strong></span>}
          {selectedPath && (
            <button
              onClick={() => setOutreachPlanPath(selectedPath)}
              className="tp-meta flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold transition"
              style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)', border: '1px solid var(--border-light)' }}>
              <Users size={13} /> Suggested Outreach
            </button>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <div className="mb-6 rounded-[var(--r-surface)] p-4" style={{ background: 'var(--warning-50)', border: '1px solid rgba(180,83,9,0.25)' }}>
          <p className="tp-eyebrow text-[color:var(--warning-700)] mb-1.5">Follow-ups overdue</p>
          <p className="tp-body text-[color:var(--ink-700)]">{overdue.length} contact{overdue.length > 1 ? 's' : ''} need follow-up. Reschedule or mark complete.</p>
        </div>
      )}

      {/* Search + Filters */}
      {!loading && (
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-400)]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, email, experiment…"
            className="w-full rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white pl-9 pr-4 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]" />
        </div>
        {experiments.length > 0 && (
          <select value={filterExp} onChange={e => setFilterExp(e.target.value)}
            className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
            <option value="all">All experiments</option>
            {experiments.map(exp => <option key={exp.id} value={exp.id}>{exp.title}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-[var(--r-control)] border border-[color:var(--ink-200)] bg-white px-3 py-2.5 text-base md:text-sm outline-none focus:border-[color:var(--brand-navy-900)]">
          <option value="all">All statuses</option>
          {ALL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      )}

      {/* Email Templates */}
      <div className="mb-6">
        <button onClick={() => setTemplates(!templates)} className="tp-body font-semibold transition hover:opacity-80" style={{ color: 'var(--brand-navy-700)' }}>
          {templates ? 'Hide' : 'View'} outreach templates →
        </button>
        {templates && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Cold email', body: 'Hi [Name],\n\nI came across your work at [Company] and was impressed by [specific detail]. I\'m a [Year] at [School] studying [Major] and exploring a career in [field].\n\nWould you be open to a 20-minute call to share your perspective on [specific question]? I have availability [times].\n\nThank you for considering it.\n\n[Your Name]' },
              { label: 'Alumni email', body: 'Hi [Name],\n\nI\'m [Your Name], a [Year] at [Shared School] studying [Major]. I found your profile through [Alumni Network/LinkedIn] and have been following your work at [Company].\n\nWould you be willing to share 20 minutes to talk about your experience in [field]? I would especially value your perspective on [specific question].\n\nThank you, and go [School Mascot]!\n\n[Your Name]' },
              { label: 'LinkedIn message', body: 'Hi [Name], I\'m a [Year] at [School] exploring [field]. I\'d love to hear how you got into your current role at [Company]. Would you be open to a brief 20-minute call? Happy to work around your schedule.' },
              { label: 'Follow-up', body: 'Hi [Name],\n\nI wanted to follow up on my previous note. I completely understand you\'re busy, and I appreciate your time. If a 20-minute call doesn\'t work, even a brief email with one piece of advice would be incredibly helpful.\n\nThank you again.\n\n[Your Name]' },
              { label: 'Thank-you note', body: 'Hi [Name],\n\nThank you for taking the time to speak with me. Your insight about [specific thing they said] was genuinely valuable and I\'ve already begun [action taken].\n\nI\'ll keep you updated on my progress. Thank you again for your generosity.\n\n[Your Name]' },
            ].map(t => (
              <div key={t.label} className="rounded-[var(--r-surface)] border border-[color:var(--ink-200)] bg-white p-4">
                <p className="tp-eyebrow mb-2.5" style={{ color: 'var(--brand-navy-900)' }}>{t.label}</p>
                <pre className="tp-meta text-[color:var(--ink-700)] whitespace-pre-wrap font-body">{t.body}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <SkCards count={4} h={150} r={20} />
      ) : (loadError || contactsFailed) ? (
        <div className="rounded-[var(--r-surface)] border border-dashed border-red-200 p-16 text-center">
          <h3 className="tp-section text-[color:var(--surface-dark-900)]">We couldn't load your outreach contacts.</h3>
          <p className="tp-body mx-auto mt-2.5 max-w-[46ch] text-[color:var(--ink-500)]">There was a problem fetching your records. Please try again.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={load} className="tp-body inline-flex items-center gap-2 rounded-[var(--r-control)] px-5 py-2.5 font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Retry</button>
            <button onClick={() => navigate('/journey')} className="tp-body inline-flex items-center gap-2 rounded-[var(--r-control)] border border-[color:var(--ink-200)] px-5 py-2.5 font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)]">Return to Dashboard</button>
          </div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] p-16 text-center">
          <Mail size={32} className="mx-auto mb-4 text-[color:var(--ink-300)]" />
          <h3 className="tp-section text-[color:var(--surface-dark-900)]">No contacts added yet.</h3>
          <p className="tp-body mx-auto mt-2.5 max-w-[52ch] text-[color:var(--ink-500)]">Add people connected to your experiments so you can track outreach, conversations, and follow-ups.</p>
          <button onClick={() => setModal('new')} className="tp-body mt-6 inline-flex items-center gap-2 rounded-[var(--r-control)] px-6 py-3 font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}><Plus size={16} /> Add Contact</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--r-surface)] border border-dashed border-[color:var(--ink-200)] p-12 text-center">
          <p className="tp-section text-[color:var(--surface-dark-900)]">No results match your filters.</p>
          <p className="tp-body mt-2.5 text-[color:var(--ink-500)]">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          <p className="tp-meta mb-4 text-[color:var(--ink-400)]">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</p>
          <div className="grid gap-5 sm:grid-cols-2">
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