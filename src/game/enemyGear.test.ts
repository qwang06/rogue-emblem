import { describe, expect, it } from 'vitest';
import { getLoadMovementPenalty } from './combatStats.ts';
import { getEnemyTier, outfitEnemy } from './enemyGear.ts';
import { getArmorWeight, getMainWeapon } from './equipment.ts';
import { GEAR_LADDER } from './gearLadder.ts';
import { RUN_ITEMS } from './warband/run.ts';
import { createUnitOfClass } from './unitClasses.ts';

const ids = (equipment: Record<string, { id: string } | undefined>) =>
  Object.fromEntries(Object.entries(equipment).map(([slot, gear]) => [slot, gear?.id]));

function outfit(classId: string, level: number, strength?: number) {
  const unit = createUnitOfClass(classId, { team: 'enemy' });
  if (strength !== undefined) unit.strength = strength;
  return { unit, equipment: outfitEnemy(unit, level, RUN_ITEMS) };
}

describe('getEnemyTier', () => {
  it('climbs a tier at levels 4, 11 and 20', () => {
    expect([1, 3, 4, 10, 11, 19, 20, 40].map(getEnemyTier)).toEqual([
      'wooden',
      'wooden',
      'iron',
      'iron',
      'steel',
      'steel',
      'silver',
      'silver',
    ]);
    expect(getEnemyTier(0)).toBe('wooden');
  });
});

describe('outfitEnemy', () => {
  it('leaves a low-level enemy as its class made it, never trading its iron down', () => {
    const { unit, equipment } = outfit('soldier', 1);
    expect(equipment).toBe(unit.equipment);
    expect(ids(outfit('soldier', 2).equipment)).toEqual({ main: 'iron-spear' });
  });

  it('moves its weapon up the ladder in its own family', () => {
    expect(outfit('soldier', 11).equipment.main?.id).toBe(GEAR_LADDER.steel.weapons.spear);
    expect(outfit('archer', 20).equipment.main?.id).toBe(GEAR_LADDER.silver.weapons.bow);
    expect(outfit('vanguard', 12).equipment.main?.id).toBe(GEAR_LADDER.steel.weapons.axe);
  });

  it('puts on body armor from level 3 and a head piece from level 8, in its class weight, a tier behind', () => {
    expect(outfit('soldier', 3).equipment.body?.id).toBe(GEAR_LADDER.wooden.body.heavy);
    expect(outfit('soldier', 3).equipment.head).toBeUndefined();
    const archer = outfit('archer', 8).equipment;
    // Level 8 armor is level 5's tier: iron.
    expect(archer.body?.id).toBe(GEAR_LADDER.iron.body.light);
    expect(archer.head?.id).toBe(GEAR_LADDER.iron.head.light);
    const mage = outfit('mage', 14).equipment;
    expect(mage.body?.id).toBe(GEAR_LADDER.steel.body.cloth);
    expect(mage.head?.id).toBe(GEAR_LADDER.steel.head.cloth);
  });

  it('never wears armor that would cost it movement', () => {
    for (const level of [5, 10, 15, 25]) {
      const { unit, equipment } = outfit('soldier', level, 0);
      const load = {
        strength: unit.strength,
        armorWeight: getArmorWeight(equipment),
        weapon: getMainWeapon(equipment),
      };
      // Its weapon alone may weigh it down; armor never adds a penalty.
      const bare = { ...load, armorWeight: 0 };
      expect(getLoadMovementPenalty(load), `level ${level}`).toBe(getLoadMovementPenalty(bare));
    }
  });

  it('leaves monsters and healers holding a staff as they are', () => {
    const goblin = outfit('goblin', 20);
    expect(goblin.equipment).toBe(goblin.unit.equipment);
    const acolyte = outfit('acolyte', 11).equipment;
    expect(acolyte.main?.id).toBe(createUnitOfClass('acolyte', { team: 'enemy' }).equipment.main?.id);
  });
});
