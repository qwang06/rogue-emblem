import type { ReactNode } from 'react';

// The frame every config editor page shares: a full-page, scrolling cover
// with a title, a line about the page, and a link back (to the game from
// the index, to the index from a config's page). `underHeader` starts the
// cover below the page header instead of over it, so the header's buttons
// (Main Menu among them) stay in reach.
export function ConfigLayout({
  title,
  lede,
  back,
  underHeader = false,
  children,
}: {
  title: string;
  lede: string;
  back: { href: string; label: string };
  underHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={underHeader ? 'configs-page configs-page--under-header' : 'configs-page'}>
      <header className="configs-page__header">
        <div>
          <h1 className="configs-page__title">{title}</h1>
          <p className="configs-page__lede">{lede}</p>
        </div>
        <a className="header-button configs-page__back" href={back.href}>
          {back.label}
        </a>
      </header>
      {children}
    </div>
  );
}
