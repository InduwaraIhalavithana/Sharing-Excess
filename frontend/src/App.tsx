import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonGrid } from './components/SkeletonCard';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { dashboardPath } from './utils/format';
import { usePageTitle } from './hooks/usePageTitle';
import { warmPublicData, warmRoleData } from './lib/warmup';
import { useLiveUpdates } from './hooks/useLiveUpdates';
import { useScrollReveal } from './hooks/useScrollReveal';
import './theme-polish.css';
import './redesign.css';
import './polish-v2.css';
import './wide.css';

// Each page is its own chunk, downloaded only when first visited.
// One loader per page, shared by lazy() and preloadPages(), so a page opened later is already in memory.
const loaders = {
  Home: () => import('./Home'),
  About: () => import('./components/About'),
  DonorDashboard: () => import('./DonorDashboard'),
  RecipientDashboard: () => import('./RecipientDashboard'),
  NgoDashboard: () => import('./NgoDashboard'),
  AdminDashboard: () => import('./AdminDashboard'),
  NGOs: () => import('./components/NGOs'),
  PostFood: () => import('./components/PostFood'),
  Browse: () => import('./components/Browse'),
  FoodMap: () => import('./components/FoodMap'),
  ListingDetail: () => import('./components/ListingDetail'),
  PublicProfile: () => import('./components/PublicProfile'),
  Contact: () => import('./components/Contact'),
  Events: () => import('./components/Events'),
  FeedbackPage: () => import('./FeedbackPage'),
  AccountSettings: () => import('./components/AccountSettings'),
  Legal: () => import('./components/LegalPages'),
  NotFound: () => import('./components/NotFound'),
};
/**
 * A page that is downloaded on first visit (lazy) but, once preloadPages() has fetched it, is rendered directly.
 * React always shows the loading fallback for ~250 ms the first time a lazy() component renders, even when its code
 * is already in memory - which looked like an empty page flashing between every two pages.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page<P extends object>(load: () => Promise<{ default: ComponentType<any> }>) {
  const Lazy = lazy(load) as ComponentType<P>;
  let Loaded: ComponentType<P> | undefined;
  const preload = () => load().then((m) => { Loaded = m.default as ComponentType<P>; });
  const Page = (props: P) => {
    const C = Loaded ?? Lazy;
    return <C {...props} />;
  };
  return { Page, preload };
}

const pages = {
  Home: page(loaders.Home),
  About: page(loaders.About),
  DonorDashboard: page(loaders.DonorDashboard),
  RecipientDashboard: page(loaders.RecipientDashboard),
  NgoDashboard: page(loaders.NgoDashboard),
  AdminDashboard: page(loaders.AdminDashboard),
  NGOs: page(loaders.NGOs),
  PostFood: page(loaders.PostFood),
  Browse: page(loaders.Browse),
  ListingDetail: page(loaders.ListingDetail),
  PublicProfile: page(loaders.PublicProfile),
  Contact: page(loaders.Contact),
  Events: page(loaders.Events),
  FeedbackPage: page(loaders.FeedbackPage),
  AccountSettings: page(loaders.AccountSettings),
  Privacy: page(() => loaders.Legal().then((m) => ({ default: m.Privacy }))),
  Terms: page(() => loaders.Legal().then((m) => ({ default: m.Terms }))),
  NotFound: page(loaders.NotFound),
};
const { Home, About, DonorDashboard, RecipientDashboard, NgoDashboard, AdminDashboard, NGOs, PostFood, Browse, ListingDetail,
  PublicProfile, Contact, Events, FeedbackPage, AccountSettings, Privacy, Terms, NotFound } =
  Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, v.Page])) as { [K in keyof typeof pages]: () => ReactNode };

/** Download the rest of the app quietly once the first page is up, so moving around never waits on a chunk. */
function preloadPages(role?: string) {
  for (const [name, p] of Object.entries(pages)) {
    if (name === 'AdminDashboard' && role !== 'admin') continue; // the admin panel (and its charts) only for the admin
    void p.preload().catch(() => undefined);
  }
  void loaders.FoodMap().catch(() => undefined); // the map view on Find Food
}

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

/** A dashboard only for the given roles: signed-out visitors go home, other roles go to their own dashboard. */
function RoleRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) return <Navigate to={dashboardPath(user.role)} replace />;
  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  usePageTitle(location.pathname);
  useLiveUpdates();
  const { user } = useAuth();

  // After the first paint: fetch the other pages' code and the data they open with.
  useEffect(() => {
    const id = window.setTimeout(() => { preloadPages(user?.role); warmPublicData(); }, 400);
    return () => window.clearTimeout(id);
  }, [user?.role]);
  useEffect(() => { if (user) warmRoleData(user); }, [user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps
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

  return (
    <div className="app-root">
      <Navbar />
      <div className="main-background" data-page={page}>
        <div className="app-content">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/donor-dashboard" element={<RoleRoute roles={['donor']}><DonorDashboard /></RoleRoute>} />
                <Route path="/recipient-dashboard" element={<RoleRoute roles={['recipient']}><RecipientDashboard /></RoleRoute>} />
                <Route path="/about" element={<About />} />
                <Route path="/ngos" element={<NGOs />} />
                <Route path="/ngo-dashboard" element={<RoleRoute roles={['ngo']}><NgoDashboard /></RoleRoute>} />
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
    <Router>
      <AppContent />
    </Router>
  );
}
