import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CompassIcon } from '@/components/UnscriptedLogo';

/**
 * Invite accept landing page — validates token, shows inviter info (if permitted),
 * and prompts the visitor to register or log in, preserving the token through auth.
 */
export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'valid' | 'invalid' | 'claiming' | 'claimed' | 'error'
  const [invite, setInvite] = useState(null);
  const [inviterProfile, setInviterProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [followInviter, setFollowInviter] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');

  useEffect(() => {
    if (token) validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const invites = await base44.entities.CampusInvite.filter({ token, active: true, revoked: false }).catch(() => []);
      const inv = invites[0];

      if (!inv) { setStatus('invalid'); return; }

      const now = new Date();
      if (new Date(inv.expires_at) < now) { setStatus('invalid'); return; }
      if (inv.use_count >= inv.max_uses) { setStatus('invalid'); return; }

      setInvite(inv);

      // Try to get inviter's public profile (safe fields only)
      const profiles = await base44.entities.NetworkProfile.filter({ user_id: inv.inviter_user_id }).catch(() => []);
      const profile = profiles[0];
      if (profile && ['my_university', 'all_unscripted'].includes(profile.profile_visibility)) {
        setInviterProfile({ display_name: profile.display_name, university_name: profile.university_name, bio: profile.bio });
      }

      // Check if already logged in
      const me = await base44.auth.me().catch(() => null);
      setCurrentUser(me);
      setStatus('valid');

      // Preserve token in session storage so it survives auth redirect
      sessionStorage.setItem('unscripted_invite_token', token);
    } catch (e) {
      console.error('Token validation error', e);
      setStatus('error');
    }
  };

  const claimInvite = async () => {
    if (!currentUser || !invite) return;
    setStatus('claiming');
    try {
      // Idempotency: check if already claimed
      const existing = (invite.claims || []).find(c => c.claimed_user_id === currentUser.id);
      if (existing) {
        setStatus('claimed');
        setClaimMessage('You already claimed this invite.');
        return;
      }

      const updatedClaims = [...(invite.claims || []), { claimed_user_id: currentUser.id, claimed_at: new Date().toISOString() }];
      await base44.entities.CampusInvite.update(invite.id, {
        use_count: (invite.use_count || 0) + 1,
        claims: updatedClaims,
      });

      // Notify inviter
      try {
        await base44.entities.NetworkNotification.create({
          recipient_user_id: invite.inviter_user_id,
          sender_user_id: currentUser.id,
          type: 'invite_accepted',
          message: 'Your invite was accepted.',
          read: false, dismissed: false,
        });
      } catch (_) {}

      // Optionally follow inviter
      if (followInviter && invite.inviter_user_id !== currentUser.id) {
        const existingFollow = await base44.entities.Follow.filter({
          follower_user_id: currentUser.id, followed_user_id: invite.inviter_user_id, active: true,
        }).catch(() => []);
        if (!existingFollow.length) {
          await base44.entities.Follow.create({
            follower_user_id: currentUser.id, followed_user_id: invite.inviter_user_id, active: true,
          });
          try {
            await base44.entities.NetworkNotification.create({
              recipient_user_id: invite.inviter_user_id, sender_user_id: currentUser.id,
              type: 'follow_back_suggestion', message: 'Someone you invited is now following you.', read: false, dismissed: false,
            });
          } catch (_) {}
        }
      }

      sessionStorage.removeItem('unscripted_invite_token');
      setStatus('claimed');
      setClaimMessage('Welcome to Unscripted! Your invitation has been accepted.');
    } catch (e) {
      console.error('Claim failed', e);
      setStatus('error');
    }
  };

  const goToRegister = () => {
    // Token is already in sessionStorage; post-auth redirect will handle migration
    window.location.href = '/register';
  };

  const goToLogin = () => {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: 'var(--background-secondary)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <CompassIcon size={28} />
            <span className="font-heading font-bold text-lg tracking-[.12em] uppercase" style={{ color: 'var(--text-primary)' }}>Unscripted</span>
          </Link>
        </div>

        <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-8 shadow-sm">

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1F3A5F] rounded-full animate-spin" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Validating invitation…</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🔗</p>
              <h2 className="font-heading font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Invite link unavailable</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                This invite link has expired, been revoked, or reached its usage limit. Ask your friend for a new one.
              </p>
              <Link to="/register"
                className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)' }}>
                Start Unscripted anyway →
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <h2 className="font-heading font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Something went wrong</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>We couldn't validate this invitation. Try again or start fresh.</p>
              <Link to="/register" className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
                Start Unscripted
              </Link>
            </div>
          )}

          {status === 'claimed' && (
            <div className="text-center py-4">
              <p className="text-3xl mb-3">🎉</p>
              <h2 className="font-heading font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>You're in.</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{claimMessage}</p>
              <button onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'var(--brand-navy-900)' }}>
                Go to Dashboard →
              </button>
            </div>
          )}

          {status === 'valid' && (
            <div>
              {inviterProfile && (
                <div className="mb-6 rounded-[16px] p-4 text-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Invited by</p>
                  <p className="font-heading font-bold text-base" style={{ color: 'var(--text-primary)' }}>{inviterProfile.display_name}</p>
                  {inviterProfile.university_name && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{inviterProfile.university_name}</p>}
                </div>
              )}

              <h2 className="font-heading font-bold text-2xl mb-1" style={{ color: 'var(--text-primary)' }}>You've been invited.</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                Unscripted helps students test career paths through focused experiments and real evidence — not guesswork.
              </p>

              {currentUser ? (
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Signed in as {currentUser.full_name || currentUser.email}
                  </p>

                  {inviterProfile && (
                    <label className="flex items-center gap-3 mb-5 cursor-pointer">
                      <input type="checkbox" checked={followInviter} onChange={e => setFollowInviter(e.target.checked)}
                        className="accent-[#1F3A5F] w-4 h-4" />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        Follow {inviterProfile.display_name} to see their paths and proof
                      </span>
                    </label>
                  )}

                  <button onClick={claimInvite}
                    className="w-full rounded-[10px] py-3 text-sm font-semibold text-white"
                    style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
                    Accept Invitation &amp; Continue
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={goToRegister}
                    className="w-full rounded-[10px] py-3 text-sm font-semibold text-white"
                    style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
                    Create your account
                  </button>
                  <button onClick={goToLogin}
                    className="w-full rounded-[10px] py-3 text-sm font-semibold border"
                    style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                    Log in to an existing account
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'claiming' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1F3A5F] rounded-full animate-spin" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Claiming your invitation…</p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Your personal notes, financial information, and private answers are never shared.
        </p>
      </div>
    </div>
  );
}