import { describe, expect, it } from 'vitest';
import { locate, PLACES } from './sriLankaPlaces';

describe('locate()', () => {
  it('finds a town inside a full address', () => {
    expect(locate('45 Galle Road, Colombo 03')?.name).toBe('Colombo');
  });

  it('is case-insensitive and ignores punctuation', () => {
    expect(locate('  KANDY, Sri Lanka ')?.name).toBe('Kandy');
  });

  it('prefers the longer, more specific name', () => {
    expect(locate('Hotel near Nuwara Eliya town')?.name).toBe('Nuwara Eliya');
    expect(locate('Mount Lavinia beach')?.name).toBe('Mount Lavinia');
  });

  it('does not match a name that is only part of another word', () => {
    expect(locate('Ellaville Road')).toBeNull(); // "Ella" must be a whole word
  });

  it('returns null for empty or unknown locations', () => {
    expect(locate('')).toBeNull();
    expect(locate(null)).toBeNull();
    expect(locate('Somewhere unknown')).toBeNull();
  });

  it('only contains coordinates inside Sri Lanka', () => {
    for (const p of PLACES) {
      expect(p.lat).toBeGreaterThan(5.8);
      expect(p.lat).toBeLessThan(9.9);
      expect(p.lng).toBeGreaterThan(79.4);
      expect(p.lng).toBeLessThan(82.0);
    }
  });
});
