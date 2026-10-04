import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

// A header button that drops a panel down over the page (Settings,
// Controls). The panel closes on a second click, a click elsewhere, or Esc.
// `button` is the button's content and `label` its accessible name, for
// buttons that show only an icon.
export function HeaderPopover({
  button,
  label,
  title,
  className = '',
  children,
}: {
  button: ReactNode;
  label?: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

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

  return (
    <div className="header-popover" ref={rootRef}>
      <button
        type="button"
        className={`header-button ${className}`.trim()}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {button}
      </button>
      {open && (
        <section id={panelId} className="panel header-popover__panel" aria-label={title}>
          <h2 className="header-popover__title">{title}</h2>
          {children}
        </section>
      )}
    </div>
  );
}
