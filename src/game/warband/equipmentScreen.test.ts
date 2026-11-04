import { describe, expect, it } from 'vitest';
import { Beast } from '../Beast.ts';
import { Soldier } from '../Soldier.ts';
import type { Unit } from '../Unit.ts';
import {
  cancelEquipment,
  confirmEquipment,
  getEquipmentUnit,
  getGearChoices,
  getPickedSlot,
  getUnitSlots,
  isOffHandLocked,
  moveEquipmentCursor,
  openEquipmentScreen,
  pickEquipmentUnit,
  pointEquipmentCursor,
  previewGearChoice,
  stepEquipmentUnit,
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
    expect(state).toMatchObject({ column: 'slots', unitIndex: 0, slotIndex: 0, gearIndex: 0 });
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
  it('steps between the slots and the gear, stopping at either end', () => {
    const slots = openEquipmentScreen(campRun(ARMORY));
    expect(moveEquipmentCursor(slots, -1, 0)).toBe(slots);
    const gear = moveEquipmentCursor(slots, 1, 0);
    expect(gear.column).toBe('gear');
    expect(moveEquipmentCursor(gear, 1, 0)).toBe(gear);
    expect(moveEquipmentCursor(gear, -1, 0).column).toBe('slots');
  });

  it('wraps within a column, never changing the unit', () => {
    const state = openEquipmentScreen(campRun());
    const wrapped = moveEquipmentCursor(state, 0, -1);
    expect(wrapped).toMatchObject({ slotIndex: 4, unitIndex: 0 });
  });

  it('ignores out-of-range points', () => {
    const state = openEquipmentScreen(campRun());
    expect(pointEquipmentCursor(state, 'slots', 5)).toBe(state);
    expect(pointEquipmentCursor(state, 'slots', -1)).toBe(state);
    expect(pointEquipmentCursor(state, 'gear', 3)).toBe(state);
  });
});

describe('switching units', () => {
  it('steps through the tabs, wrapping both ways', () => {
    const state = openEquipmentScreen(campRun());
    expect(getEquipmentUnit(stepEquipmentUnit(state, 1))!.id).toBe('rex');
    expect(getEquipmentUnit(stepEquipmentUnit(state, -1))!.id).toBe('rex');
    expect(getEquipmentUnit(stepEquipmentUnit(stepEquipmentUnit(state, 1), 1))!.id).toBe('alden');
    expect(stepEquipmentUnit(state, 0)).toBe(state);
  });

  it('picks a clicked tab, keeping the slot in range of a monster', () => {
    const atAccessory = pointEquipmentCursor(openEquipmentScreen(campRun()), 'slots', 4);
    const rex = pickEquipmentUnit(atAccessory, 1);
    expect(getEquipmentUnit(rex)!.id).toBe('rex');
    expect(rex).toMatchObject({ column: 'slots', slotIndex: 1 });
    expect(pickEquipmentUnit(rex, 1)).toBe(rex);
    expect(pickEquipmentUnit(rex, 2)).toBe(rex);
    expect(pickEquipmentUnit(rex, -1)).toBe(rex);
  });

  it('keeps the gear column open on the new unit', () => {
    const gear = pointEquipmentCursor(atGear(campRun(ARMORY), 4), 'gear', 0);
    const rex = stepEquipmentUnit(gear, 1);
    expect(rex).toMatchObject({ column: 'gear', slotIndex: 1, gearIndex: 0 });
  });

  it('does nothing with an empty roster', () => {
    const state = openEquipmentScreen({ ...campRun(), roster: [] });
    expect(stepEquipmentUnit(state, 1)).toBe(state);
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
    const state = confirmEquipment(pickEquipmentUnit(openEquipmentScreen(campRun(ARMORY)), 1));
    expect(getPickedSlot(state)).toBe('special');
    expect(getGearChoices(state)).toEqual([]);
  });
});

describe("teammates' gear", () => {
  // Alden and Bram are soldiers with Iron Spears; Rex is a beast.
  function withBram(convoy: ItemSnapshot[] = []): RunState {
    const run = campRun(convoy);
    const bram = { ...run.roster[0], id: 'bram', name: 'Bram' };
    return { ...run, roster: [...run.roster, bram] };
  }
  const describeChoice = (choice: ReturnType<typeof getGearChoices>[number]) =>
    choice.kind === 'remove' ? 'remove' : `${choice.kind}:${choice.item.id}`;

  it('offers what teammates wear in the slot after the convoy', () => {
    const state = atGear(withBram([{ itemId: 'wooden-sword', quantity: 1 }]), 0);
    expect(getGearChoices(state).map(describeChoice)).toEqual(['remove', 'gear:wooden-sword', 'worn:iron-spear']);
    expect(getGearChoices(state)[2]).toMatchObject({ kind: 'worn', unitId: 'bram', disabled: false });
  });

  it('takes the gear off the teammate, the old gear going to the convoy', () => {
    const run = withBram();
    const unarmed = { ...run, roster: [{ ...run.roster[0], equipment: {} }, ...run.roster.slice(1)] };
    const after = confirmEquipment(pointEquipmentCursor(atGear(unarmed, 0), 'gear', 0));
    expect(after.run.roster.find((unit) => unit.id === 'alden')!.equipment).toEqual({ main: 'iron-spear' });
    expect(after.run.roster.find((unit) => unit.id === 'bram')!.equipment).toEqual({});
    expect(after.run.convoy).toEqual([]);
  });

  it("disables a teammate's cursed gear", () => {
    const run = withBram();
    const cursed = {
      ...run,
      gold: 999,
      roster: run.roster.map((unit) =>
        unit.id === 'bram' ? { ...unit, equipment: { accessory: 'blood-crown' } } : unit,
      ),
    };
    const [crown] = getGearChoices(atGear(cursed, 4));
    expect(crown).toMatchObject({ kind: 'worn', unitId: 'bram', disabled: true });
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
  it('steps back to the slots, then closes the screen', () => {
    const gear = atGear(campRun(ARMORY), 0);
    const slots = cancelEquipment(gear)!;
    expect(slots.column).toBe('slots');
    expect(slots.run).toBe(gear.run);
    expect(cancelEquipment(slots)).toBeNull();
  });
});
