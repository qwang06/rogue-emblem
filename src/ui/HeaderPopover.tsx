import { useId, type ReactNode } from 'react';
import { usePopover } from './usePopover.ts';

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
  const { open, setOpen, rootRef } = usePopover<HTMLDivElement>();
  const panelId = useId();

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
