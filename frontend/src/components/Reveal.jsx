import { useEffect, useRef, useState } from 'react';

/**
 * Fade-up-on-scroll wrapper. Children stay hidden until the block enters
 * the viewport, then animate in once. Falls back to visible after 1.2s
 * in case the observer never fires (e.g. background tabs).
 */
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShown(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    const fallback = setTimeout(() => setShown(true), 1200 + delay);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`se-reveal${shown ? ' se-reveal--in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
