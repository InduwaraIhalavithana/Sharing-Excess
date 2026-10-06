import { useEffect } from 'react';

const SITE = 'Sharing Excess';

const TITLES: Record<string, string> = {
  '/': 'Reduce Food Waste, Feed the Hungry',
  '/about': 'About',
  '/ngos': 'Partner NGOs',
  '/donate': 'Donate',
  '/events': 'Events',
  '/food-donations': 'Available Food',
  '/calendar': 'Calendar',
  '/contact': 'Contact',
  '/feedback': 'Feedback',
  '/account': 'Account Settings',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Use',
  '/donor-dashboard': 'Donor Dashboard',
  '/recipient-dashboard': 'Recipient Dashboard',
  '/admin': 'Admin Panel',
};

/** Sets document.title from the current route so browser tabs and history are readable. */
export function usePageTitle(pathname: string) {
  useEffect(() => {
    const page = TITLES[pathname] ?? 'Page not found';
    document.title = `${page} | ${SITE}`;
  }, [pathname]);
}
