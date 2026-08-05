import { useEffect } from 'react';
import { redirectAfterAuth } from '@/lib/post-auth-redirect';
import { CompassIcon } from '@/components/UnscriptedLogo';

export default function PostAuth() {
  useEffect(() => { redirectAfterAuth(); }, []);
  return (
    <div className="grid min-h-screen place-items-center" style={{ background: 'var(--page-surface)' }}>
      <div className="flex flex-col items-center gap-4">
        <CompassIcon size={36} className="animate-pulse" />
        <p className="tp-body font-semibold text-[color:var(--ink-700)]">Signing you in...</p>
      </div>
    </div>
  );
}