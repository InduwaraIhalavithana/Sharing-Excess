import React from 'react';
import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './Home.jsx';
import About from './components/About.jsx';
import DonorDashboard from './DonorDashboard.jsx';
import RecipientDashboard from './RecipientDashboard.jsx';
import OfficerDashboard from './OfficerDashboard.jsx';
import NGOs from './components/NGOs.jsx';
import Donate from './components/Donate.jsx';
import FoodDonationsDashboard from './components/FoodDonationsDashboard.jsx';
import CalendarPage from './components/CalendarPage.jsx';
import Contact from './components/Contact.jsx';
import Events from './components/Events.jsx';
import FeedbackPage from './FeedbackPage.jsx';

function AppContent() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  // Admin gets its own full-page layout (no Navbar/Footer)
  if (isAdminPage) {
    return (
      <Routes>
        <Route path="/admin" element={<OfficerDashboard />} />
      </Routes>
    );
  }

  const isCalendarPage = location.pathname.startsWith('/calendar');
  return (
    <div className="app-root">
      <Navbar />
      <div className={`main-background${isCalendarPage ? ' no-bg' : ''}`}>
        <div className="app-content">
          <Routes>
            <Route path="/"                    element={<Home />} />
            <Route path="/donor-dashboard"     element={<DonorDashboard />} />
            <Route path="/recipient-dashboard" element={<RecipientDashboard />} />
            <Route path="/about"               element={<About />} />
            <Route path="/ngos"                element={<NGOs />} />
            <Route path="/donate"              element={<Donate />} />
            <Route path="/events"              element={<Events />} />
            <Route path="/food-donations"      element={<FoodDonationsDashboard />} />
            <Route path="/calendar"            element={<CalendarPage />} />
            <Route path="/contact"             element={<Contact />} />
            <Route path="/feedback"            element={<FeedbackPage />} />
          </Routes>
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
