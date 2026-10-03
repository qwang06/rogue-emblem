import { useEffect, useRef, useState } from 'react';

// Header button that opens the settings panel. There are no settings yet, so
// the panel is a placeholder; it doesn't touch the game. Closes on a second
// click, a click elsewhere, or Esc.
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
    <div className="settings" ref={rootRef}>
      <button
        type="button"
        className="header-button"
        aria-expanded={open}
        aria-controls="settings-panel"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        Settings
      </button>
      {open && (
        <section id="settings-panel" className="panel settings__panel" aria-label="Settings">
          <h2 className="settings__title">Settings</h2>
          <p className="settings__empty">Nothing to adjust yet.</p>
        </section>
      )}
    </div>
  );
}
