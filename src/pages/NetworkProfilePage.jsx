import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserCircle, UserPlus, UserMinus, FileText, Target, Flag, ShieldOff, ArrowLeft, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { canViewRecord } from '@/lib/network-utils';
import { safeExternalUrl } from '@/lib/safe-url';

const PROOF_CATEGORY_LABELS = {
  report: 'Report', model: 'Model', case_study: 'Case Study', article: 'Article',
  post: 'Post', newsletter: 'Newsletter', video: 'Video', podcast: 'Podcast',
  prototype: 'Prototype', landing_page: 'Landing Page', service_pilot: 'Service Pilot',
  interview_notes: 'Interview Notes', simulation: 'Simulation', presentation: 'Presentation',
  database: 'Database', community: 'Community', volunteer: 'Volunteer', other: 'Other',
};

export default function NetworkProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [proofItems, setProofItems] = useState([]);
  const [pathItems, setPathItems] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Report / block UI
  const [showReport, setShowReport] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportExplanation, setReportExplanation] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockDone, setBlockDone] = useState(false);

  useEffect(() => {
    if (userId) loadAll();
  }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await base44.auth.me();
      setCurrentUser(me);

      // Self redirect
      if (me.id === userId) {
        navigate('/network?tab=feed');
        return;
      }

      // My profile
      const myProfiles = await base44.entities.NetworkProfile.filter({ user_id: me.id }).catch(() => []);
      const myProf = myProfiles[0] || null;
      setMyProfile(myProf);

      // Check block
      const blocks = await base44.entities.BlockedUser.filter({ blocker_user_id: me.id, blocked_user_id: userId }).catch(() => []);
      const blockedBy = await base44.entities.BlockedUser.filter({ blocker_user_id: userId, blocked_user_id: me.id }).catch(() => []);
      if (blocks.length > 0 || blockedBy.length > 0) {
        setIsBlocked(true);
        setLoading(false);
        return;
      }

      // Their profile
      const profiles = await base44.entities.NetworkProfile.filter({ user_id: userId, active: true }).catch(() => []);
      const theirProfile = profiles[0];
      if (!theirProfile) { setError('Profile not found or not available.'); setLoading(false); return; }

      // Visibility check
      const sameUni = myProf?.university_name?.toLowerCase() === theirProfile.university_name?.toLowerCase();
      const followsRec = await base44.entities.Follow.filter({ follower_user_id: me.id, followed_user_id: userId, active: true }).catch(() => []);
      const following = followsRec.length > 0;
      setIsFollowing(following);

      const canSeeProfile = canViewRecord({
        visibility: theirProfile.profile_visibility,
        ownerUserId: userId,
        viewerUserId: me.id,
        isFollower: following,
        sameUniversity: sameUni,
      });
      if (!canSeeProfile) { setError('This profile is private.'); setLoading(false); return; }

      setProfile(theirProfile);

      // Follower / following counts
      const [frsIn, frsOut] = await Promise.all([
        base44.entities.Follow.filter({ followed_user_id: userId, active: true }).catch(() => []),
        base44.entities.Follow.filter({ follower_user_id: userId, active: true }).catch(() => []),
      ]);
      setFollowersCount((frsIn || []).length);
      setFollowingCount((frsOut || []).length);

      // Their shared proof
      const proof = await base44.entities.ProofOfWork.list('-created_date', 100).catch(() => []);
      const visibleProof = proof.filter(p =>
        p.created_by_id === userId &&
        p.deletion_status !== 'deleted' && p.deletion_status !== 'permanently_deleted' &&
        canViewRecord({ visibility: p.network_visibility, ownerUserId: userId, viewerUserId: me.id, isFollower: following, sameUniversity: sameUni })
      );
      setProofItems(visibleProof);

      // Their shared paths
      const paths = await base44.entities.PathRecommendations.list('-created_date', 100).catch(() => []);
      const visiblePaths = paths.filter(p =>
        p.created_by_id === userId &&
        canViewRecord({ visibility: p.network_visibility, ownerUserId: userId, viewerUserId: me.id, isFollower: following, sameUniversity: sameUni })
      );
      setPathItems(visiblePaths);

    } catch (e) {
      console.error('Failed to load profile', e);
      setError('Failed to load this profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentUser || !userId || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const existing = await base44.entities.Follow.filter({ follower_user_id: currentUser.id, followed_user_id: userId, active: true });
        if (existing[0]) {
          await base44.entities.Follow.update(existing[0].id, { active: false, unfollowed_at: new Date().toISOString() });
        }
        setIsFollowing(false);
        setFollowersCount(c => Math.max(0, c - 1));
      } else {
        const existing = await base44.entities.Follow.filter({ follower_user_id: currentUser.id, followed_user_id: userId, active: true });
        if (!existing.length) {
          await base44.entities.Follow.create({ follower_user_id: currentUser.id, followed_user_id: userId, active: true });
          try {
            await base44.entities.NetworkNotification.create({
              recipient_user_id: userId, sender_user_id: currentUser.id,
              type: 'new_follower', message: 'Someone started following you.', read: false, dismissed: false,
            });
          } catch (_) {}
        }
        setIsFollowing(true);
        setFollowersCount(c => c + 1);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const submitReport = async () => {
    if (!reportReason || !currentUser) return;
    try {
      await base44.entities.NetworkReport.create({
        reporter_user_id: currentUser.id,
        reported_user_id: userId,
        report_type: 'profile',
        reason: reportReason,
        explanation: reportExplanation,
        moderation_status: 'pending',
      });
      setReportSubmitted(true);
    } catch (e) {
      console.error('Failed to submit report', e);
    }
  };

  const confirmBlock = async () => {
    if (!currentUser || blocking) return;
    setBlocking(true);
    try {
      await base44.entities.BlockedUser.create({ blocker_user_id: currentUser.id, blocked_user_id: userId });
      // Deactivate follows both ways
      const follows1 = await base44.entities.Follow.filter({ follower_user_id: currentUser.id, followed_user_id: userId, active: true }).catch(() => []);
      const follows2 = await base44.entities.Follow.filter({ follower_user_id: userId, followed_user_id: currentUser.id, active: true }).catch(() => []);
      await Promise.all([
        ...follows1.map(f => base44.entities.Follow.update(f.id, { active: false })),
        ...follows2.map(f => base44.entities.Follow.update(f.id, { active: false })),
      ]);
      setBlockDone(true);
    } catch (e) {
      console.error('Block failed', e);
    } finally {
      setBlocking(false);
    }
  };

  if (loading) return (
    <main className="mx-auto max-w-2xl px-5 py-10"><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#1F3A5F] rounded-full animate-spin" /></div></main>
  );

  if (blockDone) return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-center">
      <p className="font-heading font-bold text-lg mb-2">User blocked.</p>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>You won't see this user in your network.</p>
      <button onClick={() => navigate('/network')} className="rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Back to Campus Network</button>
    </main>
  );

  if (isBlocked) return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-center">
      <Lock size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
      <p className="font-heading font-bold text-lg mb-1">Profile unavailable</p>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>This profile is not available.</p>
      <button onClick={() => navigate('/network')} className="rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Back to Campus Network</button>
    </main>
  );

  if (error) return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-center">
      <Lock size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
      <p className="font-heading font-bold text-lg mb-1">Profile not available</p>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{error}</p>
      <button onClick={() => navigate('/network')} className="rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Back to Campus Network</button>
    </main>
  );

  if (!profile) return null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
      {/* Back */}
      <button onClick={() => navigate('/network')} className="mb-6 flex items-center gap-2 text-sm font-semibold transition hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={14} /> Campus Network
      </button>

      {/* Profile header */}
      <div className="rounded-[24px] border bg-white p-7 mb-6" style={{ border: '1px solid var(--border-light)' }}>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0"
            style={{ background: 'var(--background-tertiary)' }}>
            {profile.profile_image_url
              ? <img src={profile.profile_image_url} alt="" className="w-full h-full object-cover" />
              : <UserCircle size={40} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{profile.display_name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {profile.university_name}
              {profile.show_major && profile.major && ` · ${profile.major}`}
              {profile.show_academic_year && profile.academic_year && ` · ${profile.academic_year}`}
            </p>
            {profile.bio && <p className="text-sm mt-2 leading-6" style={{ color: 'var(--text-secondary)' }}>{profile.bio}</p>}
            {profile.show_path_categories && profile.public_path_categories?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {profile.public_path_categories.map((cat, i) => (
                  <span key={i} className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>{cat}</span>
                ))}
              </div>
            )}
            {/* Stats */}
            <div className="mt-4 flex gap-5 text-sm">
              <span><strong style={{ color: 'var(--text-primary)' }}>{followersCount}</strong> <span style={{ color: 'var(--text-muted)' }}>followers</span></span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{followingCount}</strong> <span style={{ color: 'var(--text-muted)' }}>following</span></span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{proofItems.length}</strong> <span style={{ color: 'var(--text-muted)' }}>proof</span></span>
              <span><strong style={{ color: 'var(--text-primary)' }}>{pathItems.length}</strong> <span style={{ color: 'var(--text-muted)' }}>paths</span></span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={toggleFollow} disabled={followLoading}
              className="flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
              style={isFollowing
                ? { background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
                : { background: 'var(--brand-navy-900)', color: 'white' }
              }>
              {isFollowing ? <UserMinus size={14} /> : <UserPlus size={14} />}
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
            <button onClick={() => setShowReport(true)} className="flex items-center gap-1.5 text-xs font-semibold rounded-[9px] px-3 py-2 transition hover:opacity-80"
              style={{ background: 'var(--background-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
              <Flag size={11} /> Report
            </button>
            <button onClick={() => setShowBlockConfirm(true)} className="flex items-center gap-1.5 text-xs font-semibold rounded-[9px] px-3 py-2 transition hover:text-red-600"
              style={{ background: 'var(--background-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
              <ShieldOff size={11} /> Block
            </button>
          </div>
        </div>
      </div>

      {/* Paths */}
      {pathItems.length > 0 && (
        <section className="mb-6">
          <h2 className="font-heading font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Target size={15} style={{ color: 'var(--brand-navy-700)' }} /> Public Paths
          </h2>
          <div className="space-y-3">
            {pathItems.map(path => (
              <div key={path.id} className="rounded-[18px] border bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize"
                    style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>{path.status || 'Exploring'}</span>
                  {path.path_category && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{path.path_category}</span>}
                </div>
                <h3 className="font-heading font-bold text-base" style={{ color: 'var(--text-primary)' }}>{path.path_name}</h3>
                {path.network_summary && <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{path.network_summary}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Proof */}
      {proofItems.length > 0 && (
        <section className="mb-6">
          <h2 className="font-heading font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <FileText size={15} style={{ color: 'var(--brand-navy-700)' }} /> Proof of Work
          </h2>
          <div className="space-y-3">
            {proofItems.map(proof => (
              <div key={proof.id} className="rounded-[18px] border bg-white p-5" style={{ border: '1px solid var(--border-light)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--brand-navy-700)' }}>
                  {PROOF_CATEGORY_LABELS[proof.category] || proof.category}
                </p>
                <h3 className="font-heading font-bold text-base" style={{ color: 'var(--text-primary)' }}>{proof.title}</h3>
                {proof.description && <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{proof.description}</p>}
                {proof.skills_demonstrated?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {proof.skills_demonstrated.slice(0, 5).map((s, i) => (
                      <span key={i} className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>{s}</span>
                    ))}
                  </div>
                )}
                {safeExternalUrl(proof.external_url) && (
                  <a href={safeExternalUrl(proof.external_url)} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--brand-navy-700)' }}>
                    View Link ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {proofItems.length === 0 && pathItems.length === 0 && (
        <div className="rounded-[20px] border-2 border-dashed p-10 text-center" style={{ borderColor: 'var(--border-light)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This student hasn't shared any public paths or proof yet.</p>
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl">
            {reportSubmitted ? (
              <>
                <h3 className="font-heading font-bold text-lg mb-2">Report submitted</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Thank you. Our moderation team will review it.</p>
                <button onClick={() => { setShowReport(false); setReportSubmitted(false); }}
                  className="w-full rounded-[10px] py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>Close</button>
              </>
            ) : (
              <>
                <h3 className="font-heading font-bold text-lg mb-1">Report profile</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Only one report will be created per profile. Your identity is not shared with the reported user.</p>
                <select value={reportReason} onChange={e => setReportReason(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm mb-3 outline-none focus:border-[#274C77]"
                  aria-label="Report reason">
                  <option value="">Select a reason…</option>
                  {['inappropriate', 'spam', 'misleading', 'harassment', 'other'].map(r => (
                    <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
                <textarea rows={3} value={reportExplanation} onChange={e => setReportExplanation(e.target.value)}
                  placeholder="Optional: additional context" maxLength={500}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm mb-4 outline-none focus:border-[#274C77] resize-none" />
                <div className="flex gap-2">
                  <button onClick={submitReport} disabled={!reportReason}
                    className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'var(--brand-navy-900)' }}>Submit report</button>
                  <button onClick={() => setShowReport(false)}
                    className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold border" style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Block confirm */}
      {showBlockConfirm && !blockDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl">
            <h3 className="font-heading font-bold text-lg mb-2">Block this user?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              They won't be able to find you in the network. Existing follows will be removed. Neither you nor they will be notified.
            </p>
            <div className="flex gap-2">
              <button onClick={confirmBlock} disabled={blocking}
                className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#DC2626' }}>{blocking ? 'Blocking…' : 'Block user'}</button>
              <button onClick={() => setShowBlockConfirm(false)}
                className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold border" style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}