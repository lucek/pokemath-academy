import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

let openModalCount = 0;
let previousBodyOverflow: string | null = null;

interface ModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  className?: string;
  label?: string;
  overlayClassName?: string;
}

export function Modal({
  isOpen,
  onRequestClose,
  children,
  className,
  label,
  overlayClassName,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = document.createElement('div');
    element.setAttribute('data-modal-portal', 'true');
    document.body.appendChild(element);
    setPortalElement(element);

    return () => {
      document.body.removeChild(element);
      setPortalElement(null);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Prevent background scroll while a modal is open; supports stacking.
    const { body } = document;
    if (openModalCount === 0) {
      previousBodyOverflow = body.style.overflow || null;
      body.style.overflow = 'hidden';
    }
    openModalCount += 1;

    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        body.style.overflow = previousBodyOverflow ?? '';
        previousBodyOverflow = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lastActiveElementRef.current = document.activeElement as HTMLElement | null;

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose();
      }
      if (event.key === 'Tab') {
        trapFocus(event);
      }
    }

    document.addEventListener('keydown', handleKeydown);
    focusFirstElement();

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      lastActiveElementRef.current?.focus?.();
    };
  }, [isOpen, onRequestClose]);

  function focusFirstElement() {
    const container = contentRef.current;
    if (!container) return;
    const focusables = getFocusableElements(container);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }
  }

  function trapFocus(event: KeyboardEvent) {
    const container = contentRef.current;
    if (!container) return;
    const focusables = getFocusableElements(container);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === overlayRef.current) {
      onRequestClose();
    }
  }

  function handleOverlayKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== overlayRef.current) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRequestClose();
    }
  }

  if (!isOpen || !portalElement) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="button"
      tabIndex={0}
      onMouseDown={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      className={cn(
        'fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6',
        overlayClassName,
      )}
      aria-label="Close dialog overlay"
      data-testid="modal-overlay"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? 'Dialog'}
        tabIndex={-1}
        className={cn(
          'relative flex h-full max-h-[calc(100vh-24px)] w-full flex-col overflow-y-auto rounded-none border border-white/10 bg-gradient-to-br from-[#050816] via-[#0c1224] to-[#050816] shadow-[0_30px_120px_rgba(0,0,0,0.6)] outline-none sm:h-auto sm:max-h-[90vh] sm:w-[90vw] sm:overflow-hidden sm:rounded-[32px] lg:w-[45vw]',
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute top-1/2 right-0 h-72 w-72 rounded-full bg-purple-500/10 blur-[140px]" />
        </div>
        <div className="relative flex h-full flex-col">{children}</div>
      </div>
    </div>,
    portalElement,
  );
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input[type="text"]:not([disabled])',
    'input[type="radio"]:not([disabled])',
    'input[type="checkbox"]:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const elements = Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
  return elements.filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}
