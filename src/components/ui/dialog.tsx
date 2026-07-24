import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export interface DialogHeaderProps {
  children: React.ReactNode;
}

export interface DialogTitleProps {
  children: React.ReactNode;
}

export interface DialogDescriptionProps {
  children: React.ReactNode;
}

/** Lets DialogContent render the Close button without threading the handler. */
const DialogCloseContext = React.createContext<() => void>(() => {});

/**
 * Backdrop + centering + Escape/outside-click close. Portaled to <body> so a
 * transformed/overflow ancestor (framer-motion, the builder panels) can't
 * mis-position or clip the modal. The panel itself — including its width — is
 * `DialogContent`, so callers control the size via its className.
 */
export const Dialog: React.FC<DialogProps> = ({ open = false, onOpenChange, children }) => {
  const close = React.useCallback(() => onOpenChange?.(false), [onOpenChange]);

  // Escape closes the dialog. Hooks run unconditionally — the early return
  // below stays after them.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={close}
      role="presentation"
    >
      <DialogCloseContext.Provider value={close}>{children}</DialogCloseContext.Provider>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
};

/**
 * The modal panel. Width/height come from `className` (e.g. `max-w-4xl`); the
 * base default is `max-w-md`. `cn` (tailwind-merge) dedupes conflicting
 * `max-w-*`/`max-h-*` so the caller's class wins — plain concatenation left both
 * classes and Tailwind v4's order let the base `max-w-md` win. Scrolls past 90vh.
 */
export const DialogContent: React.FC<DialogContentProps> = ({ className = '', children, ...rest }) => {
  const close = React.useContext(DialogCloseContext);
  return (
    <div
      {...rest}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-6 text-foreground shadow-lg',
        className,
      )}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {children}
    </div>
  );
};

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => (
  <div className="mb-4 pr-8">
    {children}
  </div>
);

export const DialogTitle: React.FC<DialogTitleProps> = ({ children }) => (
  <h2 className="text-lg font-semibold">
    {children}
  </h2>
);

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children }) => (
  <p className="text-sm text-muted-foreground mt-1">
    {children}
  </p>
);

export interface DialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ className = '', children }) => (
  <div className={`mt-6 flex justify-end gap-2 ${className}`}>
    {children}
  </div>
);

export interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const DialogTrigger: React.FC<DialogTriggerProps> = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
);
