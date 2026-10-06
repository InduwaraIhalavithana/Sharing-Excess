import { describe, expect, it } from 'vitest';
import translations from './translations';

type Dict = Record<string, Record<string, Record<string, string>>>;
const dict = translations as unknown as Dict;

// Every source file of the app as text (Vite inlines them, so this needs no Node file APIs).
const files = import.meta.glob('../**/*.{js,jsx,ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const appFiles = Object.entries(files).filter(([path]) => !/\.test\.|translations\.js|redesign\.js/.test(path));

/** Every literal t('section', 'key') in the app, plus the keys that are built at run time. */
function usedKeys(): [string, string][] {
  const found = new Set<string>();
  const re = /\bt\(\s*'([a-z_]+)'\s*,\s*'([A-Za-z_0-9]+)'/g;
  for (const [, text] of appFiles) {
    for (const m of text.matchAll(re)) found.add(`${m[1]}.${m[2]}`);
  }
  const dynamic: Record<string, string[]> = {
    status: ['active', 'sold_out', 'expired', 'closed', 'pending', 'accepted', 'declined', 'cancelled', 'collected', 'completed', 'no_show',
      'approved', 'rejected', 'published', 'open', 'actioned', 'dismissed', 'resolved', 'suspended'],
    cat: ['cooked_meals', 'rice_grains', 'vegetables_fruits', 'bakery', 'dairy_eggs', 'packaged', 'beverages', 'other'],
    unit: ['kg', 'g', 'l', 'ml', 'packs', 'packets', 'portions', 'pieces', 'boxes', 'loaves', 'meals'],
    etype: ['food_drive', 'volunteering', 'distribution', 'awareness', 'workshop', 'other'],
    prox: ['same_district', 'neighbouring', 'other'],
    role: ['donor', 'recipient', 'ngo', 'admin'],
    food: ['pickup', 'delivery', 'delivery_or_pickup'],
    calendar: ['expires', 'best_before'],
    admin: ['overview', 'ngos', 'listings', 'events', 'reports', 'users', 'feedback'].map((k) => `nav_${k}`),
  };
  for (const [section, keys] of Object.entries(dynamic)) keys.forEach((k) => found.add(`${section}.${k}`));
  // guided tours: data-tour="x" -> x_title / x_body
  const tours = appFiles.find(([path]) => path.endsWith('tour/TourKit.tsx'))?.[1] ?? '';
  const block = tours.slice(tours.indexOf('export const TOURS'), tours.indexOf('} as const'));
  for (const m of block.matchAll(/'([a-z]+-[a-z-]+)'/g)) {
    const base = m[1].replace(/-/g, '_');
    found.add(`tour.${base}_title`);
    found.add(`tour.${base}_body`);
  }
  return [...found].map((k) => k.split('.') as [string, string]);
}

describe('translations', () => {
  const keys = usedKeys();

  it('finds the keys the app uses', () => {
    expect(keys.length).toBeGreaterThan(300);
  });

  for (const lang of ['en', 'si', 'ta']) {
    it(`has every key the app uses in ${lang}`, () => {
      const missing = keys.filter(([s, k]) => !dict[lang]?.[s]?.[k]).map(([s, k]) => `${s}.${k}`);
      expect(missing).toEqual([]);
    });
  }
});
