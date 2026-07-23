import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, UserPlus, UserMinus, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Compact card shown in Discover, Following, Followers, and feed.
 * Props: profile (NetworkProfile record), currentUserId, isFollowing, onFollowChange
 */
export default function NetworkProfileCard({ profile, currentUserId, isFollowing, onFollowChange }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const isSelf = profile.user_id === currentUserId;

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (isSelf || loading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        // Deactivate follow
        const existing = await base44.entities.Follow.filter({
          follower_user_id: currentUserId,
          followed_user_id: profile.user_id,
          active: true,
        });
        if (existing[0]) {
          await base44.entities.Follow.update(existing[0].id, { active: false, unfollowed_at: new Date().toISOString() });
        }
      } else {
        // Check for duplicate before creating
        const existing = await base44.entities.Follow.filter({
          follower_user_id: currentUserId,
          followed_user_id: profile.user_id,
          active: true,
        });
        if (!existing.length) {
          await base44.entities.Follow.create({
            follower_user_id: currentUserId,
            followed_user_id: profile.user_id,
            follower_university_id: profile.university_id || '',
            followed_university_id: profile.university_id || '',
            active: true,
          });
          // Notify the followed user
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
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => navigate(`/network/profile/${profile.user_id}`)}
      className="cursor-pointer rounded-[18px] border bg-white p-5 flex gap-4 items-start hover:border-[#274C77] transition-colors"
      style={{ border: '1px solid var(--border-light)' }}
    >
      {/* Avatar */}
      <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: 'var(--background-tertiary)' }}>
        {profile.profile_image_url ? (
          <img src={profile.profile_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <UserCircle size={28} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {profile.display_name}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          {profile.university_name || '—'}
          {profile.show_major && profile.major && ` · ${profile.major}`}
          {profile.show_academic_year && profile.academic_year && ` · ${profile.academic_year}`}
        </p>
        {profile.show_path_categories && profile.public_path_categories?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.public_path_categories.slice(0, 3).map((cat, i) => (
              <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>
                {cat}
              </span>
            ))}
          </div>
        )}
        {profile.bio && (
          <p className="mt-2 text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{profile.bio}</p>
        )}
      </div>

      {/* Actions */}
      {!isSelf && (
        <button
          onClick={handleFollow}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold transition disabled:opacity-60"
          style={isFollowing
            ? { background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
            : { background: 'var(--brand-navy-900)', color: 'white' }
          }
        >
          {isFollowing ? <UserMinus size={12} /> : <UserPlus size={12} />}
          {isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      )}
    </div>
  );
}