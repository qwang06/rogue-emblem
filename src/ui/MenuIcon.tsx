import { GlyphIcon, type GlyphKind } from './GlyphIcon.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';

// The icon in front of a map menu entry (the action, pause, deployment
// and camp menus), by
// the entry's id: a sword to Attack, a spark for Skill, a satchel for Item,
// an hourglass to Wait, a heart to Heal; a flag to End Turn, an arrow to
// Undo, a house for the Main Menu and a gear for Settings; a boot to
// Place Units and crossed swords to Start the battle; at camp, a pair of
// heads for the roster, a coin for the Merchant, an arrow up to Promote, a
// heart to Rest, a book for Mentors and a boot to march on. An entry with
// no icon keeps the spot, so labels line up.
const ICONS: Readonly<Record<string, { stat: StatIconKind } | { glyph: GlyphKind }>> = {
  attack: { stat: 'attack' },
  heal: { stat: 'health' },
  skill: { glyph: 'skill' },
  item: { glyph: 'item' },
  wait: { glyph: 'wait' },
  'end-turn': { glyph: 'seize' },
  undo: { glyph: 'undo' },
  'main-menu': { glyph: 'home' },
  settings: { glyph: 'settings' },
  'place-units': { glyph: 'move' },
  start: { glyph: 'rout' },
  // The camp (getCampActions).
  roster: { glyph: 'roster' },
  merchant: { glyph: 'gold' },
  promote: { glyph: 'promote' },
  rest: { stat: 'health' },
  mentors: { glyph: 'book' },
  march: { glyph: 'move' },
};

export function MenuIcon({ id }: { id: string }) {
  const icon = ICONS[id];
  if (!icon) return <span className="menu-icon" />;
  return (
    <span className="menu-icon">
      {'stat' in icon ? <StatIcon kind={icon.stat} /> : <GlyphIcon kind={icon.glyph} />}
    </span>
  );
}
