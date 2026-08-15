import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from 'next-themes'
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

/* Pages are split out of the initial bundle. On a phone the WebView has to
   download, parse and compile everything in the entry chunk before it can paint
   anything, and the entry chunk used to contain every screen in the product —
   the resume builder's PDF work, the landing page's three.js backdrop, the admin
   console — to render a login form. Each screen is now its own chunk, fetched
   when its route is first visited. */

// Pages
const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const GoalIntake = lazy(() => import('@/pages/GoalIntake'));
const Generating = lazy(() => import('@/pages/Generating'));
const AmbitionProfile = lazy(() => import('@/pages/AmbitionProfile'));
const PostAuth = lazy(() => import('@/pages/PostAuth'));
const OnboardingReview = lazy(() => import('@/pages/OnboardingReview'));
const ClaimOnboarding = lazy(() => import('@/pages/ClaimOnboarding'));

// New onboarding flow pages
const PathsIntake = lazy(() => import('@/pages/PathsIntake'));
const PathResults = lazy(() => import('@/pages/PathResults'));

// Public company + policy pages
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Terms = lazy(() => import('@/pages/Terms'));

// App shell pages
const AppShell = lazy(() => import('@/components/AppShell'));
const MyJourney = lazy(() => import('@/pages/MyJourney'));
const Evidence = lazy(() => import('@/pages/Evidence'));
const CareerEvidenceProfile = lazy(() => import('@/pages/CareerEvidenceProfile'));
const ExperimentSetup = lazy(() => import('@/pages/ExperimentSetup'));
const CareerMomentPage = lazy(() => import('@/pages/CareerMomentPage'));
const WorkSimulationPage = lazy(() => import('@/pages/WorkSimulationPage'));
const Roadmap = lazy(() => import('@/pages/Roadmap'));
const WeeklyCalendar = lazy(() => import('@/pages/WeeklyCalendar'));
const SavedRoadmaps = lazy(() => import('@/pages/SavedRoadmaps'));
const Settings = lazy(() => import('@/pages/Settings'));
const UncertaintyUpdate = lazy(() => import('@/pages/UncertaintyUpdate'));
const BlueprintLibrary = lazy(() => import('@/pages/BlueprintLibrary'));
const PathComparison = lazy(() => import('@/pages/PathComparison'));
const ExperimentsPage = lazy(() => import('@/pages/ExperimentsPage'));
const ActiveExperiment = lazy(() => import('@/pages/ActiveExperiment'));
const ExperimentReflection = lazy(() => import('@/pages/ExperimentReflection'));
const ResourceHub = lazy(() => import('@/pages/ResourceHub'));
const CreatorLibrary = lazy(() => import('@/pages/CreatorLibrary'));
const GoalsPage = lazy(() => import('@/pages/GoalsPage'));
const RecentlyDeleted = lazy(() => import('@/pages/RecentlyDeleted'));
const GuideDetailPage = lazy(() => import('@/pages/GuideDetailPage'));
const AnswerNudge = lazy(() => import('@/pages/AnswerNudge'));
const AdminAiFailures = lazy(() => import('@/pages/AdminAiFailures'));
const AdminDecisionIntelligence = lazy(() => import('@/pages/AdminDecisionIntelligence'));

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
    // The wait while a route's chunk arrives is the same wait as the auth check
    // above, so it gets the same frame: the shell on a signed-in destination,
    // the plain spinner on a public page.
    <Suspense fallback={isShellRoute(pathname) ? <AppShellSkeleton /> : (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[color:var(--ink-200)] border-t-[color:var(--brand-navy-900)] rounded-full animate-spin"></div>
      </div>
    )}>
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
          {/* Legacy routes kept for old links/bookmarks — they now land inside My Journey */}
          <Route path="/dashboard" element={<Navigate to="/journey" replace />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/calendar" element={<WeeklyCalendar />} />
          <Route path="/saved" element={<SavedRoadmaps />} />
          <Route path="/settings" element={<Settings />} />
          {/* The short uncertainty update for a student who onboarded before
              the intake asked about it. Adds fields; changes nothing existing. */}
          <Route path="/uncertainty-update" element={<UncertaintyUpdate />} />
          <Route path="/blueprints" element={<BlueprintLibrary />} />
          <Route path="/paths" element={<PathComparison />} />
          {/* The default, short Experiment: one Career Moment, 2–7 minutes. */}
          <Route path="/moment" element={<CareerMomentPage />} />
          {/* The work simulation: 30 minutes of one job, signed in only. Inside
              ProtectedRoute on purpose. Every row it writes is owned by the
              student under row-level security, so there is no guest draft to
              claim later and no anonymous run to reconcile. */}
          <Route path="/simulation" element={<WorkSimulationPage />} />
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
          <Route path="/recently-deleted" element={<RecentlyDeleted />} />
          <Route path="/guide" element={<GuideDetailPage />} />
          {/* Team-only. The page checks the role, and so does the entity's RLS. */}
          <Route path="/admin/ai-failures" element={<AdminAiFailures />} />
          {/* Team-only aggregate product learning. The page checks the role, and
              so does the function, which is where suppression is applied. */}
          <Route path="/admin/decision-intelligence" element={<AdminDecisionIntelligence />} />

        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    // Outermost on purpose. A throw anywhere below it lands on a page with a
    // message and a way out, instead of unmounting the tree to a white screen.
    <AppErrorBoundary>
      {/* Puts the .dark class on <html> so the dark token block in index.css is
          what decides the palette. attribute="class" matches Tailwind's
          darkMode: ["class"]. */}
      <ThemeProvider attribute="class" enableSystem defaultTheme="light" disableTransitionOnChange>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  )
}

export default App