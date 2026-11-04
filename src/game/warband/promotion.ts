// The run side of promotion (promotions.ts, roadmap W.7): at camp, a roster
// unit that has reached PROMOTION_LEVEL promotes to one of its class's
// promotions (a villager's four, an acolyte's Mage or Bishop). A first
// promotion (to tier 2) is free; a second (to tier 3) spends a Master Seal
// (needsSeal). Seals are items (MASTER_SEAL), bought
// from the merchant or won as a stage reward, held in the convoy or a
// unit's inventory; a promotion spends the unit's own first, then the
// convoy's, then another unit's. The promotion's gift weapon goes in the
// unit's main hand, whatever it held (and a shield beside a two-handed
// gift) going to the convoy. Everything here is
// pure: each function returns a new frozen run and leaves its input alone.

import { equipGear, getGearLayout } from '../equipment.ts';
import { MASTER_SEAL } from '../items.ts';
import { canPromote, findPromotion, getPromotions, needsSeal, promoteUnit, type Promotion } from '../promotions.ts';
import type { UnitClass } from '../unitClasses.ts';
import { getUnitEquipment } from './convoy.ts';
import {
  restoreUnit,
  snapshotEquipment,
  snapshotUnit,
  type ItemSnapshot,
  type RunState,
  type UnitSnapshot,
} from './run.ts';

// How many Master Seals the warband holds, in the convoy and on its units.
export function countSeals(run: Pick<RunState, 'convoy' | 'roster'>): number {
  const count = (items: readonly ItemSnapshot[]) => items.filter((entry) => entry.itemId === MASTER_SEAL.id).length;
  return count(run.convoy) + run.roster.reduce((total, unit) => total + count(unit.items), 0);
}

// The roster units that could promote (canPromote), in roster order,
// whether or not the warband has a seal.
export function getPromotionCandidates(run: Pick<RunState, 'roster'>): UnitSnapshot[] {
  return run.roster.filter((unit) => canPromote(unit));
}

// Whether the unit `unitId` can promote to `promotionId` now: it's on the
// roster, can promote, the promotion is one of its class's, and the
// warband holds a seal when the promotion needs one (needsSeal).
export function canPromoteInRun(run: RunState, unitId: string, promotionId: string): boolean {
  const unit = run.roster.find((snapshot) => snapshot.id === unitId);
  if (!unit || !canPromote(unit)) return false;
  const promotion = getPromotions(unit.classId).find((candidate) => candidate.id === promotionId);
  return !!promotion && (!needsSeal(promotion) || countSeals(run) > 0);
}

// Whether any roster unit can take any of its promotions now.
export function canAnyonePromote(run: RunState): boolean {
  return getPromotionCandidates(run).some((unit) =>
    getPromotions(unit.classId).some((promotion) => canPromoteInRun(run, unit.id, promotion.id)),
  );
}

// The run after the unit `unitId` promotes to `promotionId`: a seal spent
// when the promotion needs one (its own, else the convoy's, else the first
// other unit's that has one),
// the unit promoted (promoteUnit) and its promotion's gift weapon in its
// main hand, what that displaces at the end of the convoy. Throws when
// it can't (see canPromoteInRun).
export function promoteInRun(
  run: RunState,
  unitId: string,
  promotionId: string,
  classes?: readonly UnitClass[],
): RunState {
  if (!canPromoteInRun(run, unitId, promotionId)) throw new Error(`${unitId} can't promote to ${promotionId}`);
  const promotion = findPromotion(promotionId)!;
  const paid = needsSeal(promotion) ? spendSeal(run, unitId) : run;
  const snapshot = paid.roster.find((unit) => unit.id === unitId)!;
  const promoted = snapshotUnit(unitId, promoteUnit(restoreUnit(snapshot, classes), promotion));
  const { unit, convoy } = handOverGift(promoted, paid.convoy, promotion);
  return freeze({
    ...paid,
    roster: paid.roster.map((held) => (held.id === unitId ? unit : held)),
    convoy,
  });
}

function spendSeal(run: RunState, unitId: string): RunState {
  const isSeal = (entry: ItemSnapshot) => entry.itemId === MASTER_SEAL.id;
  const holds = (unit: UnitSnapshot) => unit.items.some(isSeal);
  const without = (items: readonly ItemSnapshot[]) => {
    const index = items.findIndex(isSeal);
    return items.filter((_, i) => i !== index);
  };
  const own = run.roster.find((unit) => unit.id === unitId)!;
  if (!holds(own) && run.convoy.some(isSeal)) return freeze({ ...run, convoy: without(run.convoy) });
  const payer = holds(own) ? own : run.roster.find(holds)!;
  return freeze({
    ...run,
    roster: run.roster.map((unit) => (unit.id === payer.id ? { ...unit, items: without(unit.items) } : unit)),
  });
}

function handOverGift(
  unit: UnitSnapshot,
  convoy: readonly ItemSnapshot[],
  promotion: Promotion,
): { unit: UnitSnapshot; convoy: readonly ItemSnapshot[] } {
  const { gift } = promotion;
  if (!gift) return { unit, convoy };
  const { equipment, removed } = equipGear(getUnitEquipment(unit), gift, getGearLayout(unit.classId), unit.classId);
  return {
    unit: { ...unit, equipment: snapshotEquipment(equipment) },
    convoy: [...convoy, ...removed.map((gear) => ({ itemId: gear.id, quantity: 1 }))],
  };
}

function freeze(run: RunState): RunState {
  return Object.freeze({
    ...run,
    roster: Object.freeze(
      run.roster.map((unit) =>
        Object.freeze({
          ...unit,
          items: Object.freeze(unit.items.map((entry) => Object.freeze({ ...entry }))),
          ...(unit.equipment && { equipment: Object.freeze({ ...unit.equipment }) }),
        }),
      ),
    ),
    convoy: Object.freeze(run.convoy.map((entry) => Object.freeze({ ...entry }))),
  });
}
