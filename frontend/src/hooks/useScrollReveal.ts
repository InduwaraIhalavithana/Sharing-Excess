import { useEffect } from 'react';

// Public, content-style pages only. Dashboards, forms and the home page (which has its own <Reveal>) are left alone.
const PAGES = ['/about', '/ngos', '/post-food', '/events', '/contact', '/feedback', '/food', '/privacy', '/terms'];

const SELECTOR = [
  '.app-content .card',
  '.app-content .about-section',
  '.app-content .about-timeline__item',
  '.app-content .ngos-card',
  '.app-content .event-card',
  '.app-content .contact-info-card',
  '.app-content .feedback-stat-item',
  '.app-content .donate-impact__stat',
  '.app-content .events-hero__stat',
  '.app-content .dd-card',
  '.app-content .se-listing',
].join(',');

/**
 * Fades blocks up as they scroll into view. Elements are tagged with a data attribute
 * (React never touches it), revealed by an IntersectionObserver, and un-tagged afterwards so their
 * normal hover transitions take over. A timer reveals everything if the observer never fires.
 */
export function useScrollReveal(pathname: string) {
  useEffect(() => {
    if (!PAGES.includes(pathname)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.querySelector('.app-content');
    if (!root) return;

    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.setAttribute('data-rv', 'in');
          io.unobserve(el);
          window.setTimeout(() => el.removeAttribute('data-rv'), 1100);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );

    let index = 0;
    const scan = () => {
      root.querySelectorAll(SELECTOR).forEach((el) => {
        if (seen.has(el) || el.closest('.se-reveal') || el.closest('[role="dialog"]')) return;
        seen.add(el);
        (el as HTMLElement).style.setProperty('--rv-d', `${(index++ % 4) * 70}ms`);
        el.setAttribute('data-rv', '1');
        io.observe(el);
      });
    };

    // Lazy routes and API data mount after the first render, so keep scanning for new blocks.
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    scan();
    const fallback = window.setTimeout(() => {
      root.querySelectorAll('[data-rv="1"]').forEach((el) => el.setAttribute('data-rv', 'in'));
    }, 3500);

    return () => {
      mo.disconnect();
      io.disconnect();
      window.clearTimeout(fallback);
      root.querySelectorAll('[data-rv]').forEach((el) => el.removeAttribute('data-rv'));
    };
  }, [pathname]);
}
