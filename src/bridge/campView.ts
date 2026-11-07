import { getExperienceToNextLevel } from '../game/experience.ts';
import { canPromote } from '../game/promotions.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES, type UnitClass } from '../game/unitClasses.ts';
import { getCampActions, getRestCost, type CampActionId } from '../game/warband/camp.ts';
import { lookUpItem } from '../game/warband/convoy.ts';
import { getPromotionCandidates } from '../game/warband/promotion.ts';
import type { RegionSettings } from '../game/warband/regions.ts';
import { restoreRoster, RUN_ITEMS, type RunState } from '../game/warband/run.ts';
import { getRunSite, getSiteRegion, isInTown, isRealmRun } from '../game/warband/travel.ts';
import type { Item } from '../game/items.ts';
import { KIND_TEXT } from './overworldView.ts';
import { toRelicViews, toUnitDetailView, type RelicView, type UnitDetailView } from './views.ts';

// Snapshot of the camp between Warband stages for React's CampScreen: where
// the warband is, every unit on the roster with the one shown in full, its
// supplies, its relics, and a note for each of the camp's actions. Plain
// frozen data, built fresh from the run (see src/game/warband/camp.ts).

export interface CampUnitView {
  id: string;
  name: string;
  classLabel: string;
  level: number;
  health: number;
  maxHealth: number;
  sprite: string;
  // Below full HP, flagged on its row.
  hurt: boolean;
  // Could take a promotion (promotions.ts), flagged on its row.
  promotable: boolean;
}

export interface CampSupplyView {
  id: string;
  label: string;
  quantity: number;
}

export interface CampView {
  // The stage fought next, and the run's final one (none when it never
  // ends in victory).
  stage: number;
  finalStage: number | null;
  // Where the warband camps on the realm (its site's name and kind, the
  // region it plays), or nothing on a run that fights stage after stage.
  site: { name: string; kindLabel: string; region: string | null } | null;
  units: readonly CampUnitView[];
  // The unit shown in full, and its sheet (as the unit info screen draws
  // it); -1 and null with nobody on the roster.
  unitIndex: number;
  unit: UnitDetailView | null;
  // XP the shown unit needs for its next level.
  experienceToNext: number;
  gold: number;
  // The potions in the convoy, and how many entries it holds in all.
  supplies: readonly CampSupplyView[];
  convoyCount: number;
  relics: readonly RelicView[];
  // A short note at each action's end: what it offers right now.
  notes: Readonly<Partial<Record<CampActionId, string>>>;
}

export function toCampView(
  run: RunState,
  settings: RegionSettings,
  unitIndex: number,
  classes: readonly UnitClass[] = UNIT_CLASSES,
  items: readonly Item[] = RUN_ITEMS,
): CampView {
  const index = run.roster.length === 0 ? -1 : Math.min(Math.max(0, unitIndex), run.roster.length - 1);
  const snapshot = index >= 0 ? run.roster[index] : null;
  const unit = snapshot
    ? toUnitDetailView(restoreRoster({ ...run, roster: [snapshot] }, classes, items).get(snapshot.id))
    : null;
  const site = getRunSite(run);
  const supplies = run.convoy
    .map((entry) => ({ entry, item: lookUpItem(entry.itemId, items) }))
    .filter(({ item }) => item.kind === 'consumable')
    .map(({ entry, item }) => Object.freeze({ id: item.id, label: item.label, quantity: entry.quantity }));
  return Object.freeze({
    stage: run.stage,
    finalStage: settings.finalStage ?? null,
    site: site
      ? Object.freeze({
          name: site.name,
          kindLabel: KIND_TEXT[site.kind].label,
          region: getSiteRegion(run, settings)?.name ?? null,
        })
      : null,
    units: Object.freeze(
      run.roster.map((entry) =>
        Object.freeze({
          id: entry.id,
          name: entry.name,
          classLabel: classes.find((c) => c.id === entry.classId)?.label ?? entry.classId,
          level: entry.level,
          health: entry.health,
          maxHealth: entry.maxHealth,
          sprite: getUnitSprite(entry.classId),
          hurt: entry.health < entry.maxHealth,
          promotable: canPromote(entry),
        }),
      ),
    ),
    unitIndex: index,
    unit,
    experienceToNext: snapshot ? getExperienceToNextLevel(snapshot.level, snapshot.experience) : 0,
    gold: run.gold,
    supplies: Object.freeze(supplies),
    convoyCount: run.convoy.length,
    relics: toRelicViews(run.relics, run.stage, run.keystone),
    notes: getCampNotes(run),
  });
}

// What each action offers right now, for the end of its row: how many
// units the roster holds, who can promote, what a rest costs and heals,
// and where travelling leads.
export function getCampNotes(run: RunState): Readonly<Partial<Record<CampActionId, string>>> {
  const notes: Partial<Record<CampActionId, string>> = {};
  const actions = getCampActions(run);
  const hurt = run.roster.filter((unit) => unit.health < unit.maxHealth || unit.mana < unit.maxMana).length;
  const cost = getRestCost(run);
  for (const action of actions) {
    if (action.id === 'roster') notes.roster = `${run.roster.length} ${run.roster.length === 1 ? 'unit' : 'units'}`;
    else if (action.id === 'merchant') notes.merchant = isInTown(run) ? 'in town' : 'open';
    else if (action.id === 'promote') {
      const ready = getPromotionCandidates(run);
      notes.promote = ready.length === 1 ? ready[0].name : `${ready.length} ready`;
    } else if (action.id === 'rest') {
      const price = cost > 0 ? `${cost} gold` : 'free';
      notes.rest = hurt > 0 ? `${price} · heals ${hurt}` : price;
    } else if (action.id === 'march') notes.march = isRealmRun(run) ? 'to the map' : `stage ${run.stage}`;
  }
  return Object.freeze(notes);
}
