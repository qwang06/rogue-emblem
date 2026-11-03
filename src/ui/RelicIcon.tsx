import { getRelicIconUrl } from '../assets/fantasyIcons.ts';

// A relic's icon (RELIC_ICONS) at 32x32, 2 CSS px per art pixel. A relic
// without one keeps the space, so a list's names still line up.
export function RelicIcon({ id, className = '' }: { id: string; className?: string }) {
  const url = getRelicIconUrl(id);
  const classes = `relic-icon ${className}`.trim();
  if (!url) return <span className={classes} aria-hidden="true" />;
  return <img className={classes} src={url} alt="" aria-hidden="true" width={32} height={32} />;
}
