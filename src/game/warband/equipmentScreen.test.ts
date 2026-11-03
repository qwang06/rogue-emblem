import { describe, expect, it } from 'vitest';
import { Beast } from '../Beast.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import {
  cancelEquipment,
  confirmEquipment,
  confirmsEquipmentClick,
  getEquipmentUnit,
  getGearChoices,
  getPickedSlot,
  getUnitSlots,
  isOffHandLocked,
  moveEquipmentCursor,
  openEquipmentScreen,
  pointEquipmentCursor,
  previewGearChoice,
} from './equipmentScreen.ts';
import { createRun, type ItemSnapshot, type RunState } from './run.ts';

// Alden the soldier wields an Iron Spear; Rex is a beast.
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

const ARMORY: ItemSnapshot[] = [
  { itemId: 'iron-bow', quantity: 1 },
  { itemId: 'wooden-shield', quantity: 1 },
  { itemId: 'wooden-sword', quantity: 1 },
  { itemId: 'health-potion', quantity: 2 },
];

// The screen with Alden's slot `slot` open in the gear column.
function atGear(run: RunState, slotIndex: number) {
  return confirmEquipment(pointEquipmentCursor(openEquipmentScreen(run), 'slots', slotIndex));
}

describe('opening and slots', () => {
  it('opens on the first unit', () => {
    const state = openEquipmentScreen(campRun());
    expect(state).toMatchObject({ column: 'units', unitIndex: 0, slotIndex: 0, gearIndex: 0 });
    expect(getEquipmentUnit(state)!.id).toBe('alden');
    expect(getPickedSlot(state)).toBe('main');
  });

  it('shows the paper doll for a humanoid and two slots for a monster', () => {
    const run = campRun();
    expect(getUnitSlots(run.roster[0])).toEqual(['main', 'off', 'head', 'body', 'accessory']);
    expect(getUnitSlots(run.roster[1])).toEqual(['special', 'accessory']);
    expect(getUnitSlots(null)).toEqual([]);
  });

  it('locks the off hand while the main hand takes both hands', () => {
    const run = campRun();
    expect(isOffHandLocked(run.roster[0])).toBe(false);
    expect(isOffHandLocked({ ...run.roster[0], equipment: { main: 'iron-bow' } })).toBe(true);
  });
});

describe('moving the cursor', () => {
  it('steps right through the columns and back, stopping at the ends', () => {
    const state = openEquipmentScreen(campRun(ARMORY));
    expect(moveEquipmentCursor(state, -1, 0)).toBe(state);
    const slots = moveEquipmentCursor(state, 1, 0);
    expect(slots.column).toBe('slots');
    const gear = moveEquipmentCursor(slots, 1, 0);
    expect(gear.column).toBe('gear');
    expect(moveEquipmentCursor(gear, 1, 0)).toBe(gear);
    expect(moveEquipmentCursor(gear, -1, 0).column).toBe('slots');
  });

  it('wraps within a column and keeps the slot in range of a monster', () => {
    const state = openEquipmentScreen(campRun());
    expect(moveEquipmentCursor(state, 0, -1).unitIndex).toBe(1);
    const atAccessory = pointEquipmentCursor(state, 'slots', 4);
    expect(atAccessory.slotIndex).toBe(4);
    const rex = moveEquipmentCursor({ ...atAccessory, column: 'units' }, 0, 1);
    expect(getEquipmentUnit(rex)!.id).toBe('rex');
    expect(rex.slotIndex).toBe(1);
  });

  it('ignores out-of-range points', () => {
    const state = openEquipmentScreen(campRun());
    expect(pointEquipmentCursor(state, 'units', 5)).toBe(state);
    expect(pointEquipmentCursor(state, 'slots', -1)).toBe(state);
    expect(pointEquipmentCursor(state, 'gear', 3)).toBe(state);
  });

  it('opens on clicking a slot or gear, not a unit', () => {
    expect(confirmsEquipmentClick('units')).toBe(false);
    expect(confirmsEquipmentClick('slots')).toBe(true);
    expect(confirmsEquipmentClick('gear')).toBe(true);
  });
});

describe('gear choices', () => {
  it('offers Remove for a filled slot, then the convoy gear for it', () => {
    const state = atGear(campRun(ARMORY), 0);
    expect(state.column).toBe('gear');
    expect(getGearChoices(state).map((choice) => (choice.kind === 'remove' ? 'remove' : choice.item.id))).toEqual([
      'remove',
      'iron-bow',
      'wooden-sword',
    ]);
  });

  it('offers no Remove for an empty slot', () => {
    const state = atGear(campRun(ARMORY), 1);
    expect(getGearChoices(state).map((choice) => choice.kind)).toEqual(['gear']);
  });

  it('disables a shield beside a two-handed weapon', () => {
    const run = campRun(ARMORY);
    const bowed = { ...run, roster: [{ ...run.roster[0], equipment: { main: 'iron-bow' } }, run.roster[1]] };
    const [shield] = getGearChoices(atGear(bowed, 1));
    expect(shield).toMatchObject({ kind: 'gear', disabled: true });
    expect(confirmEquipment(atGear(bowed, 1))).toEqual(atGear(bowed, 1));
  });

  it('offers a monster no hand gear', () => {
    const state = confirmEquipment(
      pointEquipmentCursor(moveEquipmentCursor(openEquipmentScreen(campRun(ARMORY)), 0, 1), 'slots', 0),
    );
    expect(getPickedSlot(state)).toBe('special');
    expect(getGearChoices(state)).toEqual([]);
  });
});

describe('confirming', () => {
  it('wears the picked gear, sending what it displaces to the convoy, and goes back to the slots', () => {
    const state = pointEquipmentCursor(atGear(campRun(ARMORY), 0), 'gear', 2);
    const after = confirmEquipment(state);
    expect(after.column).toBe('slots');
    expect(getEquipmentUnit(after)!.equipment).toEqual({ main: 'wooden-sword' });
    expect(after.run.convoy.map((entry) => entry.itemId)).toEqual([
      'iron-bow',
      'wooden-shield',
      'health-potion',
      'iron-spear',
    ]);
  });

  it('takes a shield off when a two-handed weapon goes in', () => {
    const shielded = confirmEquipment(atGear(campRun(ARMORY), 1));
    expect(getEquipmentUnit(shielded)!.equipment).toEqual({ main: 'iron-spear', off: 'wooden-shield' });
    const bow = confirmEquipment(pointEquipmentCursor(confirmEquipment({ ...shielded, slotIndex: 0 }), 'gear', 1));
    expect(getEquipmentUnit(bow)!.equipment).toEqual({ main: 'iron-bow' });
    expect(bow.run.convoy.map((entry) => entry.itemId)).toContain('wooden-shield');
  });

  it('removes the gear in a slot', () => {
    const after = confirmEquipment(atGear(campRun(), 0));
    expect(getEquipmentUnit(after)!.equipment).toEqual({});
    expect(after.run.convoy).toEqual([{ itemId: 'iron-spear', quantity: 1 }]);
  });

  it('previews the run with the highlighted choice, only in the gear column', () => {
    const state = pointEquipmentCursor(atGear(campRun(ARMORY), 0), 'gear', 1);
    expect(previewGearChoice(state)!.roster[0].equipment).toEqual({ main: 'iron-bow' });
    expect(state.run.roster[0].equipment).toEqual({ main: 'iron-spear' });
    expect(previewGearChoice(openEquipmentScreen(campRun(ARMORY)))).toBeNull();
  });

  it('does nothing with an empty roster', () => {
    const state = openEquipmentScreen({ ...campRun(), roster: [] });
    expect(confirmEquipment(state)).toBe(state);
  });
});

describe('cancelling', () => {
  it('steps back a column, then closes the screen', () => {
    const gear = atGear(campRun(ARMORY), 0);
    const slots = cancelEquipment(gear)!;
    expect(slots.column).toBe('slots');
    expect(slots.run).toBe(gear.run);
    const units = cancelEquipment(slots)!;
    expect(units.column).toBe('units');
    expect(cancelEquipment(units)).toBeNull();
  });
});
