import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import Toast from './Toast';

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('shows the message and dismisses itself', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast msg="Saved!" onDone={onDone} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved!');
    act(() => {
      vi.advanceTimersByTime(3300);
    });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('uses the error style when asked', () => {
    render(<Toast msg="Nope" type="error" onDone={() => {}} />);
    expect(screen.getByRole('status')).toHaveClass('dd-toast--error');
  });
});

describe('ErrorBoundary', () => {
  it('renders children normally', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows a friendly fallback instead of a blank page when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Bomb = () => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
