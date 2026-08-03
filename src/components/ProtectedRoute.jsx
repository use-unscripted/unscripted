import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppShellSkeleton, { isShellRoute } from '@/components/AppShellSkeleton';

// Inside the signed-in shell, wait on the shell itself rather than on a spinner
// over a blank page. Everywhere else the spinner is still right — those screens
// have no shared frame to draw ahead of time.
const DefaultFallback = () => {
  const { pathname } = useLocation();
  if (isShellRoute(pathname)) return <AppShellSkeleton />;
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[color:var(--ink-200)] border-t-slate-800 rounded-full animate-spin"></div>
    </div>
  );
};

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}
