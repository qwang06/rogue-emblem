import type { ReactNode } from 'react';

// The frame every config editor page shares: a full-page, scrolling cover
// with a title, a line about the page, and a link back (to the game from
// the index, to the index from a config's page).
export function ConfigLayout({
  title,
  lede,
  back,
  children,
}: {
  title: string;
  lede: string;
  back: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="configs-page">
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
