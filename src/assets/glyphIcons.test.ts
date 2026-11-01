import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('./glyphs/', import.meta.url);

// Every GlyphKind and every StatIconKind but health (a stat boon icon): the
// painted art GlyphIcon and StatIcon show over their 8x8 bitmaps.
const KINDS = [
  ...['auto', 'danger', 'settings', 'home', 'skill', 'item', 'wait', 'undo'],
  ...['roster', 'promote', 'book', 'rout', 'seize', 'boss', 'survive', 'turn'],
  ...['gold', 'lock', 'check', 'skull', 'mp', 'exp', 'move', 'range', 'weight', 'uses'],
  ...['attack', 'avoid', 'hit', 'crit'],
];

describe('glyph icons', () => {
  it('has art for every glyph and stat icon, and no others', () => {
    const files = readdirSync(dir).map((file) => file.replace(/\.png$/, ''));
    expect(KINDS.filter((kind) => !files.includes(kind))).toEqual([]);
    expect(files.filter((file) => !KINDS.includes(file))).toEqual([]);
  });

  it('paints each icon at 16x16', () => {
    for (const file of readdirSync(dir)) {
      const png = readFileSync(new URL(file, dir));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([16, 16]);
    }
  });
});
