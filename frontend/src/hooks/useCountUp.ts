import { useEffect, useState } from 'react';

/** Counts from 0 up to `target` once `active` turns true. Respects prefers-reduced-motion. */
export function useCountUp(target: number, duration = 1800, active = false): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCount(target);
      return;
    }
    let frame = 0;
    const total = Math.ceil(duration / 16);
    const step = target / total;
    const id = setInterval(() => {
      frame++;
      const next = Math.min(Math.round(step * frame), target);
      setCount(next);
      if (next >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration, active]);
  return count;
}
