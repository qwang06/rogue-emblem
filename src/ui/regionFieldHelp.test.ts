import { describe, expect, it } from 'vitest';
import { FIELD_HELP } from './regionFieldHelp.tsx';

// Every setting the Regions form has a field for (size pairs are
// explained with their counts).
const EXPLAINED = [
  'stagesPerRegion',
  'name',
  'description',
  'width',
  'height',
  'palette',
  'treeChance',
  'turnChance',
  'castle',
  'lakes',
  'mountains',
  'forests',
  'meadows',
  'ruins',
  'buildings',
  'enemies',
  'count',
  'minDistance',
  'maxDistance',
  'health',
  'x',
  'y',
];

describe('FIELD_HELP', () => {
  it.each(EXPLAINED)('explains %s', (key) => {
    expect(FIELD_HELP[key]?.title).toBeTruthy();
    expect(FIELD_HELP[key]?.body).toBeTruthy();
  });

  it('explains width and height together', () => {
    expect(FIELD_HELP.height).toBe(FIELD_HELP.width);
  });
});
