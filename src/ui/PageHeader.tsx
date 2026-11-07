import type { ReactNode } from 'react';
// The status strip across the top of the page: whatever status the current
// phase shows (`children`) on the left, where the eye starts, and `actions`
// (the small buttons) at the far right. No wordmark: the title screen
// carries the game's name, and the strip's job is the battle's state. The
// status is a live region, so screen readers announce phase changes.
export function PageHeader({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__status" aria-live="polite">
        {children}
      </div>
      <div className="page-header__end">{actions}</div>
    </header>
  );
}
