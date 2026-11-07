import { describe, expect, it } from 'vitest';
import { Beast } from '../game/Beast.ts';
import { Soldier } from '../game/Soldier.ts';
import type { Unit } from '../game/Unit.ts';
import { WOODEN_ARMOR } from '../game/items.ts';
import { IRON_SPEAR, WOODEN_SWORD } from '../game/weapons.ts';
import {
  confirmEquipment,
  openEquipmentScreen,
  pickEquipmentUnit,
  pointEquipmentCursor,
} from '../game/warband/equipmentScreen.ts';
import { createRun, type ItemSnapshot, type RunState } from '../game/warband/run.ts';
import { toEquipmentScreenView } from './equipmentView.ts';

function campRun(convoy: ItemSnapshot[] = []): RunState {
  const run = createRun(
    7,
    new Map<string, Unit>([
      ['alden', new Soldier({ name: 'Alden', team: 'player' })],
      ['rex', new Beast({ name: 'Rex', team: 'player' })],
    ]),
  );
  return { ...run, convoy };
}

const stat = (view: ReturnType<typeof toEquipmentScreenView>, id: string) => view.stats.find((each) => each.id === id)!;

describe('toEquipmentScreenView', () => {
  it('lists the units and the picked unit’s paper doll', () => {
    const view = toEquipmentScreenView(openEquipmentScreen(campRun()));
    expect(view.units.map((unit) => [unit.name, unit.classLabel])).toEqual([
      ['Alden', 'Soldier'],
      ['Rex', 'Beast'],
    ]);
    expect(view.slots.map((slot) => [slot.label, slot.item?.label ?? null, slot.locked])).toEqual([
      ['Main hand', 'Iron Spear', false],
      ['Off hand', null, false],
      ['Head', null, false],
      ['Body', null, false],
      ['Accessory', null, false],
    ]);
    expect(view.slots.map((slot) => slot.tabLabel)).toEqual(['Weapons', 'Off-hand', 'Head', 'Body', 'Accessory']);
    expect(view.maxSlots).toBe(5);
    expect(view.slotLabel).toBe('Main hand');
    expect(view.detail?.label).toBe('Iron Spear');
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('shows a monster’s two slots', () => {
    const view = toEquipmentScreenView(pickEquipmentUnit(openEquipmentScreen(campRun()), 1));
    expect(view.slots.map((slot) => [slot.label, slot.tabLabel])).toEqual([
      ['Special', 'Special'],
      ['Accessory', 'Accessory'],
    ]);
  });

  it('locks the off hand beside a two-handed weapon', () => {
    const run = campRun();
    const bowed = { ...run, roster: [{ ...run.roster[0], equipment: { main: 'iron-bow' } }] };
    expect(toEquipmentScreenView(openEquipmentScreen(bowed)).slots[1].locked).toBe(true);
  });

  it('lists the gear for the picked slot, Remove first', () => {
    const run = campRun([
      { itemId: 'wooden-sword', quantity: 1 },
      { itemId: 'wooden-armor', quantity: 1 },
    ]);
    const view = toEquipmentScreenView(confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', 0)));
    expect(view.gear.map((choice) => [choice.label, choice.remove, choice.disabled])).toEqual([
      ['Remove', true, false],
      ['Wooden Sword', false, false],
    ]);
    // Remove is highlighted: there's nothing to describe.
    expect(view.detail).toBeNull();
  });

  it('previews the numbers with the highlighted gear', () => {
    const run = campRun([{ itemId: WOODEN_ARMOR.id, quantity: 1 }]);
    const body = confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', 3));
    const view = toEquipmentScreenView(body);
    expect(view.detail?.label).toBe('Wooden Armor');
    expect(stat(view, 'defense').after - stat(view, 'defense').before).toBe(WOODEN_ARMOR.defense);
    // Outside the gear column nothing changes.
    const idle = toEquipmentScreenView(openEquipmentScreen(run));
    expect(idle.stats.every((each) => each.before === each.after)).toBe(true);
  });

  it('previews a lower attack with the weapon removed', () => {
    const view = toEquipmentScreenView(
      confirmEquipment(pointEquipmentCursor(openEquipmentScreen(campRun()), 'slots', 0)),
    );
    expect(stat(view, 'attack').after).toBeLessThan(stat(view, 'attack').before);
  });

  it('tags each weapon with its family, marking one the unit is untrained in', () => {
    const run = campRun([
      { itemId: 'wooden-sword', quantity: 1 },
      { itemId: 'iron-axe', quantity: 1 },
    ]);
    const view = toEquipmentScreenView(confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', 0)));
    expect(view.gear.map((choice) => [choice.label, choice.tag, choice.untrained])).toEqual([
      ['Remove', null, false],
      ['Wooden Sword', 'Sword', false],
      ['Iron Axe', 'Axe', true],
    ]);
  });

  it('tags armor with its weight, and shows movement lost to a heavy load', () => {
    const run = campRun([{ itemId: 'silver-plate', quantity: 1 }]);
    const body = confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', 3));
    const view = toEquipmentScreenView(pointEquipmentCursor(body, 'gear', 0));
    expect(view.gear[0]).toMatchObject({ label: 'Silver Plate', tag: 'Heavy' });
    // A level-1 soldier's strength is far under the plate and spear together.
    expect(stat(view, 'movement').after).toBeLessThan(stat(view, 'movement').before);
  });

  it('has nothing to show with an empty roster', () => {
    const view = toEquipmentScreenView(openEquipmentScreen({ ...campRun(), roster: [] }));
    expect(view).toMatchObject({ units: [], unitName: null, slots: [], gear: [], stats: [], load: null, detail: null });
  });

  it('shows the whole stat sheet, the stats before the rates', () => {
    const view = toEquipmentScreenView(openEquipmentScreen(campRun()));
    expect(view.stats.map((each) => `${each.group}:${each.label}`)).toEqual([
      'stats:HP',
      'stats:STR',
      'stats:INT',
      'stats:DEX',
      'stats:SPD',
      'stats:LCK',
      'stats:DEF',
      'stats:RES',
      'stats:MOV',
      'combat:ATK',
      'combat:HIT',
      'combat:CRIT',
      'combat:AVO',
      'combat:AS',
    ]);
  });

  it('shows the load against strength, with the highlighted gear', () => {
    const run = campRun([{ itemId: 'silver-plate', quantity: 1 }]);
    const idle = toEquipmentScreenView(openEquipmentScreen(run)).load!;
    expect(idle.before).toBe(idle.after);
    const body = confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', 3));
    const load = toEquipmentScreenView(pointEquipmentCursor(body, 'gear', 0)).load!;
    expect(load.after).toBeGreaterThan(load.before);
    expect(load.after).toBeGreaterThan(load.capacity);
    expect(load.capacity).toBe(run.roster[0].strength);
  });

  it('names the teammate wearing a choice', () => {
    const run = campRun();
    const withBram = { ...run, roster: [...run.roster, { ...run.roster[0], id: 'bram', name: 'Bram' }] };
    const view = toEquipmentScreenView(confirmEquipment(openEquipmentScreen(withBram)));
    expect(view.gear.map((choice) => [choice.label, choice.wornBy])).toEqual([
      ['Remove', null],
      ['Iron Spear', 'Bram'],
    ]);
  });

  it('sums up each slot’s gear, with its tab icon and what the convoy offers for it', () => {
    const view = toEquipmentScreenView(openEquipmentScreen(campRun([{ itemId: WOODEN_SWORD.id, quantity: 1 }])));
    expect(view.slots[0].item?.meta).toBe(`Spear · Pow ${IRON_SPEAR.power} · Wt ${IRON_SPEAR.weight}`);
    expect(view.slots.map((slot) => [slot.tabIcon, slot.count])).toEqual([
      ['sword', 1],
      ['shield', 0],
      ['helmet', 0],
      ['chestplate', 0],
      ['ring', 0],
    ]);
    expect(view.convoyCount).toBe(1);
    expect(view.units[0]).toMatchObject({ health: view.units[0].maxHealth });
  });

  it('tables each weapon’s numbers and what wearing it changes', () => {
    const run = campRun([{ itemId: WOODEN_SWORD.id, quantity: 1 }]);
    const view = toEquipmentScreenView(confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', 0)));
    expect(view.columns).toEqual(['Pow', 'Hit', 'Wt']);
    const [remove, sword] = view.gear;
    expect(remove).toMatchObject({ kind: 'Back to the convoy', cells: ['', '', ''] });
    // Taking the spear off loses the most hit (bare hands), listed first.
    expect(remove.deltas[0]).toMatchObject({ tone: 'down' });
    expect(remove.deltas[0].text).toMatch(/^−\d+ HIT$/);
    expect(remove.deltas).toHaveLength(2);
    expect(remove.deltas.every((delta) => delta.tone === 'down')).toBe(true);
    expect(sword).toMatchObject({
      kind: 'Sword · 1H',
      cells: [String(WOODEN_SWORD.power), String(WOODEN_SWORD.hit), String(WOODEN_SWORD.weight)],
    });
    // Same power, but the sword hits more often (a soldier is trained in both).
    expect(sword.deltas[0]).toEqual({ text: `+${WOODEN_SWORD.hit - IRON_SPEAR.hit} HIT`, tone: 'up' });
    // Remove is highlighted: bare hands reach nothing.
    expect(view.range).toEqual({ before: '1', after: '–' });
  });

  it('tables armor by its defense, and lists what it adds', () => {
    const run = campRun([{ itemId: WOODEN_ARMOR.id, quantity: 1 }]);
    const view = toEquipmentScreenView(confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', 3)));
    expect(view.columns).toEqual(['Def', 'Res', 'Wt']);
    expect(view.gear[0]).toMatchObject({ cells: [String(WOODEN_ARMOR.defense), '', String(WOODEN_ARMOR.weight)] });
    // Its biggest gain first, then its biggest loss (the weight slows a weak soldier).
    expect(view.gear[0].deltas[0]).toEqual({ text: `+${WOODEN_ARMOR.defense} DEF`, tone: 'up' });
    expect(view.gear[0].deltas[1]).toMatchObject({ tone: 'down' });
  });

  it('names the teammates the highlighted item fits', () => {
    const run = campRun();
    const withBram = { ...run, roster: [...run.roster, { ...run.roster[0], id: 'bram', name: 'Bram' }] };
    // The picked unit's own spear is shown over the slots column; Bram is
    // trained in spears, the beast Rex isn't.
    expect(toEquipmentScreenView(openEquipmentScreen(withBram)).alsoFits).toEqual(['Bram']);
    expect(toEquipmentScreenView(openEquipmentScreen(campRun())).alsoFits).toEqual([]);
  });
});
