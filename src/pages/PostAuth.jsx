import { useEffect } from 'react';
import { redirectAfterAuth } from '@/lib/post-auth-redirect';

// Intermediate page hit after Google OAuth callback.
// Checks onboarding status then hard-redirects.
export default function PostAuth() {
  useEffect(() => { redirectAfterAuth(); }, []);
  return (
    <div className="grid min-h-screen place-items-center" style={{ background: '#F8FAFC' }}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="grid h-12 w-12 place-items-center rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' }}
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" className="animate-pulse">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="white" strokeWidth="1.5" fill="none" />
            <path d="M8 4L11 5.75V9.25L8 11L5 9.25V5.75L8 4Z" fill="white" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#334155]">Signing you in...</p>
      </div>
    </div>
  );
}