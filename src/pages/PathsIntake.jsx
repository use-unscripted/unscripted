/**
 * The old path-selection page. Path selection is the first four questions of
 * the guided intake now, so this route survives only for links and bookmarks
 * that still point here.
 *
 * Where it sends someone depends on who they are, and it used to send everyone
 * the same way. A visitor without an account belongs at question one. A student
 * who has already finished onboarding does not: the intake ends at the account
 * wall, and the wall bounces an onboarded student straight to My Journey, so
 * the whole trip generated nothing and cost eleven questions they had already
 * answered.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function PathsIntake() {
  // No wait needed: nothing routes at all until the auth check has settled, and
  // when the check itself fails the answer is "signed out", which is the
  // redirect that works for everybody. Gating on authChecked here left a blank
  // page on exactly that failure.
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated && user?.onboarding_completed) {
    return <Navigate to="/generating" replace />;
  }

  return <Navigate to="/onboarding?step=0" replace />;
}
