import { lazy, Suspense } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonGrid } from './components/SkeletonCard';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { usePageTitle } from './hooks/usePageTitle';

// Each page is its own chunk, downloaded only when first visited.
const Home = lazy(() => import('./Home'));
const About = lazy(() => import('./components/About'));
const DonorDashboard = lazy(() => import('./DonorDashboard'));
const RecipientDashboard = lazy(() => import('./RecipientDashboard'));
const OfficerDashboard = lazy(() => import('./OfficerDashboard'));
const NGOs = lazy(() => import('./components/NGOs'));
const Donate = lazy(() => import('./components/Donate'));
const FoodDonationsDashboard = lazy(() => import('./components/FoodDonationsDashboard'));
const CalendarPage = lazy(() => import('./components/CalendarPage'));
const Contact = lazy(() => import('./components/Contact'));
const Events = lazy(() => import('./components/Events'));
const FeedbackPage = lazy(() => import('./FeedbackPage'));
const AccountSettings = lazy(() => import('./components/AccountSettings'));
const NotFound = lazy(() => import('./components/NotFound'));

function PageFallback() {
  return (
    <div className="container" style={{ padding: '40px 0' }}>
      <SkeletonGrid />
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  usePageTitle(location.pathname);
  const isAdminPage = location.pathname.startsWith('/admin');

  // Admin gets its own full-page layout (no Navbar/Footer)
  if (isAdminPage) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/admin" element={<OfficerDashboard />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  const isCalendarPage = location.pathname.startsWith('/calendar');
  return (
    <div className="app-root">
      <Navbar />
      <div className={`main-background${isCalendarPage ? ' no-bg' : ''}`}>
        <div className="app-content">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/donor-dashboard" element={<DonorDashboard />} />
                <Route path="/recipient-dashboard" element={<RecipientDashboard />} />
                <Route path="/about" element={<About />} />
                <Route path="/ngos" element={<NGOs />} />
                <Route path="/donate" element={<Donate />} />
                <Route path="/events" element={<Events />} />
                <Route path="/food-donations" element={<FoodDonationsDashboard />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/account" element={<AccountSettings />} />
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
