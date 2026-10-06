import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePopover } from './usePopover.ts';

// Space kept between the panel and the window's edge.
const EDGE_GAP = 8;

// A small "i" button beside a form label that opens an explanation of the
// setting. It closes on a second click, a click elsewhere, or Esc. The
// panel drops below the button, shifted left if it would run off the window.
export function InfoPopover({ title, children }: { title: string; children: ReactNode }) {
  const { open, setOpen, rootRef } = usePopover<HTMLDivElement>();
  const panelRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const { left, right } = panelRef.current.getBoundingClientRect();
    const overflow = right - shift - (document.documentElement.clientWidth - EDGE_GAP);
    // Never past the left edge either.
    setShift(Math.max(0, Math.min(overflow, left - shift - EDGE_GAP)));
    // Only on opening: measuring again after the shift would undo it.
  }, [open]);

  return (
    <div className="info-popover" ref={rootRef}>
      <button
        type="button"
        className="info-popover__button"
        aria-label={`About ${title}`}
        title={`About ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        i
      </button>
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="info-popover__panel"
          role="note"
          aria-label={title}
          style={{ transform: `translateX(${-shift}px)` }}
        >
          <strong className="info-popover__title">{title}</strong>
          {children}
        </div>
      )}
    </div>
  );
}
