import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('./rewards/', import.meta.url);

// The reward kinds whose card shows a reward icon; a recruit shows its unit,
// and supplies, arms and a seal their item's icon.
const KINDS = ['draft', 'rest', 'relic', 'gold', 'lesson', 'scroll'];

describe('reward icons', () => {
  it('has an icon for every reward kind without an item or unit, and no others', () => {
    expect(KINDS.filter((kind) => !existsSync(new URL(`${kind}.png`, dir)))).toEqual([]);
    const files = readdirSync(dir).map((file) => file.replace(/\.png$/, ''));
    expect(files.filter((file) => !KINDS.includes(file))).toEqual([]);
  });
});
