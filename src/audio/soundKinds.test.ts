import { describe, expect, it } from 'vitest';
import { IRON_SHIELD, IRON_SWORD, LADDER_WEAPONS, WOODEN_DAGGER } from '../game/gearLadder.ts';
import type { Armor } from '../game/items.ts';
import { POWER_STRIKE, WING_BUFFET } from '../game/skills.ts';
import {
  BALLISTA,
  BITE,
  CLUB,
  FIRE,
  FIRE_BREATH,
  FIRE_SPELL,
  GREAT_AXE,
  IRON_AXE,
  IRON_BOW,
  IRON_SPEAR,
  LIGHT,
  POWDER_KEG,
  WOODEN_SWORD,
} from '../game/weapons.ts';
import { getGearSound, getSkillSound, getWeaponSound } from './soundKinds.ts';

const armor = (fields: Partial<Armor>): Armor => ({
  kind: 'armor',
  id: 'test',
  label: 'Test',
  slot: 'body',
  defense: 1,
  weight: 1,
  ...fields,
});

describe('getWeaponSound', () => {
  it('sounds like its family', () => {
    expect(getWeaponSound(IRON_SWORD)).toBe('sword');
    expect(getWeaponSound(IRON_SPEAR)).toBe('sword');
    expect(getWeaponSound(WOODEN_DAGGER)).toBe('sword');
    expect(getWeaponSound(IRON_AXE)).toBe('axe');
    expect(getWeaponSound(IRON_BOW)).toBe('bow');
    expect(getWeaponSound(BALLISTA)).toBe('bow');
  });

  it('casts a tome as fire or a shock', () => {
    expect(getWeaponSound(FIRE)).toBe('fire');
    expect(getWeaponSound(FIRE_SPELL)).toBe('fire');
    expect(getWeaponSound(LIGHT)).toBe('shock');
  });

  it('gives monsters and siege their own, and leaves teeth to the synthesized hit', () => {
    expect(getWeaponSound(CLUB)).toBe('hammer');
    expect(getWeaponSound(GREAT_AXE)).toBe('axe');
    expect(getWeaponSound(FIRE_BREATH)).toBe('fire');
    expect(getWeaponSound(POWDER_KEG)).toBe('fire');
    expect(getWeaponSound(BITE)).toBeNull();
    expect(getWeaponSound(null)).toBeNull();
  });

  it('has a sound for every ladder weapon', () => {
    for (const weapon of LADDER_WEAPONS) expect(getWeaponSound(weapon), weapon.id).not.toBeNull();
  });
});

describe('getSkillSound', () => {
  it("is the skill's own, else the user's weapon's", () => {
    expect(getSkillSound(WING_BUFFET, IRON_SWORD)).toBe('air');
    expect(getSkillSound(POWER_STRIKE, IRON_AXE)).toBe('axe');
    expect(getSkillSound(POWER_STRIKE, null)).toBeNull();
  });
});

describe('getGearSound', () => {
  it('rattles weapons, wooden ones softer', () => {
    expect(getGearSound(IRON_SWORD)).toBe('weapon');
    expect(getGearSound(WOODEN_SWORD)).toBe('wooden');
  });

  it('sounds armor by its weight and slot', () => {
    expect(getGearSound(armor({ slot: 'body', weightClass: 'heavy' }))).toBe('plate');
    expect(getGearSound(armor({ slot: 'head', weightClass: 'heavy' }))).toBe('chain');
    expect(getGearSound(armor({ slot: 'body', weightClass: 'light' }))).toBe('leather');
    expect(getGearSound(armor({ slot: 'body', weightClass: 'cloth' }))).toBe('robe');
    expect(getGearSound(armor({ slot: 'head', weightClass: 'cloth' }))).toBe('clothes');
    expect(getGearSound(IRON_SHIELD)).toBe('plate');
  });

  it('chimes trinkets', () => {
    expect(getGearSound(armor({ slot: 'accessory' }))).toBe('jewel');
    expect(getGearSound(armor({ slot: 'special' }))).toBe('jewel');
  });
});
