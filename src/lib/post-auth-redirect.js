import { base44 } from '@/api/base44Client';
import { loadDraft, isDraftComplete } from '@/lib/guest-draft';

/**
 * After login/register, decide where to send the user.
 * Priority:
 * 1. Already done onboarding → /journey
 * 2. Has a complete guest draft → /claim-onboarding (migrate + generate)
 * 3. No profile data → /onboarding
 */
export async function redirectAfterAuth() {
  try {
    const user = await base44.auth.me();
    if (user?.onboarding_completed) {
      window.location.href = '/journey';
      return;
    }
    // Check if there's a usable guest draft to claim
    const draft = loadDraft();
    if (isDraftComplete(draft)) {
      window.location.href = '/claim-onboarding';
      return;
    }
    window.location.href = '/onboarding';
  } catch {
    window.location.href = '/onboarding';
  }
}