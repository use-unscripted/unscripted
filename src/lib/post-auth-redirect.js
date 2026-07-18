import { base44 } from '@/api/base44Client';

/**
 * After login/register, check if the user has completed onboarding.
 * Redirect to /dashboard if yes, /onboarding if no.
 * Uses a hard redirect so the auth provider re-initializes.
 */
export async function redirectAfterAuth() {
  try {
    const user = await base44.auth.me();
    if (user?.onboarding_completed) {
      window.location.href = '/dashboard';
    } else if (user?.college) {
      // Profile intake done, still need goals
      window.location.href = '/goals';
    } else {
      window.location.href = '/onboarding';
    }
  } catch {
    window.location.href = '/onboarding';
  }
}