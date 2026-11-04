import { describe, expect, it } from 'vitest';
import { Beast } from '../game/Beast.ts';
import { Soldier } from '../game/Soldier.ts';
import type { Unit } from '../game/Unit.ts';
import { WOODEN_ARMOR } from '../game/items.ts';
import { confirmEquipment, openEquipmentScreen, pointEquipmentCursor } from '../game/warband/equipmentScreen.ts';
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
    expect(view.maxSlots).toBe(5);
    expect(view.slotLabel).toBe('Main hand');
    expect(view.detail?.label).toBe('Iron Spear');
    expect(Object.isFrozen(view)).toBe(true);
  });

  it('shows a monster’s two slots', () => {
    const view = toEquipmentScreenView(pointEquipmentCursor(openEquipmentScreen(campRun()), 'units', 1));
    expect(view.slots.map((slot) => slot.label)).toEqual(['Special', 'Accessory']);
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
    expect(view).toMatchObject({ units: [], unitName: null, slots: [], gear: [], stats: [], detail: null });
  });
});
