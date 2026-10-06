import { useEffect, useRef, useState } from 'react';

// Open/closed state for a button with a panel that drops from it
// (HeaderPopover, InfoPopover). While open, a click outside `rootRef`'s
// element or Esc closes it.
export function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Phaser listens on window, so this Esc only closes the panel rather
      // than also cancelling on the map.
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return { open, setOpen, rootRef };
}
