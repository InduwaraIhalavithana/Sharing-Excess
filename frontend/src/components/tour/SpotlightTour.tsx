import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export interface TourStep {
  /** Matches a `data-tour="..."` attribute somewhere on the page. */
  target: string;
  title: string;
  body: string;
}

export interface TourLabels {
  skip: string;
  back: string;
  next: string;
  done: string;
}

interface Props {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  labels: TourLabels;
}

/** First element carrying the target that is actually on the page (not a closed off-canvas menu). */
function getVisibleTarget(target: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
}

/**
 * Spotlight tour: dims the page, cuts a hole around the current target and shows a card.
 * Opened manually from the "Need help?" button. Steps whose target is not on screen right
 * now (an inactive tab, an empty list) are skipped instead of pointing at nothing.
 */
export default function SpotlightTour({ steps, open, onClose, labels }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const visibleSteps = useMemo(() => {
    if (!open) return steps;
    const filtered = steps.filter((s) => getVisibleTarget(s.target));
    return filtered.length > 0 ? filtered : steps;
  }, [open, steps]);

  const step = open ? visibleSteps[stepIndex] : null;

  const close = useCallback(() => {
    setStepIndex(0);
    onClose();
  }, [onClose]);

  const recompute = useCallback(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const el = getVisibleTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Scroll the target into view, then re-measure while the page settles (animations, smooth scroll)
  useEffect(() => {
    if (!open || !step) return;
    getVisibleTarget(step.target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const raf = requestAnimationFrame(recompute);
    const timers = [100, 250, 400, 700, 1100].map((ms) => setTimeout(recompute, ms));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [open, stepIndex, step, recompute]);

  useEffect(() => {
    if (!open) return;
    const onReflow = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recompute);
    };
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, recompute]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !step) return null;

  const isLast = stepIndex === visibleSteps.length - 1;
  const margin = 16;
  const tooltipWidth = Math.min(320, window.innerWidth - margin * 2);

  const hole: CSSProperties | undefined = rect
    ? { top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }
    : undefined;

  let tooltip: CSSProperties;
  if (rect) {
    const below = window.innerHeight - (rect.top + rect.height);
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - tooltipWidth - margin);
    if (below > 220) tooltip = { top: rect.top + rect.height + margin, left };
    else if (rect.top > 220) tooltip = { bottom: window.innerHeight - rect.top + margin, left };
    else tooltip = { bottom: margin, left }; // target fills the screen: sit over its lower edge
  } else {
    tooltip = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  // Portaled to <body> so page entrance animations (which create containing blocks for
  // position:fixed) cannot misplace the overlay. The layer ignores pointer events, so the
  // highlighted element stays clickable; only Esc / Skip / Done close it.
  return createPortal(
    <div className="tour-layer">
      {hole && <div className="tour-hole" style={hole} />}
      <div className="tour-tooltip" style={{ ...tooltip, width: tooltipWidth }} role="dialog" aria-live="polite">
        <div className="tour-tooltip__dots">
          {visibleSteps.map((s, i) => (
            <span key={s.target} className={`tour-tooltip__dot${i === stepIndex ? ' tour-tooltip__dot--active' : ''}`} />
          ))}
        </div>
        <div className="tour-tooltip__title">{step.title}</div>
        <div className="tour-tooltip__body">{step.body}</div>
        <div className="tour-tooltip__actions">
          <button type="button" className="tour-tooltip__skip" onClick={close}>
            {labels.skip}
          </button>
          <div className="tour-tooltip__nav">
            {stepIndex > 0 && (
              <button type="button" className="tour-tooltip__back" onClick={() => setStepIndex((i) => i - 1)}>
                {labels.back}
              </button>
            )}
            <button
              type="button"
              className="tour-tooltip__next"
              onClick={() => (isLast ? close() : setStepIndex((i) => i + 1))}
            >
              {isLast ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
