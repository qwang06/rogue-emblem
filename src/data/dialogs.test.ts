import { describe, expect, it } from 'vitest';
import { SPRITE_URLS } from '../assets/sprites.ts';
import { createDialog } from '../game/dialog.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { CHARACTERS, DIALOGS } from './dialogs.ts';

// Importing dialogs.ts parses every dialog file, so a mistake in any of
// them fails this suite before the game ever shows it.
describe('DIALOGS', () => {
  it('loads every dialog file by name', () => {
    expect(Object.keys(DIALOGS).sort()).toEqual(expect.arrayContaining(['demo', 'training']));
  });

  it('gives the demo and training battles an opening', () => {
    expect(DIALOGS.demo.opening.length).toBeGreaterThan(0);
    expect(DIALOGS.training.opening.length).toBeGreaterThan(0);
  });

  it('only has conversations the dialog box can play', () => {
    for (const scripts of Object.values(DIALOGS)) {
      for (const lines of Object.values(scripts)) expect(() => createDialog(lines)).not.toThrow();
    }
  });
});

describe('CHARACTERS', () => {
  it('includes the demo roster', () => {
    expect(CHARACTERS.alden.name).toBe('Alden');
    expect(CHARACTERS.alden.team).toBe('player');
  });

  it('only names unit classes the game knows', () => {
    const known = UNIT_CLASSES.map((unitClass) => unitClass.id);
    for (const { unitClass } of Object.values(CHARACTERS)) {
      if (unitClass) expect(known).toContain(unitClass);
    }
  });

  it('only names portraits that are in SPRITE_URLS', () => {
    for (const { portrait } of Object.values(CHARACTERS)) {
      if (portrait) expect(SPRITE_URLS).toHaveProperty(portrait);
    }
  });
});
