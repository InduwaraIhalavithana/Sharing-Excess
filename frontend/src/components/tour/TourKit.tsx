import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import SpotlightTour, { type TourStep } from './SpotlightTour';

/** Which tour a page has. Each key lists the data-tour targets, in order. */
export const TOURS = {
  donor: ['donor-stats', 'donor-add', 'donor-tabs', 'donor-requests', 'user-menu'],
  recipient: ['recipient-stats', 'recipient-tabs', 'recipient-search', 'recipient-food', 'user-menu'],
  admin: ['admin-nav', 'admin-stats', 'admin-verify', 'admin-refresh'],
} as const;

export type TourName = keyof typeof TOURS;

/** `data-tour="x"` -> translation keys `x_title` / `x_body` (dashes become underscores). */
const keyOf = (target: string) => target.replace(/-/g, '_');

/**
 * One call gives a page everything the tour needs:
 *   const tour = useTour('donor');
 *   <TourKit tour={tour} />      // renders the help pill + the overlay
 */
export function useTour(name: TourName) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const steps: TourStep[] = useMemo(
    () => TOURS[name].map((target) => ({
      target,
      title: t('tour', `${keyOf(target)}_title`),
      body: t('tour', `${keyOf(target)}_body`),
    })),
    [name, t],
  );

  const labels = useMemo(
    () => ({ skip: t('tour', 'skip'), back: t('tour', 'back'), next: t('tour', 'next'), done: t('tour', 'done') }),
    [t],
  );

  return { open, setOpen, steps, labels, helpLabel: t('tour', 'help'), helpAria: t('tour', 'help_aria') };
}

export function TourKit({ tour }: { tour: ReturnType<typeof useTour> }) {
  const close = useCallback(() => tour.setOpen(false), [tour]);
  return (
    <>
      <button type="button" className="tour-help-btn" aria-label={tour.helpAria} onClick={() => tour.setOpen(true)}>
        <span aria-hidden="true">❓</span>
        <span className="tour-help-btn__label">{tour.helpLabel}</span>
      </button>
      <SpotlightTour steps={tour.steps} open={tour.open} onClose={close} labels={tour.labels} />
    </>
  );
}

export interface ChecklistItem {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

/**
 * Dismissible "Getting started" card. Completion comes from data the page already loaded;
 * only the dismissed flag is stored. It hides itself once everything is done.
 */
export function GettingStartedChecklist({ items, storageKey }: { items: ChecklistItem[]; storageKey: string }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const doneCount = items.filter((i) => i.done).length;
  if (dismissed || doneCount === items.length) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* private mode: just hide for this visit */
    }
    setDismissed(true);
  };

  return (
    <div className="getting-started-card">
      <div className="getting-started-card__header">
        <h2 className="getting-started-card__title">🚀 {t('tour', 'check_title')}</h2>
        <div className="getting-started-card__header-right">
          <span className="getting-started-card__count">{doneCount}/{items.length}</span>
          <button type="button" className="getting-started-card__dismiss" aria-label={t('tour', 'check_dismiss')} onClick={dismiss}>
            ✕
          </button>
        </div>
      </div>
      <div className="getting-started-card__progress-track">
        <div className="getting-started-card__progress-fill" style={{ width: `${(doneCount / items.length) * 100}%` }} />
      </div>
      <div className="getting-started-card__items">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.href}
            className={`getting-started-card__item${item.done ? ' getting-started-card__item--done' : ''}`}
          >
            <span className="getting-started-card__item-icon">{item.done ? '✓' : '○'}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
