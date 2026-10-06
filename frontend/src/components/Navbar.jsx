import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from '../LoginModal.jsx';
import SignupModal from './SignupModal.jsx';
import ForgotPasswordModal from './ForgotPasswordModal.jsx';
import VerificationModal from './VerificationModal.jsx';
import { usePublicStats } from '../hooks/queries';
import './Navbar.css';

const LANG_LABELS = { en: 'EN', si: 'SI', ta: 'TA' };
const LANGS = ['en', 'si', 'ta'];
const NAV_ICONS = { '/': '🏠', '/about': '🌍', '/ngos': '🤝', '/donate': '🍽️', '/events': '📅', '/contact': '✉️', '/feedback': '💬' };

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Live impact ticker - how many listings are open right now
  const { data: stats } = usePublicStats();
  const liveCount = stats?.listings_available ?? null;

  // Modal state
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [pendingSignup, setPendingSignup] = useState(null);

  const userMenuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Listen for events dispatched from other components
  useEffect(() => {
    const openLogin = () => setShowLogin(true);
    const openSignup = () => setShowSignup(true);
    window.addEventListener('openLogin', openLogin);
    window.addEventListener('openSignup', openSignup);
    return () => {
      window.removeEventListener('openLogin', openLogin);
      window.removeEventListener('openSignup', openSignup);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setMenuOpen(false);
    navigate('/');
  };

  const handleLoginSuccess = (userData) => {
    setShowLogin(false);
    const role = String(userData.role || '').toLowerCase();
    if (role === 'adminofficer') navigate('/admin');
    else if (role === 'recipient') navigate('/recipient-dashboard');
    else navigate('/donor-dashboard');
  };

  const handleSignupSuccess = (data) => {
    setPendingSignup(data);
    setShowSignup(false);
    setShowVerification(true);
  };

  const handleVerificationSuccess = (userData) => {
    setShowVerification(false);
    const role = String(userData.role || '').toLowerCase();
    if (role === 'adminofficer') navigate('/admin');
    else if (role === 'recipient') navigate('/recipient-dashboard');
    else navigate('/donor-dashboard');
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    const role = String(user.role || '').toLowerCase();
    if (role === 'adminofficer') return '/admin';
    if (role === 'recipient') return '/recipient-dashboard';
    return '/donor-dashboard';
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { to: '/',         label: t('nav', 'home') },
    { to: '/about',    label: t('nav', 'about') },
    { to: '/ngos',     label: t('nav', 'ngos') },
    { to: '/donate',   label: t('nav', 'donate') },
    { to: '/events',   label: t('nav', 'events') },
    { to: '/contact',  label: t('nav', 'contact') },
    { to: '/feedback', label: t('nav', 'feedback') },
  ];

  return (
    <>
      <header className={`se-navbar${scrolled ? ' scrolled' : ''}`} role="banner">
        <div className="se-navbar__inner">
          {/* Brand */}
          <Link to="/" className="se-navbar__brand" aria-label="Sharing Excess Home">
            <span className="se-navbar__brand-icon" aria-hidden="true">🌿</span>
            <span className="se-navbar__brand-text">
              <span className="brand-main">Sharing</span>
              <span className="brand-accent"> Excess</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="se-navbar__links" aria-label="Main navigation">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`se-navbar__link${isActive(to) ? ' active' : ''}`}
              >
                <span className="se-navbar__link-icon" aria-hidden="true">{NAV_ICONS[to]}</span>
                <span className="se-navbar__link-label">{label}</span>
              </Link>
            ))}
          </nav>

          {/* Live impact ticker */}
          {liveCount !== null && liveCount > 0 && (
            <Link to="/food-donations" className="se-navbar__ticker" title="Food available right now">
              <span className="se-navbar__ticker-dot" aria-hidden="true" />
              🍽️ {liveCount} listing{liveCount !== 1 ? 's' : ''} live
            </Link>
          )}

          {/* Right Controls */}
          <div className="se-navbar__controls">
            {/* Language */}
            <div className="se-lang-switcher" role="group" aria-label="Language">
              {LANGS.map(l => (
                <button
                  key={l}
                  className={`se-lang-btn${lang === l ? ' active' : ''}`}
                  onClick={() => setLanguage(l)}
                  aria-pressed={lang === l}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>

            {/* Theme */}
            <button
              className="se-theme-btn"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Auth */}
            {user ? (
              <div className="se-user-menu" ref={userMenuRef}>
                <button
                  className="se-user-btn"
                  onClick={() => setUserMenuOpen(p => !p)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="se-user-avatar">
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="se-user-name">{(user.name || user.email || '').split(' ')[0]}</span>
                  <span className="se-user-chevron">{userMenuOpen ? '▲' : '▼'}</span>
                </button>
                {userMenuOpen && (
                  <div className="se-user-dropdown" role="menu">
                    <div className="se-user-dropdown__info">
                      <p className="dropdown-name">{user.name || user.email}</p>
                      <p className="dropdown-role">{user.role}</p>
                    </div>
                    <Link
                      to={getDashboardPath()}
                      className="se-user-dropdown__item"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      {t('nav', 'dashboard')}
                    </Link>
                    <button
                      className="se-user-dropdown__item danger"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      {t('nav', 'logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="se-auth-btns">
                <button className="se-btn-login" onClick={() => setShowLogin(true)}>
                  {t('nav', 'login')}
                </button>
                <button className="se-btn-signup" onClick={() => setShowSignup(true)}>
                  {t('nav', 'signup')}
                </button>
              </div>
            )}

            {/* Hamburger */}
            <button
              className={`se-hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(p => !p)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span className="se-hamburger__line" />
              <span className="se-hamburger__line" />
              <span className="se-hamburger__line" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`se-mobile-menu${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
          <nav className="se-mobile-menu__links">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`se-mobile-link${isActive(to) ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="se-mobile-menu__bottom">
            <div className="se-mobile-lang">
              {LANGS.map(l => (
                <button
                  key={l}
                  className={`se-lang-btn${lang === l ? ' active' : ''}`}
                  onClick={() => setLanguage(l)}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
              <button className="se-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
            {user ? (
              <div className="se-mobile-user">
                <p className="mobile-user-name">{user.name || user.email}</p>
                <p className="mobile-user-role">{user.role}</p>
                <Link
                  to={getDashboardPath()}
                  className="se-btn-signup"
                  style={{ display: 'block', textAlign: 'center', marginBottom: '8px' }}
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav', 'dashboard')}
                </Link>
                <button className="se-btn-logout-mobile" onClick={handleLogout}>
                  {t('nav', 'logout')}
                </button>
              </div>
            ) : (
              <div className="se-mobile-auth">
                <button
                  className="se-btn-login"
                  onClick={() => { setMenuOpen(false); setShowLogin(true); }}
                >
                  {t('nav', 'login')}
                </button>
                <button
                  className="se-btn-signup"
                  onClick={() => { setMenuOpen(false); setShowSignup(true); }}
                >
                  {t('nav', 'signup')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLoginSuccess={handleLoginSuccess}
          onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }}
          onForgotPassword={() => { setShowLogin(false); setShowForgot(true); }}
        />
      )}
      {showSignup && (
        <SignupModal
          onClose={() => setShowSignup(false)}
          onSignupSuccess={handleSignupSuccess}
          onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }}
        />
      )}
      {showForgot && (
        <ForgotPasswordModal
          onClose={() => setShowForgot(false)}
          onBackToLogin={() => { setShowForgot(false); setShowLogin(true); }}
        />
      )}
      {showVerification && pendingSignup && (
        <VerificationModal
          email={pendingSignup.email}
          userId={pendingSignup.user_id}
          password={pendingSignup.password}
          role={pendingSignup.role}
          onClose={() => setShowVerification(false)}
          onVerified={handleVerificationSuccess}
        />
      )}
    </>
  );
}
