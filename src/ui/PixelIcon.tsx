// A small pixel icon drawn from a bitmap: one string per row, '.' empty and
// any other letter one square in that letter's color class
// (`pixel-icon__<letter>`, see ui.css). Drawn as SVG squares, so it stays
// crisp at any whole-pixel scale and takes its colors from the theme;
// `c` is the text color, so an icon on a button follows its hover and
// pressed states. StatIcon and GlyphIcon are built on it.
export function PixelIcon({ rows, className = '' }: { rows: readonly string[]; className?: string }) {
  const width = Math.max(...rows.map((row) => row.length));
  const cells = rows.flatMap((row, y) =>
    [...row].map((color, x) =>
      color === '.' ? null : (
        <rect key={`${x},${y}`} className={`pixel-icon__${color}`} x={x} y={y} width={1} height={1} />
      ),
    ),
  );
  return (
    <svg
      className={`pixel-icon ${className}`.trim()}
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {cells}
    </svg>
  );
}

// A painted 16x16 icon (GLYPH_ICON_URLS) in a PixelIcon's place: the same
// box and classes, so every size rule for the bitmap icons applies to it.
export function PixelArtIcon({ url, className = '' }: { url: string; className?: string }) {
  return <img className={`pixel-icon pixel-icon--art ${className}`.trim()} src={url} alt="" aria-hidden="true" />;
}
