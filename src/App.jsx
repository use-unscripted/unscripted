import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';

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
import ExperimentSetup from '@/pages/ExperimentSetup';
import Roadmap from '@/pages/Roadmap';
import WeeklyCalendar from '@/pages/WeeklyCalendar';
import SavedRoadmaps from '@/pages/SavedRoadmaps';
import Settings from '@/pages/Settings';
import BlueprintLibrary from '@/pages/BlueprintLibrary';
import PathComparison from '@/pages/PathComparison';
import ExperimentsPage from '@/pages/ExperimentsPage';
import ResourceHub from '@/pages/ResourceHub';
import CreatorLibrary from '@/pages/CreatorLibrary';
import GoalsPage from '@/pages/GoalsPage';
import ResumeBuilder from '@/pages/ResumeBuilder';
import RecentlyDeleted from '@/pages/RecentlyDeleted';
import GuideDetailPage from '@/pages/GuideDetailPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1F3A5F] rounded-full animate-spin"></div>
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
          {/* Legacy routes kept for old links/bookmarks — they now land inside My Journey */}
          <Route path="/dashboard" element={<Navigate to="/journey" replace />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/calendar" element={<WeeklyCalendar />} />
          <Route path="/saved" element={<SavedRoadmaps />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/blueprints" element={<BlueprintLibrary />} />
          <Route path="/paths" element={<PathComparison />} />
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

        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App