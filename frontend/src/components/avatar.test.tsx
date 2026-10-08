import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './ui';

describe('Avatar', () => {
  it('shows the first letter when there is no photo', () => {
    const { container } = render(<Avatar src={null} name="lanka bakers" />);
    expect(container.textContent).toBe('L');
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the photo, and falls back to the letter if it fails to load', () => {
    const { container } = render(<Avatar src="/uploads/a.webp" name="Hope Elders" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('H')).toBeTruthy();
  });
});
