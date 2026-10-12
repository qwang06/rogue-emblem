// Small pixel icons that head a stat column, as on the GBA's item and
// battle windows: a sword for attack, a heart for health, a shield for
// avoid, a crosshair for hit and a star for crits. Each is an 8x8 bitmap
// drawn as SVG squares, so it stays crisp at any whole-pixel scale and
// takes its colors from the theme.

export type StatIconKind = 'attack' | 'health' | 'avoid' | 'hit' | 'crit';

// One string per row; '.' is empty, other letters pick a color class.
const ICONS: Record<StatIconKind, readonly string[]> = {
  attack: ['......lb', '.....lbl', '....lbl.', '.g.lbl..', '..gbl...', '..dg....', '.d..g...', 'd.......'],
  health: ['.rr..rr.', 'rwrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '........'],
  avoid: ['bbbbbbbb', 'bwwwwwwb', 'bwlllllb', 'bwlllllb', '.bllllb.', '.bllllb.', '..bllb..', '...bb...'],
  hit: ['...dd...', '..d..d..', '.d....d.', 'dd.rr.dd', 'dd.rr.dd', '.d....d.', '..d..d..', '...dd...'],
  crit: ['...gg...', '...gg...', 'gggggggg', '.gggggg.', '..gggg..', '.gg..gg.', '.g....g.', '........'],
};

export function StatIcon({ kind }: { kind: StatIconKind }) {
  const cells = ICONS[kind].flatMap((row, y) =>
    [...row].map((color, x) =>
      color === '.' ? null : (
        <rect key={`${x},${y}`} className={`stat-icon__${color}`} x={x} y={y} width={1} height={1} />
      ),
    ),
  );
  return (
    <svg className="stat-icon" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {cells}
    </svg>
  );
}
