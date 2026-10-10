// Pure conversions from game objects to plain, frozen snapshots for the UI.
// React only ever sees these — never live Unit instances — so a mutation
// like takeDamage() can't silently change what's on screen without a new
// snapshot being published (and a re-render being triggered).

import { DAMAGE_TYPES, getDamageType, type CombatSide, type DamageType, type ForecastSide } from '../game/combat.ts';
import { getAttackSpeed, getAvoid, getCrit, getHit } from '../game/combatStats.ts';
import type { Dialog, DialogSide } from '../game/dialog.ts';
import { MAX_LEVEL, type ExperienceGain, type GrowthStat, type LevelUpResult } from '../game/experience.ts';
import type { ObjectiveText } from '../game/objectives.ts';
import type { Point } from '../game/grid.ts';
import type { Team, TurnState } from '../game/turns.ts';
import type { RunState } from '../game/warband/run.ts';
import { describeReward, type Reward, type RewardKind } from '../game/warband/rewards.ts';
import type { MenuAction } from '../game/actionMenu.ts';
import { getLearnedSkills } from '../game/skills.ts';
import type { Unit } from '../game/Unit.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { formatWeaponRange, type WeaponType } from '../game/weapons.ts';

// One inventory slot. `quantity` is how many are left (for a weapon, its
// uses left), or null for a weapon that never breaks; `equipped` marks
// the weapon the unit fights with.
export interface ItemView {
  id: string;
  label: string;
  quantity: number | null;
  weapon: boolean;
  equipped: boolean;
}

export interface UnitView {
  name: string;
  unitClass: string | null;
  team: Team;
  level: number;
  experience: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  strength: number;
  magic: number;
  skill: number;
  speed: number;
  luck: number;
  defense: number;
  resistance: number;
  movement: number;
  range: string;
  weapon: string | null;
  items: readonly ItemView[];
}

// One stat on the unit info screen: its value and the most its class can
// raise it to (null when the class sets no cap).
export interface StatLineView {
  id: GrowthStat;
  label: string;
  value: number;
  cap: number | null;
}

// The equipped weapon's full numbers, for the unit info screen.
export interface WeaponDetailView {
  label: string;
  type: WeaponType;
  might: number;
  hit: number;
  crit: number;
  weight: number;
  range: string;
  uses: number | null;
  maxUses: number | null;
}

export interface SkillView {
  id: string;
  label: string;
  manaCost: number;
  range: number;
}

// The unit info screen's full stat sheet: everything the hover panel shows
// plus the class name, stat caps, the rates it fights with, its equipped
// weapon's numbers, the weapon types it can wield and the skills it knows.
export interface UnitDetailView extends UnitView {
  classLabel: string | null;
  maxLevel: boolean;
  stats: readonly StatLineView[];
  damageType: DamageType;
  attack: number;
  hit: number;
  avoid: number;
  crit: number;
  attackSpeed: number;
  equippedWeapon: WeaponDetailView | null;
  weaponTypes: readonly WeaponType[];
  skills: readonly SkillView[];
}

// The visible world rectangle's top-left plus the zoom.
export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

// A map tile's edges, as fractions (0–1) of the canvas.
export interface TileAnchorView {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ForecastSideView extends ForecastSide {
  name: string;
  team: Team;
  weapon: string | null;
}

export interface CombatForecastView {
  attacker: ForecastSideView;
  defender: ForecastSideView;
  anchor: TileAnchorView;
}

export type PopupKind = 'damage' | 'crit' | 'miss' | 'health' | 'mana' | 'broke';

export interface DamagePopupView {
  id: number;
  amount: number;
  kind: PopupKind;
  text: string;
  x: number;
  y: number;
  durationMs: number;
}

export interface RosterEntryView {
  id: string;
  label: string;
  sprite: string;
  placed: boolean;
  disabled: boolean;
}

export interface ExperienceGainView {
  id: number;
  name: string;
  level: number;
  gained: number;
  startPercent: number;
  endPercent: number;
  durationMs: number;
}

export interface LevelUpStatView {
  id: GrowthStat;
  label: string;
  value: number;
  gain: number;
}

export interface LevelUpView {
  id: number;
  name: string;
  level: number;
  stats: readonly LevelUpStatView[];
  skills: readonly string[];
  durationMs: number;
}

export interface TurnView {
  turn: number;
  team: Team;
  label: string;
}

export interface PhaseBannerView extends TurnView {
  id: number;
  durationMs: number;
}

export interface ObjectiveView extends ObjectiveText {
  // The battle's title, e.g. "Stage 2: Lakeside" (see describeBattle).
  battle: string;
}

// A reward offered after a Warband Mode stage, as a menu entry. A recruit
// carries its stat line, so it can be judged before it's picked.
export interface RewardAction extends MenuAction {
  kind: RewardKind;
  description: string;
  stats: readonly { label: string; value: number }[] | null;
}

// What a cleared Warband Mode stage paid, shown on the result and the
// reward screen.
export interface StageClearView {
  // The stage just cleared.
  stage: number;
  // Gold the clear paid, and whether that included the flawless bonus.
  gold: number;
  flawless: boolean;
  // The warband's gold after the clear.
  totalGold: number;
}

// What the result screen says when a Warband Mode run ends.
export interface RunOverView {
  // The stage the warband fell on.
  stage: number;
  // Every unit lost over the run, battle by battle.
  fallen: readonly string[];
}

export interface DialogView {
  id: number;
  speaker: string;
  side: DialogSide;
  text: string;
  portrait: string | null;
  sprite: string | null;
  revealed: boolean;
  charsPerSecond: number;
  isLast: boolean;
}

// Snapshot of a unit for the HUD. `range` is its equipped weapon's range
// ("1", "1–2"), or "–" with no weapon, and `weapon` that weapon's name.
export function toUnitView(unit: Unit | null | undefined): UnitView | null {
  if (!unit) return null;
  const equipped = unit.equippedWeapon;
  return Object.freeze({
    name: unit.name,
    unitClass: unit.unitClass,
    team: unit.team,
    level: unit.level,
    experience: unit.experience,
    health: unit.health,
    maxHealth: unit.maxHealth,
    mana: unit.mana,
    maxMana: unit.maxMana,
    strength: unit.strength,
    magic: unit.magic,
    skill: unit.skill,
    speed: unit.speed,
    luck: unit.luck,
    defense: unit.defense,
    resistance: unit.resistance,
    movement: unit.movement,
    range: equipped ? formatWeaponRange(equipped.weapon) : '–',
    weapon: equipped?.weapon.label ?? null,
    items: Object.freeze(
      (unit.items ?? []).map(({ item, quantity }, index) =>
        Object.freeze({
          id: item.id,
          label: item.label,
          quantity: item.kind === 'weapon' && item.uses === null ? null : quantity,
          weapon: item.kind === 'weapon',
          equipped: index === equipped?.index,
        }),
      ),
    ),
  });
}

// The stats on the unit info screen, in display order (HP and MP show as bars).
const DETAIL_STATS: readonly (readonly [Exclude<GrowthStat, 'health' | 'mana'>, string])[] = Object.freeze([
  ['strength', 'STR'],
  ['magic', 'MAG'],
  ['skill', 'SKL'],
  ['speed', 'SPD'],
  ['luck', 'LCK'],
  ['defense', 'DEF'],
  ['resistance', 'RES'],
]);

// Snapshot of a unit for the unit info screen: toUnitView's fields plus
// its class's display name, each stat with its cap, the rates it fights
// with before any opponent is counted (attack is its power stat plus its
// weapon's might; hit, avoid, crit and attack speed from combatStats.ts),
// its equipped weapon's numbers, the weapon types it can wield and the
// skills it has learned. `maxLevel` is set once it can't level any more.
export function toUnitDetailView(unit: Unit | null | undefined): UnitDetailView | null {
  const view = toUnitView(unit);
  if (!unit || !view) return null;
  const equipped = unit.equippedWeapon;
  const weapon = equipped?.weapon ?? null;
  const damageType = getDamageType(unit);
  return Object.freeze({
    ...view,
    classLabel: UNIT_CLASSES.find((c) => c.id === unit.unitClass)?.label ?? unit.unitClass,
    maxLevel: unit.level >= MAX_LEVEL,
    stats: Object.freeze(
      DETAIL_STATS.map(([id, label]) => Object.freeze({ id, label, value: unit[id], cap: unit.caps[id] ?? null })),
    ),
    damageType,
    attack: unit[DAMAGE_TYPES[damageType].power] + (weapon?.might ?? 0),
    hit: getHit(unit),
    avoid: getAvoid(unit),
    crit: getCrit(unit),
    attackSpeed: getAttackSpeed(unit),
    equippedWeapon: weapon
      ? Object.freeze({
          label: weapon.label,
          type: weapon.type,
          might: weapon.might,
          hit: weapon.hit,
          crit: weapon.crit,
          weight: weapon.weight,
          range: formatWeaponRange(weapon),
          uses: equipped!.uses,
          maxUses: weapon.uses,
        })
      : null,
    weaponTypes: unit.weaponTypes,
    skills: Object.freeze(
      getLearnedSkills(unit.unitClass, unit.level).map(({ id, label, manaCost, range }) =>
        Object.freeze({ id, label, manaCost, range }),
      ),
    ),
  });
}

// Converts a world-space point to screen pixels (relative to the canvas and
// the HUD overlay that shares its box), at the canvas's own resolution. `camera` is the visible world
// rectangle's top-left plus the zoom: { x, y, zoom }.
export function worldToScreen(point: Point, camera: CameraView): Point {
  return {
    x: (point.x - camera.x) * camera.zoom,
    y: (point.y - camera.y) * camera.zoom,
  };
}

// Converts a point in canvas pixels to fractions (0–1) of the canvas size,
// so map-anchored UI stays in place however large the canvas is displayed.
// `size` is the canvas's { width, height }.
export function toCanvasFraction(point: Point, size: Size): Point {
  return { x: point.x / size.width, y: point.y / size.height };
}

// Snapshot of where a map tile shows on the canvas, for UI anchored beside
// it (e.g. a unit's menus): its edges as fractions of the canvas (see
// toCanvasFraction), so it stays put however large the canvas is displayed.
// `tile` is { x, y } in grid cells, `camera` as in worldToScreen, and `size`
// the canvas's { width, height }.
export function toTileAnchorView(tile: Point, tileSize: number, camera: CameraView, size: Size): TileAnchorView {
  const topLeft = toCanvasFraction(worldToScreen({ x: tile.x * tileSize, y: tile.y * tileSize }, camera), size);
  const bottomRight = toCanvasFraction(
    worldToScreen({ x: (tile.x + 1) * tileSize, y: (tile.y + 1) * tileSize }, camera),
    size,
  );
  return Object.freeze({ left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y });
}

// The smallest TileAnchorView covering both a and b (e.g. an attacker's
// and its target's tiles), so UI placed beside it covers neither.
export function mergeTileAnchors(a: TileAnchorView, b: TileAnchorView): TileAnchorView {
  return Object.freeze({
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  });
}

// Snapshot of the combat forecast shown while aiming an attack, from
// getCombatForecast (src/game/combat.ts): per side, the unit's name and
// team, the name of the weapon it fights with (null for none), plus its
// forecast numbers (damage / hit / crit are null for a defender that
// can't counter, which the UI shows as "–"). `anchor` is a TileAnchorView
// covering both units, which the panel opens beside.
export function toCombatForecastView({
  forecast,
  attacker,
  defender,
  anchor,
}: {
  forecast: Record<CombatSide, ForecastSide>;
  attacker: Pick<Unit, 'name' | 'team' | 'weapon'>;
  defender: Pick<Unit, 'name' | 'team' | 'weapon'>;
  anchor: TileAnchorView;
}): CombatForecastView {
  const side = (unit: Pick<Unit, 'name' | 'team' | 'weapon'>, numbers: ForecastSide) =>
    Object.freeze({ name: unit.name, team: unit.team, weapon: unit.weapon?.label ?? null, ...numbers });
  return Object.freeze({
    attacker: side(attacker, forecast.attacker),
    defender: side(defender, forecast.defender),
    anchor,
  });
}

// How each kind of popup reads: damage is the bare number (a crit calls
// itself out), a miss says so, recovery says what was restored, and a
// weapon that wore out says it broke.
const POPUP_TEXT: Readonly<Record<PopupKind, (amount: number) => string>> = Object.freeze({
  damage: (amount) => `${amount}`,
  crit: (amount) => `Crit! ${amount}`,
  miss: () => 'Miss',
  health: (amount) => `+${amount} HP`,
  mana: (amount) => `+${amount} MP`,
  broke: () => 'Broke!',
});

// Snapshot of one floating number over a unit: damage taken (plain, a
// crit, or a miss), health or mana recovered, or its weapon breaking
// (`kind` is 'damage' | 'crit' | 'miss' | 'health' | 'mana' | 'broke', which the UI
// colors by; `text` is what it shows). `x`/`y` are the point the number
// rises from, as fractions of the canvas (see toCanvasFraction); `durationMs` is how long it stays up,
// so the UI animation and the store entry's lifetime agree.
export function toDamagePopupView({
  id,
  amount,
  kind = 'damage',
  x,
  y,
  durationMs,
}: Omit<DamagePopupView, 'kind' | 'text'> & { kind?: PopupKind }): DamagePopupView {
  const text = (POPUP_TEXT[kind] ?? POPUP_TEXT.damage)(amount);
  return Object.freeze({ id, amount, kind, text, x, y, durationMs });
}

// Snapshot of one unit in the deployment roster menu: its id, the name to
// show, the sprite to draw (a texture key), and whether it's already on
// the map. `disabled` is set when it can't be placed because every slot
// is taken (see canDeployUnit); it defaults to false.
export function toRosterEntryView({
  id,
  unit,
  sprite,
  placed,
  disabled = false,
}: {
  id: string;
  unit: Pick<Unit, 'name'>;
  sprite: string;
  placed: boolean;
  disabled?: boolean;
}): RosterEntryView {
  return Object.freeze({ id, label: unit.name, sprite, placed, disabled });
}

// Snapshot of the XP bar shown after a player unit's combat: its name, the
// level it started at, how many XP it gained, and the bar's fill (0–100)
// before and after — a level up fills it to 100, and the level-up panel
// takes over from there. `from` is the unit's { level, experience } before
// the gain and `result` the resolveExperienceGain result (src/game/
// experience.ts). `id` changes per bar so the UI restarts its animation.
export function toExperienceGainView({
  id,
  name,
  from,
  result,
  durationMs,
}: {
  id: number;
  name: string;
  from: { level: number; experience: number };
  result: ExperienceGain;
  durationMs: number;
}): ExperienceGainView {
  return Object.freeze({
    id,
    name,
    level: from.level,
    gained: result.amount,
    startPercent: from.experience,
    endPercent: result.levelUps.length > 0 ? 100 : result.experience,
    durationMs,
  });
}

// How each growth stat is labelled on the level-up panel, in display order.
const LEVEL_UP_STATS: readonly (readonly [GrowthStat, string])[] = Object.freeze([
  ['health', 'HP'],
  ['mana', 'MP'],
  ['strength', 'STR'],
  ['magic', 'MAG'],
  ['skill', 'SKL'],
  ['speed', 'SPD'],
  ['luck', 'LCK'],
  ['defense', 'DEF'],
  ['resistance', 'RES'],
]);

// Snapshot of the level-up panel for one level gained: the unit's name, the
// level reached, each stat's new value and gain (from a levelUps entry of
// resolveExperienceGain), and the labels of any skills learned. `id`
// changes per panel so the UI restarts its animation.
export function toLevelUpView({
  id,
  name,
  levelUp,
  durationMs,
}: {
  id: number;
  name: string;
  levelUp: LevelUpResult;
  durationMs: number;
}): LevelUpView {
  return Object.freeze({
    id,
    name,
    level: levelUp.level,
    stats: Object.freeze(
      LEVEL_UP_STATS.map(([stat, label]) =>
        Object.freeze({ id: stat, label, value: levelUp.stats[stat], gain: levelUp.gains[stat] ?? 0 }),
      ),
    ),
    skills: Object.freeze(levelUp.skills.map((skill) => skill.label)),
    durationMs,
  });
}

const PHASE_LABELS: Readonly<Record<Team, string>> = Object.freeze({ player: 'Player Phase', enemy: 'Enemy Phase' });

// Snapshot of whose phase it is, from a turn state (src/game/turns.ts):
// the turn number, the team, and the phase's display name.
export function toTurnView(turnState: TurnState | null | undefined): TurnView | null {
  if (!turnState) return null;
  const { turn, team } = turnState;
  return Object.freeze({ turn, team, label: PHASE_LABELS[team] ?? team });
}

// Snapshot of the banner announcing a new phase. `id` changes per banner so
// the UI restarts its animation; `durationMs` is how long it stays up.
export function toPhaseBannerView({
  id,
  turnState,
  durationMs,
}: {
  id: number;
  turnState: TurnState;
  durationMs: number;
}): PhaseBannerView {
  return Object.freeze({ id, ...toTurnView(turnState)!, durationMs });
}

// Snapshot of the line the dialog box shows, from a dialog
// (src/game/dialog.ts). `id` changes per line so the UI restarts its
// typing; `portrait` is the speaker's portrait art (a sprite key) and
// `sprite` the unit art standing in when there is none (either may be null); `revealed` is true once the player has skipped the
// typing, and `charsPerSecond` is how fast it types otherwise, so the UI
// and the scene agree on when a line is fully shown.
export function toDialogView({
  id,
  dialog,
  sprite,
  charsPerSecond,
}: {
  id: number;
  dialog: Dialog;
  sprite?: string | null;
  charsPerSecond: number;
}): DialogView {
  const { speaker, side, portrait, text } = dialog.lines[dialog.index];
  return Object.freeze({
    id,
    speaker,
    side,
    text,
    portrait,
    sprite: sprite ?? null,
    revealed: dialog.revealed,
    charsPerSecond,
    isLast: dialog.index === dialog.lines.length - 1,
  });
}

// Snapshot for the Objective screen: the battle's title and its objective's
// words (src/game/objectives.ts).
export function toObjectiveView(battle: string, text: ObjectiveText): ObjectiveView {
  return Object.freeze({ battle, goal: text.goal, defeat: text.defeat });
}

// Snapshot for the result screen of a run that has ended
// (src/game/warband/run.ts).
export function toRunOverView(run: Pick<RunState, 'stage' | 'fallen'>): RunOverView {
  return Object.freeze({ stage: run.stage, fallen: Object.freeze(run.fallen.map((unit) => unit.name)) });
}

// A reward as an entry of the reward screen's menu (see
// src/game/warband/rewards.ts).
export function toRewardAction(reward: Reward, index: number): RewardAction {
  const { label, description } = describeReward(reward);
  const unit = reward.kind === 'recruit' ? reward.unit : null;
  const stats = unit
    ? Object.freeze(
        (
          [
            ['HP', unit.maxHealth],
            ['STR', unit.strength],
            ['MAG', unit.magic],
            ['SKL', unit.skill],
            ['SPD', unit.speed],
            ['DEF', unit.defense],
            ['RES', unit.resistance],
          ] as const
        ).map(([stat, value]) => Object.freeze({ label: stat, value })),
      )
    : null;
  return Object.freeze({ id: `${reward.kind}-${index}`, label, kind: reward.kind, description, stats });
}

// Snapshot of what a cleared stage paid (see getStageClearGold).
export function toStageClearView(
  stage: number,
  clear: { gold: number; flawless: boolean },
  totalGold: number,
): StageClearView {
  return Object.freeze({ stage, gold: clear.gold, flawless: clear.flawless, totalGold });
}
