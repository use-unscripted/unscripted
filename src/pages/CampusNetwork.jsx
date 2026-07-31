import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Users, Search, Settings2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NetworkProfileCard from '@/components/network/NetworkProfileCard';
import FeedCard from '@/components/network/FeedCard';
import NetworkProfileSetup from '@/components/network/NetworkProfileSetup';

const TABS = ['feed', 'discover'];
const TAB_LABELS = { feed: 'Campus Feed', discover: 'Discover' };

export default function CampusNetwork() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'feed');
  const [currentUser, setCurrentUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Data
  const [feed, setFeed] = useState([]);
  const [feedFilter, setFeedFilter] = useState('university');
  const [discoverProfiles, setDiscoverProfiles] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // Discover filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMajor, setFilterMajor] = useState('');
  const [filterUniversity, setFilterUniversity] = useState('');

  // Profile editor
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  useEffect(() => { initUser(); }, []);

  useEffect(() => {
    const t = searchParams.get('tab') || 'feed';
    setTab(t);
  }, [searchParams]);

  const switchTab = (t) => {
    setSearchParams({ tab: t });
    setTab(t);
  };

  const initUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      await loadMyProfile(user);
    } catch (e) {
      console.error('Failed to load user', e);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadMyProfile = async (user) => {
    const profiles = await base44.entities.NetworkProfile.filter({ user_id: user.id }).catch(() => []);
    setMyProfile(profiles[0] || null);
    return profiles[0] || null;
  };

  // Load tab data
  useEffect(() => {
    if (!currentUser || !myProfile) return;
    if (tab === 'feed') loadFeed();
    if (tab === 'discover') loadDiscover();
  }, [tab, currentUser, myProfile, feedFilter]);

  const loadFeed = async () => {
    if (!currentUser || !myProfile) return;
    setFeedLoading(true);
    try {
      const uniName = myProfile.university_name;
      if (!uniName) { setFeed([]); setFeedLoading(false); return; }

      const [allProof, allPaths] = await Promise.all([
        base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []),
        base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []),
      ]);

      const proofItems = allProof.filter(p =>
        p.created_by_id !== currentUser.id &&
        ['my_university', 'all_unscripted'].includes(p.network_visibility) &&
        p.deletion_status !== 'deleted' && p.deletion_status !== 'permanently_deleted'
      ).map(p => ({ ...p, feed_type: 'proof' }));

      const pathItems = allPaths.filter(p =>
        p.created_by_id !== currentUser.id &&
        ['my_university', 'all_unscripted'].includes(p.network_visibility)
      ).map(p => ({ ...p, feed_type: 'path' }));

      const merged = [...proofItems, ...pathItems].sort((a, b) =>
        new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
      ).slice(0, 50);

      const allProfiles = await base44.entities.NetworkProfile.list('-created_date', 200).catch(() => []);
      const profileMap = {};
      allProfiles.forEach(p => { profileMap[p.user_id] = p; });

      setFeed(merged.map(item => ({ ...item, profile: profileMap[item.created_by_id] || null })).filter(item => item.profile));
    } catch (e) {
      console.error('Failed to load feed', e);
    } finally {
      setFeedLoading(false);
    }
  };

  const loadDiscover = async () => {
    if (!currentUser) return;
    setDiscoverLoading(true);
    try {
      const all = await base44.entities.NetworkProfile.filter({ discoverable: true, active: true }).catch(() => []);
      setDiscoverProfiles(all.filter(p =>
        p.user_id !== currentUser.id &&
        ['my_university', 'all_unscripted'].includes(p.profile_visibility)
      ));
    } catch (e) {
      console.error('Failed to load discover', e);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const filteredDiscover = discoverProfiles.filter(p => {
    if (searchQuery && !p.display_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterUniversity && !p.university_name?.toLowerCase().includes(filterUniversity.toLowerCase())) return false;
    if (filterMajor && !p.major?.toLowerCase().includes(filterMajor.toLowerCase())) return false;
    return true;
  });

  const myUniversityName = myProfile?.university_name || '';

  if (profileLoading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1F3A5F] rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      {/* Header */}
      <div className="mb-7 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Campus Network</h1>
        </div>
        <button onClick={() => setShowProfileEditor(o => !o)}
          className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold transition hover:opacity-80"
          style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
          <Settings2 size={13} /> {myProfile ? 'Edit Profile' : 'Set Up Profile'}
        </button>
      </div>

      {/* Profile editor */}
      {showProfileEditor && (
        <div className="mb-6">
          <NetworkProfileSetup
            currentUser={currentUser}
            profile={myProfile}
            onSaved={async () => {
              await loadMyProfile(currentUser);
              setShowProfileEditor(false);
            }}
          />
        </div>
      )}

      {/* No profile prompt */}
      {!myProfile && !showProfileEditor && (
        <div className="mb-6 rounded-[20px] border-2 border-dashed p-8 text-center" style={{ borderColor: 'var(--border-light)' }}>
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h2 className="font-heading font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Set up your campus profile</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Create a network profile to discover students and share your work.</p>
          <button onClick={() => setShowProfileEditor(true)}
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            <Settings2 size={14} /> Set Up Profile
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition"
              style={tab === t
                ? { background: 'var(--brand-navy-900)', color: 'white' }
                : { background: 'var(--background-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
              }>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── FEED TAB ── */}
      {tab === 'feed' && (
        <div>
          {!myProfile ? (
            <EmptyState icon={<Users size={28} />} title="Set up your profile first" desc="Create your campus profile to see the feed." />
          ) : feedLoading ? (
            <LoadingCards count={3} />
          ) : feed.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title="No campus activity yet"
              desc="No one at your university has shared public work yet. Be the first!"
              action={<Link to="/proof" className="mt-3 inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Add proof of work</Link>}
            />
          ) : (
            <div className="space-y-4">
              {feed.map(item => (
                <FeedCard key={`${item.feed_type}-${item.id}`}
                  item={item}
                  currentUserId={currentUser?.id}
                  isFollowing={false}
                  onFollowChange={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DISCOVER TAB ── */}
      {tab === 'discover' && (
        <div>
          {!myProfile ? (
            <EmptyState icon={<Search size={28} />} title="Set up your profile first" desc="Create your campus profile to start discovering." />
          ) : (
            <>
              {/* University quick-filter pills */}
              {myUniversityName && (
                <div className="mb-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Show:</span>
                  <button
                    onClick={() => setFilterUniversity(filterUniversity === myUniversityName ? '' : myUniversityName)}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition border"
                    style={filterUniversity === myUniversityName
                      ? { background: 'var(--brand-navy-900)', color: 'white', borderColor: 'var(--brand-navy-900)' }
                      : { background: 'white', color: 'var(--text-secondary)', borderColor: 'var(--border-light)' }}>
                    My University ({myUniversityName})
                  </button>
                  <button
                    onClick={() => setFilterUniversity('')}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition border"
                    style={filterUniversity === ''
                      ? { background: 'var(--brand-navy-900)', color: 'white', borderColor: 'var(--brand-navy-900)' }
                      : { background: 'white', color: 'var(--text-secondary)', borderColor: 'var(--border-light)' }}>
                    All Universities
                  </button>
                </div>
              )}

              {/* Search + filters */}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name…"
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#274C77]"
                    aria-label="Search students by name" />
                </div>
                <input type="text" value={filterUniversity} onChange={e => setFilterUniversity(e.target.value)}
                  placeholder="Search by university"
                  className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#274C77] w-full sm:w-44" />
                <input type="text" value={filterMajor} onChange={e => setFilterMajor(e.target.value)}
                  placeholder="Filter by major"
                  className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#274C77] w-full sm:w-32" />
              </div>

              {discoverLoading ? <LoadingCards count={4} /> : filteredDiscover.length === 0 ? (
                <EmptyState icon={<Users size={28} />}
                  title={filterUniversity ? `No students found at "${filterUniversity}"` : 'No students found'}
                  desc={filterUniversity
                    ? 'No discoverable students from that university yet.'
                    : 'No discoverable students match your search. Try a different name or university.'}
                  action={filterUniversity && (
                    <button onClick={() => setFilterUniversity('')}
                      className="mt-3 inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold border"
                      style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                      Clear filter
                    </button>
                  )}
                />
              ) : (
                <>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    {filteredDiscover.length} student{filteredDiscover.length !== 1 ? 's' : ''} found
                    {filterUniversity ? ` at ${filterUniversity}` : ''}
                  </p>
                  <div className="space-y-3">
                    {filteredDiscover.map(p => (
                      <NetworkProfileCard key={p.id} profile={p} currentUserId={currentUser?.id}
                        isFollowing={false} onFollowChange={() => {}} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}

function EmptyState({ icon, title, desc, action }) {
  return (
    <div className="rounded-[24px] border-2 border-dashed py-16 px-8 text-center" style={{ borderColor: 'var(--border-light)' }}>
      <div className="mx-auto mb-4 w-12 h-12 flex items-center justify-center rounded-full"
        style={{ background: 'var(--background-tertiary)', color: 'var(--text-muted)' }}>{icon}</div>
      <h3 className="font-heading font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
      {action}
    </div>
  );
}

function LoadingCards({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 rounded-[18px] skeleton" />
      ))}
    </div>
  );
}