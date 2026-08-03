import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { RotateCcw, Trash2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { restorePayload } from '@/components/SoftDeleteConfirm';
import ExperimentPermanentDeleteModal from '@/components/experiments/ExperimentPermanentDeleteModal';

const TABS = [
  { id: 'experiments', label: 'Experiments', entity: 'Experiments', nameField: 'title' },
  { id: 'missions', label: 'Mission Guides', entity: 'Missions', nameField: 'title' },
  { id: 'contacts', label: 'Contacts', entity: 'OutreachContacts', nameField: 'name' },
  { id: 'reflections', label: 'Reflections', entity: 'WeeklyReflections', nameField: 'week_start' },
  { id: 'proof', label: 'Proof of Work', entity: 'ProofOfWork', nameField: 'title' },
];

const STATUS_LABELS = {
  planned: 'Planned', in_progress: 'In Progress', completed: 'Completed',
  skipped: 'Skipped', paused: 'Paused', draft: 'Draft',
};

function daysRemaining(purgeAt) {
  if (!purgeAt) return '?';
  const diff = new Date(purgeAt) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getItemName(item, nameField) {
  if (nameField === 'week_start') return `Week of ${fmtDate(item.week_start)}`;
  return item[nameField] || 'Untitled';
}

// ── Standard Permanent Delete Confirm (non-experiment) ────────────────────────
function PermanentDeleteConfirm({ itemName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-red-50 shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <h3 className="font-heading text-lg font-bold text-[color:var(--surface-dark-900)]">Permanently delete?</h3>
        </div>
        <p className="text-sm text-[color:var(--ink-700)] mb-1">"{itemName}"</p>
        <p className="text-sm text-[color:var(--ink-500)] mb-5">This cannot be recovered.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-2.5 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition">
            Permanently Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Experiment counts loader + card ──────────────────────────────────────────
function ExperimentDeletedCard({ exp, onRestore, onPermanentDelete, actionLoading }) {
  const [counts, setCounts] = useState(null);
  const days = daysRemaining(exp.purge_at);
  const urgent = days <= 3;
  const statusLabel = STATUS_LABELS[exp.status_before_deletion || exp.status] || 'Unknown';

  useEffect(() => {
    Promise.all([
      base44.entities.Missions.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
      base44.entities.ProofOfWork.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
      base44.entities.OutreachContacts.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
      base44.entities.WeeklyReflections.filter({ experiment_id: exp.id }, '-created_date', 500).catch(() => []),
    ]).then(([missions, proof, contacts, reflections]) => {
      setCounts({ missions: missions.length, proof: proof.length, contacts: contacts.length, reflections: reflections.length });
    });
  }, [exp.id]);

  return (
    <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>Experiment</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
              <Clock size={9} /> {days === 0 ? 'Expires today' : `${days} day${days !== 1 ? 's' : ''} left`}
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-[color:var(--ink-100)] text-[color:var(--ink-700)]">{statusLabel} before deletion</span>
          </div>
          <p className="font-semibold text-sm text-[color:var(--surface-dark-900)] truncate">{exp.title}</p>
          {exp.path_name && <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--brand-navy-700)' }}>Path: {exp.path_name}</p>}
          {exp.objective && <p className="text-[10px] text-[color:var(--ink-500)] mt-0.5 line-clamp-1">{exp.objective}</p>}
          <p className="text-[10px] text-[color:var(--ink-400)] mt-0.5">Deleted {fmtDate(exp.deleted_at)}</p>

          {/* Linked counts */}
          {counts === null ? (
            <p className="text-[10px] text-[color:var(--ink-400)] mt-2 flex items-center gap-1"><Loader2 size={9} className="animate-spin" /> Loading linked records…</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-3">
              {[
                { label: 'Mission', count: counts.missions },
                { label: 'Proof', count: counts.proof },
                { label: 'Contact', count: counts.contacts },
                { label: 'Reflection', count: counts.reflections },
              ].map(({ label, count }) => (
                <span key={label} className="text-[10px] text-[color:var(--ink-500)]">
                  {count} {label}{count !== 1 ? 's' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 shrink-0 mt-1">
          <button
            onClick={() => onRestore(exp)}
            disabled={actionLoading === exp.id}
            className="flex items-center gap-1 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:border-green-400 hover:text-green-700 transition disabled:opacity-50"
          >
            {actionLoading === exp.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Restore
          </button>
          <button
            onClick={() => onPermanentDelete(exp)}
            disabled={actionLoading === exp.id}
            className="flex items-center gap-1 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-400 hover:border-red-400 hover:text-red-600 transition disabled:opacity-50"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Standard deleted item card (non-experiment) ───────────────────────────────
function DeletedItemCard({ item, tab, experimentsMap, missionsMap, onRestore, onPermanentDelete, actionLoading }) {
  const name = getItemName(item, tab.nameField);
  const days = daysRemaining(item.purge_at);
  const urgent = days <= 3;
  const exp = item.experiment_id ? experimentsMap[item.experiment_id] : null;
  const mission = item.mission_id ? missionsMap[item.mission_id] : null;

  return (
    <div className="rounded-[16px] border border-[color:var(--ink-200)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--ink-100)', color: 'var(--brand-navy-900)' }}>
              {tab.label.replace(/s$/, '')}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
              <Clock size={9} /> {days === 0 ? 'Expires today' : `${days} day${days !== 1 ? 's' : ''} left`}
            </span>
          </div>
          <p className="font-semibold text-sm text-[color:var(--surface-dark-900)] truncate">{name}</p>
          <p className="text-[10px] text-[color:var(--ink-400)] mt-0.5">Deleted {fmtDate(item.deleted_at)}</p>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {exp ? (
              <p className="text-[10px] text-[color:var(--ink-500)]">Experiment: <span className="font-semibold">{exp.title}</span></p>
            ) : item.experiment_id ? (
              <p className="text-[10px] text-[color:var(--ink-400)] italic">Experiment no longer exists — can restore as unlinked</p>
            ) : null}
            {exp?.path_name && <p className="text-[10px] text-[color:var(--ink-400)]">Path: {exp.path_name}</p>}
            {mission && <p className="text-[10px] text-[color:var(--ink-400)]">Mission: {mission.title}</p>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 mt-1">
          <button onClick={() => onRestore(item, tab)}
            disabled={actionLoading === item.id}
            className="flex items-center gap-1 rounded-lg border border-[color:var(--ink-200)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-700)] hover:border-green-400 hover:text-green-700 transition disabled:opacity-50">
            {actionLoading === item.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Restore
          </button>
          <button onClick={() => onPermanentDelete(item, tab)}
            disabled={actionLoading === item.id}
            className="flex items-center gap-1 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-400 hover:border-red-400 hover:text-red-600 transition disabled:opacity-50">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RecentlyDeleted() {
  const [activeTab, setActiveTab] = useState('experiments');
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [confirmPerm, setConfirmPerm] = useState(null); // { item, tab } — for non-experiment tabs
  const [permExpTarget, setPermExpTarget] = useState(null); // experiment for custom modal
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [exps, mis] = await Promise.all([
        base44.entities.Experiments.list('-created_date', 200).catch(() => []),
        base44.entities.Missions.list('-created_date', 200).catch(() => []),
      ]);
      setExperiments(Array.isArray(exps) ? exps : []);
      setMissions(Array.isArray(mis) ? mis : []);

      const results = {};
      await Promise.all(TABS.map(async (tab) => {
        const data = await base44.entities[tab.entity].filter(
          { deletion_status: 'deleted' }, '-deleted_at', 200
        ).catch(() => []);
        results[tab.id] = Array.isArray(data) ? data : [];
      }));
      setItems(results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const experimentsMap = Object.fromEntries(experiments.map(e => [e.id, e]));
  const missionsMap = Object.fromEntries(missions.map(m => [m.id, m]));

  // Restore a non-experiment item
  const handleRestore = async (item, tab) => {
    setActionLoading(item.id);
    try {
      await base44.entities[tab.entity].update(item.id, restorePayload());
      setItems(prev => ({ ...prev, [tab.id]: prev[tab.id].filter(x => x.id !== item.id) }));
    } finally {
      setActionLoading(null);
    }
  };

  // Restore an experiment — return to prior status
  const handleRestoreExperiment = async (exp) => {
    setActionLoading(exp.id);
    try {
      const priorStatus = exp.status_before_deletion || exp.status || 'planned';
      await base44.entities.Experiments.update(exp.id, {
        ...restorePayload(),
        status: priorStatus,
      });
      setItems(prev => ({ ...prev, experiments: prev.experiments.filter(x => x.id !== exp.id) }));
    } finally {
      setActionLoading(null);
    }
  };

  // Permanent delete non-experiment
  const handlePermanentDelete = async () => {
    if (!confirmPerm) return;
    const { item, tab } = confirmPerm;
    setActionLoading(item.id);
    setConfirmPerm(null);
    try {
      await base44.entities[tab.entity].delete(item.id);
      setItems(prev => ({ ...prev, [tab.id]: prev[tab.id].filter(x => x.id !== item.id) }));
    } finally {
      setActionLoading(null);
    }
  };

  // Called by ExperimentPermanentDeleteModal after it handles deletion
  const handleExperimentPermDeleted = (expId) => {
    setPermExpTarget(null);
    setItems(prev => ({ ...prev, experiments: prev.experiments.filter(x => x.id !== expId) }));
  };

  const currentTab = TABS.find(t => t.id === activeTab);
  const currentItems = items[activeTab] || [];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      {confirmPerm && (
        <PermanentDeleteConfirm
          itemName={getItemName(confirmPerm.item, confirmPerm.tab.nameField)}
          onConfirm={handlePermanentDelete}
          onCancel={() => setConfirmPerm(null)}
        />
      )}
      {permExpTarget && (
        <ExperimentPermanentDeleteModal
          exp={permExpTarget}
          onDeleted={handleExperimentPermDeleted}
          onCancel={() => setPermExpTarget(null)}
        />
      )}

      <PageHeader
        title="Recently Deleted"
        description="Items deleted in the last 30 days. Restore them or delete them permanently."
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[color:var(--ink-200)] overflow-x-auto">
        {TABS.map(tab => {
          const count = (items[tab.id] || []).length;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${activeTab === tab.id ? 'border-[color:var(--brand-navy-900)] text-[color:var(--brand-navy-900)]' : 'border-transparent text-[color:var(--ink-500)] hover:text-[color:var(--ink-700)]'}`}>
              {tab.label} {count > 0 && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-[color:var(--ink-100)] text-[color:var(--brand-navy-900)]">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[color:var(--ink-500)]">Loading…</div>
      ) : currentItems.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[color:var(--ink-200)] py-16 text-center">
          <p className="text-sm font-semibold text-[color:var(--surface-dark-900)]">No deleted {currentTab?.label.toLowerCase()} found.</p>
          <p className="text-xs text-[color:var(--ink-400)] mt-1">Items you delete will appear here for 30 days.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === 'experiments' ? (
            currentItems.map(exp => (
              <ExperimentDeletedCard
                key={exp.id}
                exp={exp}
                actionLoading={actionLoading}
                onRestore={handleRestoreExperiment}
                onPermanentDelete={setPermExpTarget}
              />
            ))
          ) : (
            currentItems.map(item => (
              <DeletedItemCard
                key={item.id}
                item={item}
                tab={currentTab}
                experimentsMap={experimentsMap}
                missionsMap={missionsMap}
                actionLoading={actionLoading}
                onRestore={handleRestore}
                onPermanentDelete={(i, t) => setConfirmPerm({ item: i, tab: t })}
              />
            ))
          )}
        </div>
      )}
    </main>
  );
}