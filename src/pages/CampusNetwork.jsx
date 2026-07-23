import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Users, Search, UserPlus, Bell, Settings2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NetworkProfileCard from '@/components/network/NetworkProfileCard';
import FeedCard from '@/components/network/FeedCard';
import InvitePanel from '@/components/network/InvitePanel';
import NetworkProfileSetup from '@/components/network/NetworkProfileSetup';
import { canViewRecord } from '@/lib/network-utils';

const TABS = ['feed', 'discover', 'following', 'followers', 'invites'];
const TAB_LABELS = { feed: 'Campus Feed', discover: 'Discover', following: 'Following', followers: 'Followers', invites: 'Invites' };

export default function CampusNetwork() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'feed');
  const [currentUser, setCurrentUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Data
  const [feed, setFeed] = useState([]);
  const [feedFilter, setFeedFilter] = useState('university'); // 'following' | 'university'
  const [discoverProfiles, setDiscoverProfiles] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [follows, setFollows] = useState([]); // current user's active follows
  const [blockedIds, setBlockedIds] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  // Discover search/filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMajor, setFilterMajor] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterPath, setFilterPath] = useState('');

  // Profile editor
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    initUser();
  }, []);

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
      await Promise.all([loadMyProfile(user), loadFollows(user), loadBlockedIds(user), loadNotifications(user)]);
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

  const loadFollows = async (user) => {
    const f = await base44.entities.Follow.filter({ follower_user_id: user.id, active: true }).catch(() => []);
    setFollows(Array.isArray(f) ? f : []);
    return f;
  };

  const loadBlockedIds = async (user) => {
    const blocks = await base44.entities.BlockedUser.filter({ blocker_user_id: user.id }).catch(() => []);
    const ids = new Set((blocks || []).map(b => b.blocked_user_id));
    // Also blocked-by
    const blockedBy = await base44.entities.BlockedUser.filter({ blocked_user_id: user.id }).catch(() => []);
    (blockedBy || []).forEach(b => ids.add(b.blocker_user_id));
    setBlockedIds(ids);
    return ids;
  };

  const loadNotifications = async (user) => {
    const notifs = await base44.entities.NetworkNotification.filter({
      recipient_user_id: user.id, dismissed: false,
    }).catch(() => []);
    setNotifications(Array.isArray(notifs) ? notifs : []);
    setUnreadCount((notifs || []).filter(n => !n.read).length);
  };

  const refreshAll = useCallback(async () => {
    if (!currentUser) return;
    await Promise.all([loadFollows(currentUser), loadMyProfile(currentUser)]);
  }, [currentUser]);

  // Load tab data
  useEffect(() => {
    if (!currentUser || !myProfile) return;
    if (tab === 'feed') loadFeed();
    if (tab === 'discover') loadDiscover();
    if (tab === 'following') loadFollowingList();
    if (tab === 'followers') loadFollowersList();
  }, [tab, currentUser, myProfile, feedFilter]);

  const loadFeed = async () => {
    if (!currentUser || !myProfile) return;
    setFeedLoading(true);
    try {
      let proofItems = [];
      let pathItems = [];

      if (feedFilter === 'following') {
        const followedIds = follows.map(f => f.followed_user_id).filter(id => !blockedIds.has(id));
        if (!followedIds.length) { setFeed([]); setFeedLoading(false); return; }
        // Get proof shared with followers or university from followed users
        const allProof = await base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []);
        proofItems = allProof.filter(p =>
          followedIds.includes(p.created_by_id) &&
          ['followers', 'my_university', 'all_unscripted'].includes(p.network_visibility) &&
          p.deletion_status !== 'deleted' && p.deletion_status !== 'permanently_deleted'
        ).map(p => ({ ...p, feed_type: 'proof' }));

        const allPaths = await base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []);
        pathItems = allPaths.filter(p =>
          followedIds.includes(p.created_by_id) &&
          ['followers', 'my_university', 'all_unscripted'].includes(p.network_visibility)
        ).map(p => ({ ...p, feed_type: 'path' }));
      } else {
        // My university feed
        const uniName = myProfile.university_name;
        if (!uniName) { setFeed([]); setFeedLoading(false); return; }
        const allProof = await base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []);
        proofItems = allProof.filter(p =>
          p.created_by_id !== currentUser.id &&
          !blockedIds.has(p.created_by_id) &&
          ['my_university', 'all_unscripted'].includes(p.network_visibility) &&
          p.deletion_status !== 'deleted' && p.deletion_status !== 'permanently_deleted'
        ).map(p => ({ ...p, feed_type: 'proof' }));

        const allPaths = await base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []);
        pathItems = allPaths.filter(p =>
          p.created_by_id !== currentUser.id &&
          !blockedIds.has(p.created_by_id) &&
          ['my_university', 'all_unscripted'].includes(p.network_visibility)
        ).map(p => ({ ...p, feed_type: 'path' }));
      }

      // Merge and sort
      const merged = [...proofItems, ...pathItems].sort((a, b) =>
        new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date)
      ).slice(0, 50);

      // Attach profiles
      const ownerIds = [...new Set(merged.map(item => item.created_by_id))];
      const allProfiles = await base44.entities.NetworkProfile.list('-created_date', 200).catch(() => []);
      const profileMap = {};
      allProfiles.forEach(p => { profileMap[p.user_id] = p; });

      const withProfiles = merged.map(item => ({
        ...item,
        profile: profileMap[item.created_by_id] || null,
      })).filter(item => item.profile);

      setFeed(withProfiles);
    } catch (e) {
      console.error('Failed to load feed', e);
    } finally {
      setFeedLoading(false);
    }
  };

  const loadDiscover = async () => {
    if (!currentUser || !myProfile?.university_name) return;
    setDiscoverLoading(true);
    try {
      const uniName = myProfile.university_name;
      const all = await base44.entities.NetworkProfile.filter({
        discoverable: true,
        active: true,
      }).catch(() => []);
      const filtered = all.filter(p =>
        p.user_id !== currentUser.id &&
        !blockedIds.has(p.user_id) &&
        p.university_name?.toLowerCase() === uniName?.toLowerCase() &&
        ['my_university', 'all_unscripted'].includes(p.profile_visibility)
      );
      setDiscoverProfiles(filtered);
    } catch (e) {
      console.error('Failed to load discover', e);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const loadFollowingList = async () => {
    if (!currentUser) return;
    setListLoading(true);
    try {
      const activeFollows = await base44.entities.Follow.filter({ follower_user_id: currentUser.id, active: true }).catch(() => []);
      const followedIds = (activeFollows || []).map(f => f.followed_user_id).filter(id => !blockedIds.has(id));
      if (!followedIds.length) { setFollowingList([]); setListLoading(false); return; }
      const profiles = await base44.entities.NetworkProfile.list('-created_date', 200).catch(() => []);
      setFollowingList(profiles.filter(p => followedIds.includes(p.user_id)));
    } catch (e) {
      console.error('Failed to load following list', e);
    } finally {
      setListLoading(false);
    }
  };

  const loadFollowersList = async () => {
    if (!currentUser) return;
    setListLoading(true);
    try {
      const inbound = await base44.entities.Follow.filter({ followed_user_id: currentUser.id, active: true }).catch(() => []);
      const followerIds = (inbound || []).map(f => f.follower_user_id).filter(id => !blockedIds.has(id));
      if (!followerIds.length) { setFollowersList([]); setListLoading(false); return; }
      const profiles = await base44.entities.NetworkProfile.list('-created_date', 200).catch(() => []);
      setFollowersList(profiles.filter(p => followerIds.includes(p.user_id)));
    } catch (e) {
      console.error('Failed to load followers list', e);
    } finally {
      setListLoading(false);
    }
  };

  const isFollowing = (userId) => follows.some(f => f.followed_user_id === userId && f.active);

  const dismissNotif = async (notifId) => {
    try {
      await base44.entities.NetworkNotification.update(notifId, { dismissed: true, read: true });
      setNotifications(n => n.filter(x => x.id !== notifId));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (_) {}
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => base44.entities.NetworkNotification.update(n.id, { read: true }).catch(() => {})));
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Filtered discover results
  const filteredDiscover = discoverProfiles.filter(p => {
    if (searchQuery && !p.display_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterMajor && !p.major?.toLowerCase().includes(filterMajor.toLowerCase())) return false;
    if (filterYear && p.academic_year !== filterYear) return false;
    if (filterPath && !p.public_path_categories?.some(c => c.toLowerCase().includes(filterPath.toLowerCase()))) return false;
    return true;
  });

  const needsProfile = !myProfile;
  const notVerified = myProfile && myProfile.verification_status !== 'verified';

  // Loading
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
          <p className="mb-1 text-xs font-bold uppercase tracking-[.14em]" style={{ color: 'var(--brand-navy-700)' }}>Network</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Campus Network</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications bell */}
          <button
            onClick={() => { /* scroll to notifs or show panel */ markAllRead(); }}
            className="relative flex items-center justify-center w-9 h-9 rounded-full border transition hover:bg-[#F8FAFC]"
            style={{ border: '1px solid var(--border-light)' }}
            aria-label="Notifications"
          >
            <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ background: 'var(--brand-navy-900)' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          <button onClick={() => setShowProfileEditor(o => !o)}
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold transition hover:opacity-80"
            style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
            <Settings2 size={13} /> {myProfile ? 'Edit Profile' : 'Set Up Profile'}
          </button>
          <Link to="/network/invite"
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            <UserPlus size={13} /> Invite Friends
          </Link>
        </div>
      </div>

      {/* Notifications strip */}
      {notifications.filter(n => !n.dismissed).length > 0 && (
        <div className="mb-5 rounded-[16px] border p-4 space-y-2" style={{ border: '1px solid var(--border-light)', background: 'var(--background-secondary)' }}>
          {notifications.filter(n => !n.dismissed).slice(0, 3).map(n => (
            <div key={n.id} className="flex items-center justify-between gap-3">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {n.type === 'new_follower' && '🎉 Someone started following you.'}
                {n.type === 'invite_accepted' && '🎉 Your invite was accepted.'}
                {n.type === 'follow_back_suggestion' && '👋 Follow back someone who follows you.'}
              </p>
              <button onClick={() => dismissNotif(n.id)} className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Dismiss</button>
            </div>
          ))}
        </div>
      )}

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
      {needsProfile && !showProfileEditor && (
        <div className="mb-6 rounded-[20px] border-2 border-dashed p-8 text-center"
          style={{ borderColor: 'var(--border-light)' }}>
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h2 className="font-heading font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Set up your campus profile</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Create a network profile to discover students at your university and share your work.</p>
          <button onClick={() => setShowProfileEditor(true)}
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--brand-navy-900)' }}>
            <Settings2 size={14} /> Set Up Profile
          </button>
        </div>
      )}

      {/* Unverified warning */}
      {myProfile && notVerified && (
        <div className="mb-5 rounded-[14px] p-4 text-sm"
          style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.2)', color: '#92400E' }}>
          <span className="font-bold">University not verified.</span> You can use Unscripted normally, but campus-network features require university verification. Contact support or check your university email.
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition whitespace-nowrap"
              style={tab === t
                ? { background: 'var(--brand-navy-900)', color: 'white' }
                : { background: 'var(--background-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
              }>
              {TAB_LABELS[t]}
              {t === 'following' && follows.length > 0 && <span className="ml-1.5 text-xs opacity-70">({follows.length})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── FEED TAB ── */}
      {tab === 'feed' && (
        <div>
          {/* Feed filter */}
          <div className="flex gap-2 mb-5">
            {[['following', 'Following'], ['university', 'My University']].map(([val, label]) => (
              <button key={val} onClick={() => setFeedFilter(val)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                style={feedFilter === val
                  ? { background: 'var(--brand-navy-900)', color: 'white' }
                  : { background: 'var(--background-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
                }>
                {label}
              </button>
            ))}
          </div>

          {!myProfile ? (
            <EmptyState icon={<Users size={28} />} title="Set up your profile first" desc="Create your campus profile to see the feed." />
          ) : feedLoading ? (
            <LoadingCards count={3} />
          ) : feed.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title={feedFilter === 'following' ? 'Nothing from your follows yet' : 'No campus activity yet'}
              desc={feedFilter === 'following'
                ? 'Follow students at your university to see the paths they are testing and the proof they are building.'
                : 'No one at your university has shared public work yet. Be the first!'}
              action={<button onClick={() => switchTab('discover')} className="mt-3 inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Discover students</button>}
            />
          ) : (
            <div className="space-y-4">
              {feed.map(item => (
                <FeedCard key={`${item.feed_type}-${item.id}`}
                  item={item}
                  currentUserId={currentUser?.id}
                  isFollowing={isFollowing(item.profile?.user_id)}
                  onFollowChange={refreshAll}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DISCOVER TAB ── */}
      {tab === 'discover' && (
        <div>
          {!myProfile || notVerified ? (
            <EmptyState icon={<Search size={28} />} title={notVerified ? 'Verification required' : 'Set up your profile first'}
              desc={notVerified ? 'University verification is needed to discover students.' : 'Create your campus profile to start discovering.'} />
          ) : (
            <>
              {/* Search */}
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by display name…"
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#274C77]"
                    aria-label="Search students by name" />
                </div>
                <input type="text" value={filterMajor} onChange={e => setFilterMajor(e.target.value)}
                  placeholder="Filter by major" aria-label="Filter by major"
                  className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#274C77] w-full sm:w-36" />
                <input type="text" value={filterPath} onChange={e => setFilterPath(e.target.value)}
                  placeholder="Filter by path interest" aria-label="Filter by path interest"
                  className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#274C77] w-full sm:w-36" />
              </div>

              {discoverLoading ? <LoadingCards count={4} /> : filteredDiscover.length === 0 ? (
                <EmptyState icon={<Users size={28} />} title="No students found"
                  desc="No discoverable students at your university yet — or your filters returned no results. Try adjusting the search."
                  action={<button onClick={() => switchTab('invites')} className="mt-3 inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Invite friends</button>}
                />
              ) : (
                <div className="space-y-3">
                  {filteredDiscover.map(p => (
                    <NetworkProfileCard key={p.id} profile={p} currentUserId={currentUser?.id}
                      isFollowing={isFollowing(p.user_id)} onFollowChange={refreshAll} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── FOLLOWING TAB ── */}
      {tab === 'following' && (
        <div>
          {listLoading ? <LoadingCards count={3} /> : followingList.length === 0 ? (
            <EmptyState icon={<UserPlus size={28} />}
              title="Not following anyone yet"
              desc="Follow students at your university to see the paths they are testing and the proof they are building."
              action={
                <div className="flex gap-2 mt-3">
                  <button onClick={() => switchTab('discover')} className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Discover students</button>
                  <button onClick={() => switchTab('invites')} className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold border" style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Invite friends</button>
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              {followingList.filter(p => !blockedIds.has(p.user_id)).map(p => (
                <NetworkProfileCard key={p.id} profile={p} currentUserId={currentUser?.id}
                  isFollowing={isFollowing(p.user_id)} onFollowChange={refreshAll} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FOLLOWERS TAB ── */}
      {tab === 'followers' && (
        <div>
          {listLoading ? <LoadingCards count={3} /> : followersList.length === 0 ? (
            <EmptyState icon={<Users size={28} />}
              title="No followers yet"
              desc="When students follow your work, they will appear here. Share your proof of work and paths to be discoverable."
              action={
                <div className="flex gap-2 mt-3">
                  <Link to="/proof" className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Add proof of work</Link>
                  <button onClick={() => switchTab('invites')} className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold border" style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Invite friends</button>
                </div>
              }
            />
          ) : (
            <div className="space-y-3">
              {followersList.filter(p => !blockedIds.has(p.user_id)).map(p => (
                <NetworkProfileCard key={p.id} profile={p} currentUserId={currentUser?.id}
                  isFollowing={isFollowing(p.user_id)} onFollowChange={refreshAll} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INVITES TAB ── */}
      {tab === 'invites' && (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Invite Friends</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Share Unscripted with friends at your university. They'll join, start their own paths, and you can follow each other's progress.
            </p>
            <InvitePanel currentUser={currentUser} networkProfile={myProfile} />
          </div>
        </div>
      )}
    </main>
  );
}

// ── Sub-components ──

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