import { GLYPH_ICON_URLS } from '../assets/glyphIcons.ts';
import { BOON_ICON_URLS } from '../assets/boonIcons.ts';
import { PixelArtIcon, PixelIcon } from './PixelIcon.tsx';

// Small pixel icons that head a stat column, as on the GBA's item and
// battle windows: a sword for attack, a heart for health, a shield for
// avoid, a crosshair for hit and a star for crits. Each is an 8x8 bitmap
// (see PixelIcon): blade, light, dark, gold, red and white.

export type StatIconKind = 'attack' | 'health' | 'avoid' | 'hit' | 'crit';

const ICONS: Record<StatIconKind, readonly string[]> = {
  attack: ['......lb', '.....lbl', '....lbl.', '.g.lbl..', '..gbl...', '..dg....', '.d..g...', 'd.......'],
  health: ['.rr..rr.', 'rwrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '........'],
  avoid: ['bbbbbbbb', 'bwwwwwwb', 'bwlllllb', 'bwlllllb', '.bllllb.', '.bllllb.', '..bllb..', '...bb...'],
  hit: ['...dd...', '..d..d..', '.d....d.', 'dd.rr.dd', 'dd.rr.dd', '.d....d.', '..d..d..', '...dd...'],
  crit: ['...gg...', '...gg...', 'gggggggg', '.gggggg.', '..gggg..', '.gg..gg.', '.g....g.', '........'],
};

// Drawn as its painted icon where it has one (health is the HP boon's
// heart), else as the bitmap.
export function StatIcon({ kind }: { kind: StatIconKind }) {
  const url = kind === 'health' ? BOON_ICON_URLS['stat-health'] : GLYPH_ICON_URLS[kind];
  return url ? (
    <PixelArtIcon url={url} className="stat-icon" />
  ) : (
    <PixelIcon rows={ICONS[kind]} className="stat-icon" />
  );
}
