import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { RotateCcw, Trash2, Clock, X, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { restorePayload } from '@/components/SoftDeleteConfirm';

const TABS = [
  { id: 'missions', label: 'Mission Guides', entity: 'Missions', nameField: 'title' },
  { id: 'contacts', label: 'Contacts', entity: 'OutreachContacts', nameField: 'name' },
  { id: 'reflections', label: 'Reflections', entity: 'WeeklyReflections', nameField: 'week_start' },
  { id: 'proof', label: 'Proof of Work', entity: 'ProofOfWork', nameField: 'title' },
];

function daysRemaining(purgeAt) {
  if (!purgeAt) return '?';
  const diff = new Date(purgeAt) - new Date();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  return days;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getItemName(item, nameField) {
  if (nameField === 'week_start') return `Week of ${fmtDate(item.week_start)}`;
  return item[nameField] || 'Untitled';
}

// ── Permanent Delete Confirm ──────────────────────────────────────────────────
function PermanentDeleteConfirm({ itemName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.6)' }}>
      <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-red-50 shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <h3 className="font-heading text-lg font-bold text-[#050816]">Permanently delete?</h3>
        </div>
        <p className="text-sm text-[#334155] mb-1">"{itemName}"</p>
        <p className="text-sm text-[#64748B] mb-5">
          This cannot be recovered. Linked experiments, paths, missions, and users will not be affected.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] transition">
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

// ── Deleted Item Card ──────────────────────────────────────────────────────────
function DeletedItemCard({ item, tab, experimentsMap, missionsMap, onRestore, onPermanentDelete }) {
  const name = getItemName(item, tab.nameField);
  const days = daysRemaining(item.purge_at);
  const urgent = days <= 3;
  const exp = item.experiment_id ? experimentsMap[item.experiment_id] : null;
  const mission = item.mission_id ? missionsMap[item.mission_id] : null;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: '#F8ECEF', color: '#8B0C21' }}>
              {tab.label.replace(/s$/, '')}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
              <Clock size={9} /> {days === 0 ? 'Expires today' : `${days} day${days !== 1 ? 's' : ''} left`}
            </span>
          </div>
          <p className="font-semibold text-sm text-[#050816] truncate">{name}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Deleted {fmtDate(item.deleted_at)}</p>

          {/* Context */}
          <div className="mt-1.5 flex flex-wrap gap-3">
            {exp ? (
              <p className="text-[10px] text-[#64748B]">Experiment: <span className="font-semibold">{exp.title}</span></p>
            ) : item.experiment_id ? (
              <p className="text-[10px] text-[#94A3B8] italic">Experiment no longer exists — can restore as unlinked</p>
            ) : null}
            {exp?.path_name && <p className="text-[10px] text-[#94A3B8]">Path: {exp.path_name}</p>}
            {mission && <p className="text-[10px] text-[#94A3B8]">Mission: {mission.title}</p>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0 mt-1">
          <button onClick={() => onRestore(item, tab)}
            className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] hover:border-green-400 hover:text-green-700 transition">
            <RotateCcw size={11} /> Restore
          </button>
          <button onClick={() => onPermanentDelete(item, tab)}
            className="flex items-center gap-1 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-400 hover:border-red-400 hover:text-red-600 transition">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RecentlyDeleted() {
  const [activeTab, setActiveTab] = useState('missions');
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState([]);
  const [missions, setMissions] = useState([]);
  const [confirmPerm, setConfirmPerm] = useState(null); // { item, tab }
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

  const handleRestore = async (item, tab) => {
    setActionLoading(item.id);
    try {
      await base44.entities[tab.entity].update(item.id, restorePayload());
      setItems(prev => ({
        ...prev,
        [tab.id]: prev[tab.id].filter(x => x.id !== item.id),
      }));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmPerm) return;
    const { item, tab } = confirmPerm;
    setActionLoading(item.id);
    setConfirmPerm(null);
    try {
      await base44.entities[tab.entity].delete(item.id);
      setItems(prev => ({
        ...prev,
        [tab.id]: prev[tab.id].filter(x => x.id !== item.id),
      }));
    } finally {
      setActionLoading(null);
    }
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

      <PageHeader
        eyebrow="Settings"
        title="Recently Deleted"
        description="Items deleted in the last 30 days. Restore them or delete them permanently."
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#E2E8F0]">
        {TABS.map(tab => {
          const count = (items[tab.id] || []).length;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${activeTab === tab.id ? 'border-[#8B0C21] text-[#8B0C21]' : 'border-transparent text-[#64748B] hover:text-[#334155]'}`}>
              {tab.label} {count > 0 && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-[#F8ECEF] text-[#8B0C21]">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading…</div>
      ) : currentItems.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] py-16 text-center">
          <p className="text-sm font-semibold text-[#050816]">No deleted {currentTab?.label.toLowerCase()} found.</p>
          <p className="text-xs text-[#94A3B8] mt-1">Items you delete will appear here for 30 days.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentItems.map(item => (
            <DeletedItemCard
              key={item.id}
              item={item}
              tab={currentTab}
              experimentsMap={experimentsMap}
              missionsMap={missionsMap}
              onRestore={(i, t) => handleRestore(i, t)}
              onPermanentDelete={(i, t) => setConfirmPerm({ item: i, tab: t })}
            />
          ))}
        </div>
      )}
    </main>
  );
}