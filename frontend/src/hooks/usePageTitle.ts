import { useEffect } from 'react';

const SITE = 'Sharing Excess';

const TITLES: Record<string, string> = {
  '/': 'Reduce Food Waste, Feed the Hungry',
  '/about': 'About',
  '/ngos': 'Partner NGOs',
  '/post-food': 'Share Food',
  '/events': 'Events',
  '/food': 'Find Food',
  '/calendar': 'Calendar',
  '/contact': 'Contact',
  '/feedback': 'Feedback',
  '/account': 'Account Settings',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Use',
  '/donor-dashboard': 'Donor Dashboard',
  '/recipient-dashboard': 'Recipient Dashboard',
  '/ngo-dashboard': 'NGO Dashboard',
  '/admin': 'Admin Panel',
};

/** Sets document.title from the current route so browser tabs and history are readable. */
export function usePageTitle(pathname: string) {
  useEffect(() => {
    const page = TITLES[pathname]
      ?? (pathname.startsWith('/listings/') ? 'Food listing' : pathname.startsWith('/profile/') ? 'Profile' : 'Page not found');
    document.title = `${page} | ${SITE}`;
  }, [pathname]);
}
