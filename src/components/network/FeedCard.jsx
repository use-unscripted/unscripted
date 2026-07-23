import { useNavigate } from 'react-router-dom';
import { UserCircle, FileText, Target, ExternalLink, UserPlus, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

const PROOF_CATEGORY_LABELS = {
  report: 'Report', model: 'Model', case_study: 'Case Study', article: 'Article',
  post: 'Post', newsletter: 'Newsletter', video: 'Video', podcast: 'Podcast',
  prototype: 'Prototype', landing_page: 'Landing Page', service_pilot: 'Service Pilot',
  interview_notes: 'Interview Notes', simulation: 'Simulation', presentation: 'Presentation',
  database: 'Database', community: 'Community', volunteer: 'Volunteer', other: 'Other',
};

/** Feed card for a shared Proof or Path record. */
export default function FeedCard({ item, currentUserId, isFollowing, onFollowChange }) {
  const navigate = useNavigate();
  const [followLoading, setFollowLoading] = useState(false);

  const isProof = item.feed_type === 'proof';
  const profile = item.profile;
  const isSelf = profile?.user_id === currentUserId;

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (isSelf || followLoading || !profile) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const existing = await base44.entities.Follow.filter({
          follower_user_id: currentUserId,
          followed_user_id: profile.user_id,
          active: true,
        });
        if (existing[0]) {
          await base44.entities.Follow.update(existing[0].id, { active: false, unfollowed_at: new Date().toISOString() });
        }
      } else {
        const existing = await base44.entities.Follow.filter({
          follower_user_id: currentUserId,
          followed_user_id: profile.user_id,
          active: true,
        });
        if (!existing.length) {
          await base44.entities.Follow.create({
            follower_user_id: currentUserId,
            followed_user_id: profile.user_id,
            active: true,
          });
          try {
            await base44.entities.NetworkNotification.create({
              recipient_user_id: profile.user_id,
              sender_user_id: currentUserId,
              type: 'new_follower',
              message: 'Someone started following you.',
              read: false,
              dismissed: false,
            });
          } catch (_) {}
        }
      }
      onFollowChange?.();
    } finally {
      setFollowLoading(false);
    }
  };

  if (!item || !profile) return null;

  const sharedDate = item.network_shared_at || item.created_date;
  const formattedDate = sharedDate ? new Date(sharedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div className="rounded-[20px] border bg-white overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <button
          onClick={() => navigate(`/network/profile/${profile.user_id}`)}
          className="flex items-center gap-3 min-w-0 hover:opacity-80 transition"
        >
          <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--background-tertiary)' }}>
            {profile.profile_image_url ? (
              <img src={profile.profile_image_url} alt="" className="w-full h-full object-cover" />
            ) : <UserCircle size={22} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{profile.display_name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {profile.university_name}{formattedDate && ` · ${formattedDate}`}
            </p>
          </div>
        </button>
        {!isSelf && (
          <button onClick={handleFollow} disabled={followLoading}
            className="shrink-0 flex items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60"
            style={isFollowing
              ? { background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
              : { background: 'var(--brand-navy-900)', color: 'white' }
            }
          >
            {isFollowing ? <UserMinus size={11} /> : <UserPlus size={11} />}
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        {isProof ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={13} style={{ color: 'var(--brand-navy-700)' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-navy-700)' }}>
                Proof of Work · {PROOF_CATEGORY_LABELS[item.category] || item.category}
              </span>
            </div>
            <h3 className="font-heading font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
            {item.description && <p className="text-sm line-clamp-3 mb-3" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>}
            {item.skills_demonstrated?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {item.skills_demonstrated.slice(0, 5).map((s, i) => (
                  <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>{s}</span>
                ))}
              </div>
            )}
            {item.path_tested && (
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Path: {item.path_tested}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => navigate(`/network/proof/${item.id}`)}
                className="text-xs font-semibold py-1.5 px-3 rounded-lg transition hover:opacity-80"
                style={{ background: 'var(--brand-navy-900)', color: 'white' }}>
                View Proof
              </button>
              {item.external_url && (
                <a href={item.external_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold py-1.5 px-3 rounded-lg transition hover:opacity-80"
                  style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                  <ExternalLink size={11} /> Link
                </a>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={13} style={{ color: 'var(--brand-navy-700)' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-navy-700)' }}>
                Path Update{item.path_category && ` · ${item.path_category}`}
              </span>
            </div>
            <h3 className="font-heading font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>{item.path_name}</h3>
            {item.network_summary && <p className="text-sm line-clamp-3 mb-3" style={{ color: 'var(--text-secondary)' }}>{item.network_summary}</p>}
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize"
                style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>
                {item.status || 'Exploring'}
              </span>
            </div>
            <button onClick={() => navigate(`/network/path/${item.id}`)}
              className="text-xs font-semibold py-1.5 px-3 rounded-lg transition hover:opacity-80"
              style={{ background: 'var(--brand-navy-900)', color: 'white' }}>
              View Path
            </button>
          </div>
        )}
      </div>
    </div>
  );
}