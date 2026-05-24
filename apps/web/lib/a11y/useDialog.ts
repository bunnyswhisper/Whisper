'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type UseDialogOptions = {
  open: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  /** When set, applied as aria-labelledby on the dialog panel */
  labelId?: string;
};

export type DialogA11yProps = {
  ref: RefObject<HTMLDivElement | null>;
  role: 'dialog';
  'aria-modal': true;
  'aria-labelledby'?: string;
};

/**
 * Focus trap, Escape to close, body scroll lock, and focus restore for modal dialogs.
 */
export function useDialog({
  open,
  onClose,
  closeOnEscape = true,
  labelId,
}: UseDialogOptions): { panelRef: RefObject<HTMLDivElement | null>; dialogProps: DialogA11yProps } {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const onCloseStable = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      nodes[0]?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseStable();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, onCloseStable]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const nodes = Array.from(
        panel!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const dialogProps: DialogA11yProps = {
    ref: panelRef,
    role: 'dialog',
    'aria-modal': true,
    ...(labelId ? { 'aria-labelledby': labelId } : {}),
  };

  return { panelRef, dialogProps };
}
