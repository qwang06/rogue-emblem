import { describe, expect, it } from 'vitest';
import { getLearnedSkills } from './skills.ts';
import { SKELETON_CAPS, SKELETON_GROWTHS, SKELETON_ITEMS, SKELETON_STATS, Skeleton } from './Skeleton.ts';
import { Unit } from './Unit.ts';
import { BONE_CLAWS } from './weapons.ts';

describe('Skeleton', () => {
  it('is a Unit of the skeleton class', () => {
    const skeleton = new Skeleton({ team: 'enemy' });
    expect(skeleton).toBeInstanceOf(Unit);
    expect(skeleton.unitClass).toBe('skeleton');
    expect(skeleton.name).toBe('Skeleton');
    expect(skeleton.team).toBe('enemy');
    expect(skeleton.level).toBe(1);
  });

  it('uses the skeleton stat line, with no mana', () => {
    const skeleton = new Skeleton({ team: 'enemy' });
    expect(skeleton.maxHealth).toBe(SKELETON_STATS.health);
    expect(skeleton.health).toBe(SKELETON_STATS.health);
    expect(skeleton.maxMana).toBe(0);
    expect(skeleton.strength).toBe(SKELETON_STATS.strength);
    expect(skeleton.skill).toBe(SKELETON_STATS.skill);
    expect(skeleton.speed).toBe(SKELETON_STATS.speed);
    expect(skeleton.luck).toBe(SKELETON_STATS.luck);
    expect(skeleton.defense).toBe(SKELETON_STATS.defense);
    expect(skeleton.resistance).toBe(SKELETON_STATS.resistance);
    expect(skeleton.movement).toBe(SKELETON_STATS.movement);
  });

  it('fights with its Bone Claws, which never breaks, and carries nothing else', () => {
    const skeleton = new Skeleton({ team: 'enemy' });
    expect(skeleton.weapon).toBe(BONE_CLAWS);
    expect(skeleton.weaponUses).toBeNull();
    expect(skeleton.items).toEqual(SKELETON_ITEMS);
    expect(skeleton.items).toHaveLength(1);
  });

  it('levels up with the skeleton growth rates and caps', () => {
    const skeleton = new Skeleton({ team: 'enemy' });
    expect(skeleton.growths).toBe(SKELETON_GROWTHS);
    expect(skeleton.caps).toBe(SKELETON_CAPS);
  });

  it('learns no skills', () => {
    expect(getLearnedSkills('skeleton', 20)).toEqual([]);
  });

  it('accepts a custom name, level and items', () => {
    const skeleton = new Skeleton({ name: 'Enemy Skeleton', team: 'enemy', level: 3, items: [] });
    expect(skeleton.name).toBe('Enemy Skeleton');
    expect(skeleton.level).toBe(3);
    expect(skeleton.items).toEqual([]);
  });
});
