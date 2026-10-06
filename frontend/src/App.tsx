import { lazy, Suspense, useEffect } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonGrid } from './components/SkeletonCard';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { dashboardPath } from './utils/format';
import { usePageTitle } from './hooks/usePageTitle';
import { useLiveUpdates } from './hooks/useLiveUpdates';
import { useScrollReveal } from './hooks/useScrollReveal';
import './theme-polish.css';
import './redesign.css';

// Each page is its own chunk, downloaded only when first visited.
const Home = lazy(() => import('./Home'));
const About = lazy(() => import('./components/About'));
const DonorDashboard = lazy(() => import('./DonorDashboard'));
const RecipientDashboard = lazy(() => import('./RecipientDashboard'));
const NgoDashboard = lazy(() => import('./NgoDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const NGOs = lazy(() => import('./components/NGOs'));
const PostFood = lazy(() => import('./components/PostFood'));
const Browse = lazy(() => import('./components/Browse'));
const ListingDetail = lazy(() => import('./components/ListingDetail'));
const PublicProfile = lazy(() => import('./components/PublicProfile'));
const CalendarPage = lazy(() => import('./components/CalendarPage'));
const Contact = lazy(() => import('./components/Contact'));
const Events = lazy(() => import('./components/Events'));
const FeedbackPage = lazy(() => import('./FeedbackPage'));
const AccountSettings = lazy(() => import('./components/AccountSettings'));
const Privacy = lazy(() => import('./components/LegalPages').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./components/LegalPages').then((m) => ({ default: m.Terms })));
const NotFound = lazy(() => import('./components/NotFound'));

function PageFallback() {
  return (
    <div className="container" style={{ padding: '40px 0' }}>
      <SkeletonGrid />
    </div>
  );
}

/** Notification links like /dashboard/requests point at "your dashboard", whichever kind of account you have. */
function MyDashboard({ tab }: { tab?: string }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <Navigate to={`${dashboardPath(user.role)}${tab && user.role !== 'admin' ? `?tab=${tab}` : ''}`} replace />;
}

function AppContent() {
  const location = useLocation();
  usePageTitle(location.pathname);
  useLiveUpdates();
  const isAdminPage = location.pathname.startsWith('/admin');
  const page = location.pathname.split('/')[1] || 'home';

  useScrollReveal(location.pathname);

  // Replay the page-enter animation on every route change (class toggled on the DOM node,
  // so no layout wrapper is needed and nothing remounts).
  useEffect(() => {
    const el = document.querySelector('.app-content');
    if (!el) return;
    el.classList.remove('page-enter');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('page-enter');
  }, [location.pathname]);

  // Admin gets its own full-page layout (no Navbar/Footer)
  if (isAdminPage) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  const isCalendarPage = location.pathname.startsWith('/calendar');
  return (
    <div className="app-root">
      <Navbar />
      <div className={`main-background${isCalendarPage ? ' no-bg' : ''}`} data-page={page}>
        <div className="app-content">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/donor-dashboard" element={<DonorDashboard />} />
                <Route path="/recipient-dashboard" element={<RecipientDashboard />} />
                <Route path="/about" element={<About />} />
                <Route path="/ngos" element={<NGOs />} />
                <Route path="/ngo-dashboard" element={<NgoDashboard />} />
                <Route path="/post-food" element={<PostFood />} />
                <Route path="/food" element={<Browse />} />
                <Route path="/listings" element={<Navigate to="/food" replace />} />
                <Route path="/listings/:id" element={<ListingDetail />} />
                <Route path="/profile/:id" element={<PublicProfile />} />
                <Route path="/dashboard" element={<MyDashboard />} />
                <Route path="/dashboard/requests" element={<MyDashboard tab="requests" />} />
                {/* old addresses keep working */}
                <Route path="/donate" element={<Navigate to="/post-food" replace />} />
                <Route path="/food-donations" element={<Navigate to="/food" replace />} />
                <Route path="/events" element={<Events />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/account" element={<AccountSettings />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  );
}
