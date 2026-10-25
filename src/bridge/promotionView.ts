// Snapshot of the camp's promotion screen (src/game/warband/promotionScreen.ts)
// for React: the options with the cursor, the seals the warband holds, and
// what the highlighted promotion would do to its unit. Plain frozen data,
// built fresh from the screen's state.

import type { GrowthStat } from '../game/experience.ts';
import { findPromotion, getPromotionGains } from '../game/promotions.ts';
import { SKILL_TREES } from '../game/skills.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES, type UnitClass } from '../game/unitClasses.ts';
import { completesEvolution } from '../game/warband/evolutions.ts';
import { countSeals } from '../game/warband/promotion.ts';
import type { PromotionScreenState } from '../game/warband/promotionScreen.ts';
import { restoreUnit } from '../game/warband/run.ts';

export interface PromotionOptionView {
  key: string;
  label: string;
  disabled: boolean;
}

// The highlighted promotion: who and into what, the stats it adds (after
// caps), its new weapon types, skill, passive and gift, and whether it
// completes an evolution.
export interface PromotionDetailView {
  name: string;
  level: number;
  fromClass: string;
  toClass: string;
  sprite: string;
  description: string;
  gains: readonly { label: string; value: number }[];
  movement: number;
  weaponTypes: readonly string[];
  skill: { label: string; manaCost: number; range: number } | null;
  passive: { name: string; description: string };
  gift: string | null;
  evolves: boolean;
}

export interface PromotionScreenView {
  seals: number;
  selectedIndex: number;
  options: readonly PromotionOptionView[];
  detail: PromotionDetailView | null;
}

const STAT_LABELS: Readonly<Record<GrowthStat, string>> = Object.freeze({
  health: 'HP',
  mana: 'MP',
  strength: 'STR',
  magic: 'MAG',
  skill: 'SKL',
  speed: 'SPD',
  luck: 'LCK',
  defense: 'DEF',
  resistance: 'RES',
});

export function toPromotionScreenView(
  state: PromotionScreenState,
  classes: readonly UnitClass[] = UNIT_CLASSES,
): PromotionScreenView {
  const { run, menu } = state;
  const option = menu.actions[menu.selectedIndex];
  return Object.freeze({
    seals: countSeals(run),
    selectedIndex: menu.selectedIndex,
    options: Object.freeze(
      menu.actions.map((action) =>
        Object.freeze({ key: action.id, label: action.label, disabled: action.disabled ?? false }),
      ),
    ),
    detail: option ? toDetail(state, option.unitId, option.promotionId, classes) : null,
  });
}

function toDetail(
  state: PromotionScreenState,
  unitId: string,
  promotionId: string,
  classes: readonly UnitClass[],
): PromotionDetailView | null {
  const snapshot = state.run.roster.find((unit) => unit.id === unitId);
  const promotion = findPromotion(promotionId);
  if (!snapshot || !promotion) return null;
  const unit = restoreUnit(snapshot, classes);
  const gains = getPromotionGains(unit, promotion);
  const tree = SKILL_TREES[promotion.id] ?? [];
  const skill = tree[tree.length - 1]?.skill ?? null;
  return Object.freeze({
    name: snapshot.name,
    level: snapshot.level,
    fromClass: classes.find((unitClass) => unitClass.id === snapshot.classId)?.label ?? snapshot.classId,
    toClass: promotion.label,
    sprite: getUnitSprite(promotion.id),
    description: promotion.description,
    gains: Object.freeze(
      (Object.entries(gains) as [GrowthStat, number][]).map(([stat, value]) =>
        Object.freeze({ label: STAT_LABELS[stat], value }),
      ),
    ),
    movement: promotion.bonuses.movement ?? 0,
    weaponTypes: promotion.weaponTypes,
    skill: skill && Object.freeze({ label: skill.label, manaCost: skill.manaCost, range: skill.range }),
    passive: Object.freeze({ name: promotion.passive.name, description: promotion.passive.description }),
    gift: promotion.gift?.label ?? null,
    evolves: completesEvolution(snapshot, state.run.relics, { classId: promotion.id }),
  });
}
