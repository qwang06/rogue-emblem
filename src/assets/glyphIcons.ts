// Icon id -> URL of its painted icon in src/assets/glyphs/ (one 16x16 PNG
// per GlyphIcon or StatIcon kind, named by kind; see the tileset skill).
// Only the React UI shows these, so they stay out of SPRITE_URLS, which
// GridScene preloads.

const files = import.meta.glob<string>('./glyphs/*.png', { eager: true, import: 'default' });

export const GLYPH_ICON_URLS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice('./glyphs/'.length, -'.png'.length), url]),
  ),
);
