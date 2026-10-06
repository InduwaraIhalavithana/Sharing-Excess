import { useEffect } from 'react';

export type ToastType = 'success' | 'error';

export interface ToastState {
  msg: string;
  type?: ToastType;
}

interface ToastProps extends ToastState {
  onDone: () => void;
}

/** Self-dismissing message pill. Pages keep `const [toast, setToast] = useState<ToastState | null>(null)`. */
export default function Toast({ msg, type = 'success', onDone }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(onDone, 3200);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className={`dd-toast dd-toast--${type}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
