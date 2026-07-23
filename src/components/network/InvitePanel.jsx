import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, X, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { generateInviteToken, inviteUrl, defaultExpiry } from '@/lib/network-utils';

/** Invite panel — manages invite links, copy, revoke, regenerate. */
export default function InvitePanel({ currentUser, networkProfile }) {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState(false);

  useEffect(() => {
    if (currentUser?.id) loadInvite();
  }, [currentUser?.id]);

  const loadInvite = async () => {
    setLoading(true);
    try {
      const invites = await base44.entities.CampusInvite.filter({
        inviter_user_id: currentUser.id,
        active: true,
        revoked: false,
      });
      // Find a valid (non-expired, non-revoked) invite
      const now = new Date();
      const valid = invites.find(inv => !inv.revoked && inv.active && new Date(inv.expires_at) > now);
      setInvite(valid || null);
    } catch (e) {
      console.error('Failed to load invite', e);
    } finally {
      setLoading(false);
    }
  };

  const createInvite = async () => {
    setRegenerating(true);
    try {
      // Revoke existing active ones first
      const existing = await base44.entities.CampusInvite.filter({
        inviter_user_id: currentUser.id,
        active: true,
      });
      await Promise.all(existing.map(inv => base44.entities.CampusInvite.update(inv.id, { active: false, revoked: true })));

      const token = generateInviteToken();
      const inv = await base44.entities.CampusInvite.create({
        inviter_user_id: currentUser.id,
        inviter_university_name: networkProfile?.university_name || '',
        token,
        active: true,
        revoked: false,
        max_uses: 50,
        use_count: 0,
        expires_at: defaultExpiry(),
        claims: [],
      });
      setInvite(inv);
    } catch (e) {
      console.error('Failed to create invite', e);
    } finally {
      setRegenerating(false);
    }
  };

  const revokeInvite = async () => {
    if (!invite) return;
    setRevoking(true);
    try {
      await base44.entities.CampusInvite.update(invite.id, { active: false, revoked: true });
      setInvite(null);
      setRevokeConfirm(false);
    } catch (e) {
      console.error('Failed to revoke', e);
    } finally {
      setRevoking(false);
    }
  };

  const copyLink = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = inviteUrl(invite.token);
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareInvite = async () => {
    if (!invite) return;
    const url = inviteUrl(invite.token);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Unscripted', text: 'I\'m testing career paths on Unscripted. Come explore yours.', url });
      } catch (_) {}
    } else {
      copyLink();
    }
  };

  if (loading) {
    return <div className="h-20 rounded-[16px] animate-pulse" style={{ background: 'var(--background-tertiary)' }} />;
  }

  return (
    <div className="rounded-[20px] border bg-white p-6" style={{ border: '1px solid var(--border-light)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Link2 size={16} style={{ color: 'var(--brand-navy-700)' }} />
        <h3 className="font-heading font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Your Invite Link</h3>
      </div>

      {invite ? (
        <>
          <div className="rounded-[12px] p-3 mb-4 flex items-center gap-2 overflow-hidden"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-light)' }}>
            <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
              {inviteUrl(invite.token)}
            </span>
            <button onClick={copyLink}
              className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition"
              style={{ background: 'var(--brand-navy-900)', color: 'white' }}>
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={shareInvite}
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold text-white"
              style={{ background: 'var(--brand-gold-600)' }}>
              Share Link
            </button>
            <button onClick={createInvite} disabled={regenerating}
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold transition disabled:opacity-60"
              style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
              <RefreshCw size={11} className={regenerating ? 'animate-spin' : ''} /> Regenerate
            </button>
            {!revokeConfirm ? (
              <button onClick={() => setRevokeConfirm(true)}
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold transition hover:text-red-600 hover:border-red-200"
                style={{ background: 'var(--background-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                <X size={11} /> Revoke
              </button>
            ) : (
              <button onClick={revokeInvite} disabled={revoking}
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 disabled:opacity-60">
                {revoking ? 'Revoking…' : 'Confirm revoke'}
              </button>
            )}
          </div>

          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{invite.use_count || 0}</span> accepted
            {' · '}Expires {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create an invite link to share Unscripted with friends at your university.
          </p>
          <button onClick={createInvite} disabled={regenerating}
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--brand-navy-900)' }}>
            <Link2 size={14} /> {regenerating ? 'Generating…' : 'Create Invite Link'}
          </button>
        </div>
      )}
    </div>
  );
}