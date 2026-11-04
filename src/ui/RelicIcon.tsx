import { getRelicIconUrl } from '../assets/fantasyIcons.ts';
import { KEYSTONE_ICON_URLS } from '../assets/keystoneIcons.ts';

// A relic's icon (RELIC_ICONS), or with `keystoneId` that keystone's
// (KEYSTONE_ICON_URLS), at 32x32, 2 CSS px per art pixel. One without an
// icon keeps the space, so a list's names still line up.
export function RelicIcon({ id, keystoneId, className = '' }: { id: string; keystoneId?: string; className?: string }) {
  const url = keystoneId ? (KEYSTONE_ICON_URLS[keystoneId] ?? null) : getRelicIconUrl(id);
  const classes = `relic-icon ${className}`.trim();
  if (!url) return <span className={classes} aria-hidden="true" />;
  return <img className={classes} src={url} alt="" aria-hidden="true" width={32} height={32} />;
}
