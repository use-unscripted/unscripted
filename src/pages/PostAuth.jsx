import { useEffect } from 'react';
import { redirectAfterAuth } from '@/lib/post-auth-redirect';
import { CompassIcon } from '@/components/UnscriptedLogo';

export default function PostAuth() {
  useEffect(() => { redirectAfterAuth(); }, []);
  return (
    <div className="grid min-h-screen place-items-center" style={{ background: '#FAFAF9' }}>
      <div className="flex flex-col items-center gap-4">
        <CompassIcon size={36} className="animate-pulse" />
        <p className="text-sm font-semibold text-[#334155]">Signing you in...</p>
      </div>
    </div>
  );
}