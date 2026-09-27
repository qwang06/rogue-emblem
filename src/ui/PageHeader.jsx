// The bar across the top of the battle page: the game's wordmark on the
// left, and whatever status the current phase shows (`children`) on the
// right, followed by `actions` (buttons). The status is a live region, so
// screen readers announce phase changes.
export function PageHeader({ children, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__brand">
        <span className="page-header__gem" aria-hidden="true">
          ◆
        </span>
        Rogue Emblem
      </div>
      <div className="page-header__end">
        <div className="page-header__status" aria-live="polite">
          {children}
        </div>
        {actions}
      </div>
    </header>
  );
}
