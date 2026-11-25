import { useEffect, useRef, type ReactNode } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}

/**
 * Accessible 480px slide-over drawer with Escape handling, backdrop dismissal,
 * and focus management (moves focus in on open and restores trigger focus on close).
 */
export function Drawer({ isOpen, onClose, labelledBy, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-pitch/25"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-[480px] bg-surface border-l border-outline h-screen p-32 flex flex-col justify-between gap-20 overflow-y-auto focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}
