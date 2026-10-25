import { getPixelArtSpans } from '../game/pixelShapes.ts';
import { RANK_BADGES } from '../game/tileset.ts';
import type { UnitRank } from '../game/Unit.ts';

const RANK_LABELS: Readonly<Record<UnitRank, string>> = { boss: 'Boss', elite: 'Elite' };

// The badge a boss or an elite wears on the map (RANK_BADGES), drawn as SVG
// squares so it stays crisp at any whole-pixel scale: `scale` CSS px per
// art pixel. Named for screen readers and on hover.
export function RankBadge({ rank, scale = 1, className = '' }: { rank: UnitRank; scale?: number; className?: string }) {
  const art = RANK_BADGES[rank];
  const width = Math.max(...art.rows.map((row) => row.length));
  const height = art.rows.length;
  const label = RANK_LABELS[rank];
  return (
    <svg
      className={`rank-badge rank-badge--${rank} ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {getPixelArtSpans(art).map(({ x, y, width: span, color }) => (
        <rect key={`${x},${y}`} x={x} y={y} width={span} height={1} fill={`#${color.toString(16).padStart(6, '0')}`} />
      ))}
    </svg>
  );
}

// What a rank reads as in words ("Boss", "Elite").
export function getRankLabel(rank: UnitRank): string {
  return RANK_LABELS[rank];
}
