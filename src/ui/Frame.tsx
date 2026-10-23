import type { ElementType, ComponentPropsWithoutRef } from 'react';
import type { Team } from '../game/turns.ts';

// The window box every menu and panel sits in: parchment in a dark brown
// frame with gold corner plates, or a blue / red / green banner for phase
// and turn readouts. The look lives in ui.css (`.frame`); this only picks
// the class.
export type FrameVariant = 'parchment' | 'banner' | 'banner-red' | 'banner-green';

// Each side's banner: blue for the player, red for the enemy, green for the
// guests.
export const TEAM_BANNERS: Readonly<Record<Team, FrameVariant>> = Object.freeze({
  player: 'banner',
  enemy: 'banner-red',
  guest: 'banner-green',
});

type FrameProps<T extends ElementType> = {
  as?: T;
  variant?: FrameVariant;
} & ComponentPropsWithoutRef<T>;

export function Frame<T extends ElementType = 'section'>({
  as,
  variant = 'parchment',
  className,
  ...rest
}: FrameProps<T>) {
  const Tag: ElementType = as ?? 'section';
  const classes = ['frame', variant === 'parchment' ? '' : `frame--${variant}`, className].filter(Boolean).join(' ');
  return <Tag className={classes} {...rest} />;
}
