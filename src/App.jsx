import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import AppShellSkeleton, { isShellRoute } from '@/components/AppShellSkeleton';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppErrorBoundary from '@/components/AppErrorBoundary';

// Pages
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Onboarding from '@/pages/Onboarding';
import GoalIntake from '@/pages/GoalIntake';
import Generating from '@/pages/Generating';
import AmbitionProfile from '@/pages/AmbitionProfile';
import PostAuth from '@/pages/PostAuth';
import OnboardingReview from '@/pages/OnboardingReview';
import ClaimOnboarding from '@/pages/ClaimOnboarding';

// New onboarding flow pages
import PathsIntake from '@/pages/PathsIntake';
import PathResults from '@/pages/PathResults';

// Public company + policy pages
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';

// App shell pages
import AppShell from '@/components/AppShell';
import MyJourney from '@/pages/MyJourney';
import Evidence from '@/pages/Evidence';
import CareerEvidenceProfile from '@/pages/CareerEvidenceProfile';
import CampusEventsPage from '@/pages/CampusEventsPage';
import ExperimentSetup from '@/pages/ExperimentSetup';
import Roadmap from '@/pages/Roadmap';
import WeeklyCalendar from '@/pages/WeeklyCalendar';
import SavedRoadmaps from '@/pages/SavedRoadmaps';
import Settings from '@/pages/Settings';
import BlueprintLibrary from '@/pages/BlueprintLibrary';
import PathComparison from '@/pages/PathComparison';
import ExperimentsPage from '@/pages/ExperimentsPage';
import ActiveExperiment from '@/pages/ActiveExperiment';
import ExperimentReflection from '@/pages/ExperimentReflection';
import ResourceHub from '@/pages/ResourceHub';
import CreatorLibrary from '@/pages/CreatorLibrary';
import GoalsPage from '@/pages/GoalsPage';
import ResumeBuilder from '@/pages/ResumeBuilder';
import RecentlyDeleted from '@/pages/RecentlyDeleted';
import GuideDetailPage from '@/pages/GuideDetailPage';
import PilotDashboard from '@/pages/PilotDashboard';
import AnswerNudge from '@/pages/AnswerNudge';
import AdminCampusFeeds from '@/pages/AdminCampusFeeds';
import AdminAiFailures from '@/pages/AdminAiFailures';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const { pathname } = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    // On a signed-in destination, draw the shell rather than a spinner on an
    // empty screen — the nav and the page frame are known before the auth
    // check comes back, so there is no reason to make people wait for them.
    // Public pages get the plain spinner: we don't know yet whether the
    // visitor has an account, and showing them a sidebar would be a lie.
    if (isShellRoute(pathname)) return <AppShellSkeleton />;
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[color:var(--ink-200)] border-t-[color:var(--brand-navy-900)] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/post-auth" element={<PostAuth />} />
      {/* Answering a nudge email. Registered outside ProtectedRoute on purpose:
          that wrapper sends a signed out visitor to /login and loses the nudge
          id in the process, and this link arrives by email weeks after it was
          sent, often on a phone where the session has gone. The page does its
          own auth check and hands a signed out student to the SDK's login with
          this URL as the return address, which is the mechanism the rest of the
          app already uses. It renders nothing about the ask until it has one. */}
      <Route path="/answer" element={<AnswerNudge />} />
      {/* Public company + policy pages — reachable signed out, and from the footer */}
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      {/* Public onboarding — no account required */}
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/paths-intake" element={<PathsIntake />} />
      <Route path="/onboarding-review" element={<OnboardingReview />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/claim-onboarding" element={<ClaimOnboarding />} />
        <Route path="/goals" element={<GoalIntake />} />
        <Route path="/generating" element={<Generating />} />
        <Route path="/profile" element={<AmbitionProfile />} />
        <Route path="/path-results" element={<PathResults />} />
        <Route path="/experiments/new" element={<ExperimentSetup />} />
        <Route element={<AppShell />}>
          {/* My Journey — the default authenticated destination */}
          <Route path="/journey" element={<MyJourney />} />
          <Route path="/evidence" element={<Evidence />} />
          {/* The Career Evidence Profile. Private to the student; also reachable
              as a tab inside Evidence. */}
          <Route path="/career-profile" element={<CareerEvidenceProfile />} />
          {/* A deep screen, reached from My Journey rather than competing with it
              in the nav — the same rule paths, missions and the week follow. */}
          <Route path="/campus" element={<CampusEventsPage />} />
          {/* Legacy routes kept for old links/bookmarks — they now land inside My Journey */}
          <Route path="/dashboard" element={<Navigate to="/journey" replace />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/calendar" element={<WeeklyCalendar />} />
          <Route path="/saved" element={<SavedRoadmaps />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/blueprints" element={<BlueprintLibrary />} />
          <Route path="/paths" element={<PathComparison />} />
          <Route path="/experiment" element={<ActiveExperiment />} />
          <Route path="/reflect" element={<ExperimentReflection />} />
          <Route path="/experiments" element={<ExperimentsPage />} />
          <Route path="/outreach" element={<Navigate to="/evidence?tab=outreach" replace />} />
          <Route path="/OutreachTracker" element={<Navigate to="/evidence?tab=outreach" replace />} />
          <Route path="/proof" element={<Navigate to="/evidence?tab=proof" replace />} />
          <Route path="/reflection" element={<Navigate to="/evidence?tab=reflect" replace />} />
          <Route path="/resources" element={<ResourceHub />} />
          <Route path="/creators" element={<CreatorLibrary />} />
          <Route path="/goals-tracker" element={<GoalsPage />} />
          <Route path="/resume" element={<ResumeBuilder />} />
          <Route path="/recently-deleted" element={<RecentlyDeleted />} />
          <Route path="/guide" element={<GuideDetailPage />} />
          {/* Admin-only aggregate pilot reporting; the page itself re-checks the role. */}
          <Route path="/pilot" element={<PilotDashboard />} />
          {/* Team-only. The page checks the role, and so does the function behind it. */}
          <Route path="/admin/campus-feeds" element={<AdminCampusFeeds />} />
          {/* Team-only. The page checks the role, and so does the entity's RLS. */}
          <Route path="/admin/ai-failures" element={<AdminAiFailures />} />

        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    // Outermost on purpose. A throw anywhere below it lands on a page with a
    // message and a way out, instead of unmounting the tree to a white screen.
    <AppErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </AppErrorBoundary>
  )
}

export default App