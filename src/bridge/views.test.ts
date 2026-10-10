import { describe, expect, it } from 'vitest';
import { Unit } from '../game/Unit.ts';
import {
  mergeTileAnchors,
  toExperienceGainView,
  toLevelUpView,
  toCombatForecastView,
  toDamagePopupView,
  toDialogView,
  toObjectiveView,
  toRewardAction,
  toRewardMenuActions,
  toRunOverView,
  toStageClearView,
  toPhaseBannerView,
  toRosterEntryView,
  toTileAnchorView,
  toTurnView,
  toCanvasFraction,
  toUnitDetailView,
  toUnitView,
  worldToScreen,
  type TileAnchorView,
} from './views.ts';
import type { ExperienceGain } from '../game/experience.ts';
import { POWER_STRIKE } from '../game/skills.ts';
import { MAX_LEVEL } from '../game/experience.ts';
import { Soldier } from '../game/Soldier.ts';
import { Acolyte } from '../game/Acolyte.ts';
import { advanceDialog, createDialog } from '../game/dialog.ts';
import { HEALTH_POTION } from '../game/items.ts';
import { FIRE, FISTS, IRON_SPEAR, weaponEntry } from '../game/weapons.ts';
import { createTurnState, markDone } from '../game/turns.ts';
import { applyBattleResult, createRun, restoreRoster, snapshotUnit } from '../game/warband/run.ts';
import { createStartingWarband } from '../game/warband/stageLevel.ts';
import { PLAYER_ROSTER } from '../game/demoLevel.ts';
import { Villager } from '../game/Villager.ts';

const makeUnit = () =>
  new Unit({ name: 'Soldier', health: 10, mana: 5, strength: 4, defense: 2, movement: 5, team: 'player' });

describe('toUnitView', () => {
  it('returns null for no unit', () => {
    expect(toUnitView(null)).toBeNull();
    expect(toUnitView(undefined)).toBeNull();
  });

  it('copies the stats the UI displays', () => {
    expect(toUnitView(makeUnit())).toEqual({
      name: 'Soldier',
      unitClass: null,
      team: 'player',
      level: 1,
      experience: 0,
      health: 10,
      maxHealth: 10,
      mana: 5,
      maxMana: 5,
      strength: 4,
      magic: 0,
      skill: 0,
      speed: 0,
      luck: 0,
      defense: 2,
      resistance: 0,
      movement: 5,
      range: '–',
      weapon: null,
      items: [],
    });
  });

  it("shows the equipped weapon's range and name", () => {
    const unit = new Unit({
      name: 'Mage',
      health: 10,
      strength: 0,
      defense: 0,
      movement: 5,
      team: 'player',
      weaponTypes: ['magical'],
      items: [weaponEntry(FIRE)],
    });
    expect(toUnitView(unit)).toMatchObject({ range: '1–2', weapon: 'Fire' });
  });

  it('lists the items the unit carries', () => {
    const unit = new Unit({
      name: 'Soldier',
      health: 10,
      strength: 4,
      defense: 2,
      movement: 5,
      team: 'player',
      weaponTypes: ['physical'],
      items: [
        { item: HEALTH_POTION, quantity: 2 },
        weaponEntry(FIRE),
        { item: IRON_SPEAR, quantity: 7 },
        weaponEntry(FISTS),
      ],
    });
    const view = toUnitView(unit);
    expect(view!.items).toEqual([
      { id: 'health-potion', label: 'Health Potion', quantity: 2, weapon: false, equipped: false },
      { id: 'fire', label: 'Fire', quantity: 30, weapon: true, equipped: false },
      { id: 'iron-spear', label: 'Iron Spear', quantity: 7, weapon: true, equipped: true },
      { id: 'fists', label: 'Fists', quantity: null, weapon: true, equipped: false },
    ]);
    expect(Object.isFrozen(view!.items)).toBe(true);
    expect(Object.isFrozen(view!.items[0])).toBe(true);
  });

  it('is a detached, frozen snapshot', () => {
    const unit = makeUnit();
    const view = toUnitView(unit);
    unit.takeDamage(3);
    expect(view!.health).toBe(10);
    expect(Object.isFrozen(view)).toBe(true);
  });
});

describe('toUnitDetailView', () => {
  it('returns null for no unit', () => {
    expect(toUnitDetailView(null)).toBeNull();
    expect(toUnitDetailView(undefined)).toBeNull();
  });

  it('includes everything toUnitView shows', () => {
    const unit = new Soldier({ team: 'player' });
    expect(toUnitDetailView(unit)).toMatchObject(toUnitView(unit)!);
  });

  it("names the class and lists each stat with its class's cap", () => {
    const unit = new Soldier({ team: 'player' });
    const view = toUnitDetailView(unit)!;
    expect(view.classLabel).toBe('Soldier');
    expect(view.stats.map((stat) => stat.label)).toEqual(['STR', 'MAG', 'SKL', 'SPD', 'LCK', 'DEF', 'RES']);
    expect(view.stats[0]).toEqual({ id: 'strength', label: 'STR', value: unit.strength, cap: unit.caps.strength });
  });

  it('leaves the class and caps blank for a unit without them', () => {
    const view = toUnitDetailView(makeUnit())!;
    expect(view.classLabel).toBeNull();
    expect(view.stats.every((stat) => stat.cap === null)).toBe(true);
  });

  it('works out the rates it fights with from its stats and weapon', () => {
    const unit = new Unit({
      name: 'Soldier',
      health: 10,
      strength: 2,
      skill: 3,
      speed: 5,
      luck: 4,
      defense: 2,
      movement: 5,
      team: 'player',
      weaponTypes: ['physical'],
      items: [{ item: IRON_SPEAR, quantity: 7 }],
    });
    expect(toUnitDetailView(unit)).toMatchObject({
      damageType: 'physical',
      attack: 2 + IRON_SPEAR.might,
      hit: IRON_SPEAR.hit + 3 * 2 + 2,
      crit: IRON_SPEAR.crit + 1,
      // The spear's weight (3) is 1 more than the unit's strength (2).
      attackSpeed: 4,
      avoid: 4 * 2 + 4,
      equippedWeapon: {
        label: 'Iron Spear',
        type: 'physical',
        might: IRON_SPEAR.might,
        hit: IRON_SPEAR.hit,
        crit: IRON_SPEAR.crit,
        weight: IRON_SPEAR.weight,
        range: '1',
        uses: 7,
        maxUses: IRON_SPEAR.uses,
      },
      weaponTypes: ['physical'],
    });
  });

  it('powers a magical weapon with magic', () => {
    const unit = new Unit({
      name: 'Caster',
      team: 'player',
      health: 8,
      strength: 1,
      magic: 4,
      defense: 0,
      movement: 5,
      weaponTypes: ['magical'],
      items: [weaponEntry(FIRE)],
    });
    const view = toUnitDetailView(unit)!;
    expect(view.damageType).toBe('magical');
    expect(view.attack).toBe(unit.magic + FIRE.might);
    expect(view.equippedWeapon).toMatchObject({ label: 'Fire', range: '1–2' });
  });

  it('fights bare-handed without a weapon', () => {
    const view = toUnitDetailView(makeUnit())!;
    expect(view.equippedWeapon).toBeNull();
    expect(view).toMatchObject({ damageType: 'physical', attack: 4, hit: 0, crit: 0 });
  });

  it("lists the skills the unit's class has taught it", () => {
    expect(toUnitDetailView(new Soldier({ team: 'player', level: 2 }))!.skills).toEqual([
      { id: POWER_STRIKE.id, label: POWER_STRIKE.label, manaCost: POWER_STRIKE.manaCost, range: POWER_STRIKE.range },
    ]);
    expect(toUnitDetailView(new Soldier({ team: 'player' }))!.skills).toEqual([]);
    expect(toUnitDetailView(makeUnit())!.skills).toEqual([]);
  });

  it('says when the unit has reached the top level', () => {
    expect(toUnitDetailView(makeUnit())!.maxLevel).toBe(false);
    expect(toUnitDetailView(new Soldier({ team: 'player', level: MAX_LEVEL }))!.maxLevel).toBe(true);
  });

  it('is a detached, frozen snapshot', () => {
    const unit = new Soldier({ team: 'player' });
    const view = toUnitDetailView(unit)!;
    unit.takeDamage(3);
    expect(view.health).toBe(unit.maxHealth);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.stats)).toBe(true);
    expect(Object.isFrozen(view.skills)).toBe(true);
    expect(Object.isFrozen(view.equippedWeapon)).toBe(true);
  });
});

describe('worldToScreen', () => {
  it('is the identity for an unscrolled, unzoomed camera', () => {
    expect(worldToScreen({ x: 16, y: 32 }, { x: 0, y: 0, zoom: 1 })).toEqual({ x: 16, y: 32 });
  });

  it('offsets by the camera position and scales by zoom', () => {
    expect(worldToScreen({ x: 16, y: 32 }, { x: 8, y: -4, zoom: 2 })).toEqual({ x: 16, y: 72 });
  });

  it('can land off screen', () => {
    expect(worldToScreen({ x: 0, y: 0 }, { x: 10, y: 10, zoom: 2 })).toEqual({ x: -20, y: -20 });
  });
});

describe('toCanvasFraction', () => {
  it('divides by the canvas size', () => {
    expect(toCanvasFraction({ x: 480, y: 180 }, { width: 960, height: 720 })).toEqual({ x: 0.5, y: 0.25 });
  });

  it('maps the corners to 0 and 1', () => {
    expect(toCanvasFraction({ x: 0, y: 0 }, { width: 960, height: 720 })).toEqual({ x: 0, y: 0 });
    expect(toCanvasFraction({ x: 960, y: 720 }, { width: 960, height: 720 })).toEqual({ x: 1, y: 1 });
  });

  it('goes outside 0–1 for points off the canvas', () => {
    expect(toCanvasFraction({ x: -96, y: 1440 }, { width: 960, height: 720 })).toEqual({ x: -0.1, y: 2 });
  });
});

// Compares each edge of an anchor, allowing for floating-point rounding.
function expectAnchor(anchor: TileAnchorView, expected: Partial<TileAnchorView>) {
  for (const [edge, value] of Object.entries(expected)) {
    expect(anchor[edge as keyof TileAnchorView]).toBeCloseTo(value);
  }
}

describe('toTileAnchorView', () => {
  it('gives the tile edges as fractions of the canvas', () => {
    // Tile (2, 1) at 32px, zoom 2, camera at the world origin, 400x200 canvas:
    // the tile spans x 128–192 and y 64–128 canvas pixels.
    const anchor = toTileAnchorView({ x: 2, y: 1 }, 32, { x: 0, y: 0, zoom: 2 }, { width: 400, height: 200 });
    expectAnchor(anchor, { left: 0.32, top: 0.32, right: 0.48, bottom: 0.64 });
    expect(Object.isFrozen(anchor)).toBe(true);
  });

  it('accounts for the camera offset', () => {
    const anchor = toTileAnchorView({ x: 0, y: 0 }, 32, { x: -16, y: -8, zoom: 1 }, { width: 100, height: 100 });
    expectAnchor(anchor, { left: 0.16, top: 0.08, right: 0.48, bottom: 0.4 });
  });
});

describe('toDamagePopupView', () => {
  it('copies the popup fields into a frozen snapshot', () => {
    // @ts-expect-error extra fields are dropped
    const view = toDamagePopupView({ id: 1, amount: 3, x: 40, y: 20, durationMs: 700, extra: true });
    expect(view).toEqual({ id: 1, amount: 3, kind: 'damage', text: '3', x: 40, y: 20, durationMs: 700 });
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('labels health and mana recovery', () => {
    expect(toDamagePopupView({ id: 1, amount: 5, kind: 'health', x: 0, y: 0, durationMs: 700 }).text).toBe('+5 HP');
    expect(toDamagePopupView({ id: 1, amount: 3, kind: 'mana', x: 0, y: 0, durationMs: 700 }).text).toBe('+3 MP');
  });

  it('calls out crits and misses', () => {
    expect(toDamagePopupView({ id: 1, amount: 9, kind: 'crit', x: 0, y: 0, durationMs: 700 }).text).toBe('Crit! 9');
    expect(toDamagePopupView({ id: 1, amount: 0, kind: 'miss', x: 0, y: 0, durationMs: 700 }).text).toBe('Miss');
    expect(toDamagePopupView({ id: 1, amount: 0, kind: 'broke', x: 0, y: 0, durationMs: 700 }).text).toBe('Broke!');
  });

  it('shows a recovery of 0 rather than hiding it', () => {
    expect(toDamagePopupView({ id: 1, amount: 0, kind: 'health', x: 0, y: 0, durationMs: 700 }).text).toBe('+0 HP');
  });

  it('falls back to the bare number for an unknown kind', () => {
    // @ts-expect-error not a popup kind
    expect(toDamagePopupView({ id: 1, amount: 4, kind: 'poison', x: 0, y: 0, durationMs: 700 }).text).toBe('4');
  });
});

describe('toRosterEntryView', () => {
  it('snapshots the unit for the roster menu', () => {
    const view = toRosterEntryView({ id: 'soldier', unit: makeUnit(), sprite: 'Villager_01', placed: false });
    expect(view).toEqual({ id: 'soldier', label: 'Soldier', sprite: 'Villager_01', placed: false, disabled: false });
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('marks entries that can no longer be placed as disabled', () => {
    const view = toRosterEntryView({
      id: 'soldier',
      unit: makeUnit(),
      sprite: 'Villager_01',
      placed: false,
      disabled: true,
    });
    expect(view.disabled).toBe(true);
  });
});

describe('toTurnView', () => {
  it('returns null before the battle starts', () => {
    expect(toTurnView(null)).toBeNull();
  });

  it('names the player and enemy phases', () => {
    expect(toTurnView(createTurnState(1, 'player'))).toEqual({ turn: 1, team: 'player', label: 'Player Phase' });
    expect(toTurnView(createTurnState(4, 'enemy'))).toEqual({ turn: 4, team: 'enemy', label: 'Enemy Phase' });
  });

  it('leaves out who has moved or acted', () => {
    expect(toTurnView(markDone(createTurnState(), 'a'))).not.toHaveProperty('done');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(toTurnView(createTurnState()))).toBe(true);
  });
});

describe('toPhaseBannerView', () => {
  it('carries the id, phase, and duration', () => {
    const view = toPhaseBannerView({ id: 3, turnState: createTurnState(2, 'enemy'), durationMs: 1200 });
    expect(view).toEqual({ id: 3, turn: 2, team: 'enemy', label: 'Enemy Phase', durationMs: 1200 });
    expect(Object.isFrozen(view)).toBe(true);
  });
});

describe('toDialogView', () => {
  const dialog = createDialog([
    { speaker: 'Alden', team: 'player', side: 'left', text: 'Onward.' },
    { speaker: 'Foe', team: 'enemy', side: 'right', text: 'Never!' },
  ]);

  it('snapshots the current line with its stand-in sprite and typing speed', () => {
    const view = toDialogView({ id: 3, dialog, sprite: 'Villager_01', charsPerSecond: 40 });
    expect(view).toEqual({
      id: 3,
      speaker: 'Alden',
      side: 'left',
      text: 'Onward.',
      portrait: null,
      sprite: 'Villager_01',
      revealed: false,
      charsPerSecond: 40,
      isLast: false,
    });
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('follows the dialog to its revealed, last line', () => {
    const last = advanceDialog(dialog, 10_000);
    const view = toDialogView({ id: 4, dialog: advanceDialog(last!, 0)!, charsPerSecond: 40 });
    expect(view.speaker).toBe('Foe');
    expect(view.revealed).toBe(true);
    expect(view.isLast).toBe(true);
    expect(view.sprite).toBeNull();
  });
});

describe('mergeTileAnchors', () => {
  it('covers both anchors', () => {
    const a = { left: 0.1, top: 0.4, right: 0.2, bottom: 0.5 };
    const b = { left: 0.3, top: 0.2, right: 0.4, bottom: 0.3 };
    const merged = mergeTileAnchors(a, b);
    expect(merged).toEqual({ left: 0.1, top: 0.2, right: 0.4, bottom: 0.5 });
    expect(Object.isFrozen(merged)).toBe(true);
  });

  it('is the anchor itself when both are the same', () => {
    const a = { left: 0.1, top: 0.2, right: 0.3, bottom: 0.4 };
    expect(mergeTileAnchors(a, a)).toEqual(a);
  });
});

describe('toCombatForecastView', () => {
  const anchor = { left: 0.1, top: 0.2, right: 0.3, bottom: 0.4 };
  const forecast = {
    attacker: {
      health: 10,
      maxHealth: 10,
      damage: 3,
      hit: 79,
      crit: 0,
      strikes: 2,
      counters: true,
    },
    defender: {
      health: 6,
      maxHealth: 10,
      damage: null,
      hit: null,
      crit: null,
      strikes: 0,
      counters: false,
    },
  };

  it('labels each side with its unit and weapon and keeps the numbers', () => {
    const attacker = new Unit({
      name: 'Soldier',
      health: 10,
      strength: 4,
      defense: 2,
      movement: 5,
      team: 'player',
      weaponTypes: ['physical'],
      items: [weaponEntry(IRON_SPEAR)],
    });
    const defender = new Unit({ name: 'Bandit', health: 10, strength: 4, defense: 2, movement: 5, team: 'enemy' });
    const view = toCombatForecastView({ forecast, attacker, defender, anchor });
    expect(view).toEqual({
      attacker: { name: 'Soldier', team: 'player', weapon: 'Iron Spear', ...forecast.attacker },
      defender: { name: 'Bandit', team: 'enemy', weapon: null, ...forecast.defender },
      anchor,
    });
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.attacker)).toBe(true);
    expect(Object.isFrozen(view.defender)).toBe(true);
  });
});

describe('toExperienceGainView', () => {
  it('fills the bar from the old XP to the new', () => {
    const result = { amount: 30, level: 2, experience: 50, levelUps: [] };
    const view = toExperienceGainView({
      id: 1,
      name: 'Ana',
      from: { level: 2, experience: 20 },
      result,
      durationMs: 900,
    });
    expect(view).toEqual({
      id: 1,
      name: 'Ana',
      level: 2,
      gained: 30,
      startPercent: 20,
      endPercent: 50,
      durationMs: 900,
    });
    expect(Object.isFrozen(view)).toBe(true);
  });

  it("measures level 1's bar against its smaller XP need", () => {
    const result = { amount: 15, level: 1, experience: 35, levelUps: [] };
    const view = toExperienceGainView({
      id: 3,
      name: 'Ana',
      from: { level: 1, experience: 20 },
      result,
      durationMs: 900,
    });
    expect(view.startPercent).toBe(40);
    expect(view.endPercent).toBe(70);
  });

  it('fills the bar to 100 on a level up', () => {
    // Only the number of level ups matters here.
    const result = { amount: 30, level: 3, experience: 10, levelUps: [{}] } as ExperienceGain;
    const view = toExperienceGainView({
      id: 2,
      name: 'Ana',
      from: { level: 2, experience: 80 },
      result,
      durationMs: 900,
    });
    expect(view.startPercent).toBe(80);
    expect(view.endPercent).toBe(100);
  });
});

describe('toLevelUpView', () => {
  const levelUp = {
    level: 3,
    gains: { health: 1, mana: 0, strength: 1, magic: 0, skill: 0, speed: 1, luck: 0, defense: 0, resistance: 0 },
    stats: { health: 12, mana: 5, strength: 5, magic: 0, skill: 3, speed: 4, luck: 2, defense: 2, resistance: 0 },
    skills: [POWER_STRIKE],
  };

  it('lists every stat with its label, new value and gain, plus learned skills', () => {
    const view = toLevelUpView({ id: 4, name: 'Ana', levelUp, durationMs: 2000 });
    expect(view.level).toBe(3);
    expect(view.stats.map((s) => s.label)).toEqual(['HP', 'MP', 'STR', 'MAG', 'SKL', 'SPD', 'LCK', 'DEF', 'RES']);
    expect(view.stats[0]).toEqual({ id: 'health', label: 'HP', value: 12, gain: 1 });
    expect(view.stats[1]).toEqual({ id: 'mana', label: 'MP', value: 5, gain: 0 });
    expect(view.skills).toEqual(['Power Strike']);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.stats[0])).toBe(true);
  });
});

describe('toObjectiveView', () => {
  it('carries the battle title and the objective words, frozen', () => {
    const view = toObjectiveView('Stage 2: Lakeside', { goal: 'Defeat all enemies', defeat: 'All your units fall' });
    expect(view).toEqual({ battle: 'Stage 2: Lakeside', goal: 'Defeat all enemies', defeat: 'All your units fall' });
    expect(Object.isFrozen(view)).toBe(true);
  });
});

describe('toRunOverView', () => {
  it('carries the stage and the names of the fallen in order, frozen', () => {
    const villagers = Object.entries(PLAYER_ROSTER).map(
      ([id, name]) => [id, new Villager({ name, team: 'player' })] as const,
    );
    const run = createRun(1, new Map(villagers));
    const units = restoreRoster(run);
    units.get('villager-2')!.takeDamage(99);
    units.get('villager-1')!.takeDamage(99);
    const view = toRunOverView({ ...applyBattleResult(run, { units }), stage: 4 });
    expect(view).toEqual({ stage: 4, fallen: ['Alden', 'Bryn'] });
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.fallen)).toBe(true);
  });

  it('has an empty list when nobody fell', () => {
    expect(toRunOverView(createRun(1, createStartingWarband())).fallen).toEqual([]);
  });
});

describe('toRewardAction', () => {
  it("is a menu entry with the reward's label and description, frozen", () => {
    const action = toRewardAction({ kind: 'gold', amount: 40 }, 2);
    expect(action).toEqual({
      id: 'gold-2',
      label: '40 Gold',
      kind: 'gold',
      description: 'A purse of coin, for the camp to come.',
      stats: null,
    });
    expect(Object.isFrozen(action)).toBe(true);
  });

  it("carries a recruit's stat line", () => {
    const unit = snapshotUnit('recruit-1', new Acolyte({ name: 'Dara', team: 'player' }));
    const action = toRewardAction({ kind: 'recruit', unit }, 0);
    expect(action.label).toBe('Recruit Dara');
    expect(action.stats?.map(({ label }) => label)).toEqual(['HP', 'STR', 'MAG', 'SKL', 'SPD', 'DEF', 'RES']);
    expect(action.stats?.find(({ label }) => label === 'MAG')?.value).toBe(unit.magic);
  });
});

describe('toStageClearView', () => {
  it('carries the stage, the gold paid and the total, frozen', () => {
    const view = toStageClearView(3, { gold: 35, flawless: true }, 80);
    expect(view).toEqual({ stage: 3, gold: 35, flawless: true, totalGold: 80 });
    expect(Object.isFrozen(view)).toBe(true);
  });
});

describe('toRewardMenuActions', () => {
  it('lists the cards, then Skip and Reroll with their gold', () => {
    const actions = toRewardMenuActions([{ kind: 'rest' }], { skipGold: 15, rerollCost: 10, gold: 30 });
    expect(actions.map(({ id, label }) => [id, label])).toEqual([
      ['rest-0', 'Rest'],
      ['skip', 'Skip (+15 gold)'],
      ['reroll', 'Reroll (10 gold)'],
    ]);
    expect(actions.some((action) => action.disabled)).toBe(false);
  });

  it("disables Reroll when the warband can't afford it", () => {
    const actions = toRewardMenuActions([], { skipGold: 15, rerollCost: 20, gold: 19 });
    expect(actions.find(({ kind }) => kind === 'reroll')?.disabled).toBe(true);
    expect(actions.find(({ kind }) => kind === 'skip')?.disabled).toBeUndefined();
  });
});
