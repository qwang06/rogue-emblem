// Every change to a battle is a command: a plain, serializable object
// (see BattleCommand) that applyCommand turns into the next state, plus the
// events saying what happened, which the map scene plays back as
// animations. The same commands come from the player's input, the enemy
// AI (ai.ts) or a pre-made list (runner.ts), so a battle can be undone
// (history.ts) or played through without the game running. Pure: the
// state passed in is never changed, and the dice come from the state's own
// seeded rolls. No Phaser.

import {
  canArrive,
  getBossRules,
  getHornUnitId,
  isHornTurn,
  pickHornTile,
  shouldEnrage,
  type BossState,
} from '../bosses.ts';
import { getAttackTargets, resolveCombat, type Strike, type TargetTile } from '../combat.ts';
import { canDeployUnit, canDeployUnitAt, canStartBattle, isPlaced, placeUnit } from '../deployment.ts';
import { getPhaseMovement } from '../enemyAI.ts';
import {
  getCombatAward,
  getCombatOutcome,
  growToLevel,
  type ExperienceAward,
  type ExperienceGain,
} from '../experience.ts';
import { findTileAt, findUnit, getCell, getDistance, moveUnit, setUnit, type Grid, type Point } from '../grid.ts';
import { getHealAmount, getHealTargets, HEAL_EXPERIENCE, isStaff, isWounded } from '../healing.ts';
import { canUseItem, findItem, type Consumable, type Item } from '../items.ts';
import { claimLoot, getLootQuantity } from '../loot.ts';
import { getMovePath, getMovementRange, canMoveAlongPath, type MovementOptions } from '../movement.ts';
import { getObjectiveOutcome } from '../objectives.ts';
import { getPushDirection, getPushResult, type PushResult } from '../push.ts';
import { createResumableRng } from '../rng.ts';
import { addStatus, clearStatuses, type StatusId, type StatusKind } from '../statuses.ts';
import {
  calculateSkillDamage,
  canUseSkill,
  findUnitSkill,
  getFollowUpDamage,
  getSkillAreaTiles,
  getSkillHealAmount,
  isBuffSkill,
  isHealingSkill,
  type Skill,
} from '../skills.ts';
import { hasModifier, sumModifiers } from '../modifiers.ts';
import { areAllied, getTeamUnitIds, isAllyOf, isHostileTo } from '../teams.ts';
import { createUnitOfClass, UNIT_CLASSES } from '../unitClasses.ts';
import {
  getFirstPhase,
  hasMoved,
  isDone,
  isPhaseOver,
  markDone,
  markMoved,
  nextPhase,
  type BattleOutcome,
  type TurnState,
} from '../turns.ts';
import type { Rng } from '../combatStats.ts';
import type { Unit } from '../Unit.ts';
import { findTakenBoon, getBoonRank, isBoonEligible, parseBoonEntry, takeBoon } from '../warband/boons.ts';
import type { ItemSnapshot } from '../warband/run.ts';
import type { Weapon } from '../weapons.ts';
import { getBattleSnapshot, type BattleStage, type BattleState } from './state.ts';

// What a side can tell the battle to do. Tiles are { x, y } map positions;
// unitIds are the level's (see the level's units map).
export type BattleCommand =
  // Deployment: put a roster unit on a zone tile (again, to move it).
  | { type: 'place'; unitId: string; to: Point }
  // Ends deployment: unplaced roster units sit the battle out; turn 1 starts.
  | { type: 'start-battle' }
  // Moves a unit of the phase's team that hasn't moved yet. `path` is the
  // route it walks (from its tile to `to`), the cheapest one if left out.
  | { type: 'move'; unitId: string; to: Point; path?: readonly Point[] }
  // Equips the weapon in inventory slot `index`. Doesn't end its action.
  | { type: 'equip'; unitId: string; index: number }
  // Attacks the hostile unit on `target` with the equipped weapon.
  | { type: 'attack'; unitId: string; target: Point }
  // Uses a learned skill on the hostile unit on `target` (the wounded ally
  // there, for a healing skill).
  | { type: 'skill'; unitId: string; skillId: string; target: Point }
  // Heals the wounded ally on `target` with the staff in slot `staffIndex`.
  | { type: 'heal'; unitId: string; staffIndex: number; target: Point }
  // Uses a consumable on the unit itself.
  | { type: 'item'; unitId: string; itemId: string }
  // Ends the unit's action without doing anything.
  | { type: 'wait'; unitId: string }
  // Ends the current phase early; units that haven't acted forfeit.
  | { type: 'end-phase' }
  // A Warband unit's pick for reaching `level`: gives it the boon `boonId`
  // (see warband/levelUpPicks.ts). Taken as the level up happens, so it
  // isn't an action: it ends no turn and can follow the battle's last blow.
  | { type: 'take-boon'; unitId: string; level: number; boonId: string };

// What a command did, in the order it happened, for the scene to play.
export type BattleEvent =
  | { type: 'placed'; unitId: string; to: Point }
  | { type: 'battle-started'; benched: readonly string[] }
  | { type: 'moved'; unitId: string; from: Point; to: Point; path: readonly Point[] }
  | { type: 'equipped'; unitId: string; weapon: Weapon }
  // One strike of an exchange. `health` is the struck unit's health after
  // it. `broke` / `learned`: the strike wore out the striker's weapon /
  // taught the spell of the tome it struck with.
  | {
      type: 'strike';
      strikerId: string;
      targetId: string;
      hit: boolean;
      crit: boolean;
      damage: number;
      health: number;
      broke: boolean;
      learned: Weapon | null;
    }
  // A skill's blow. `splash`: one of an area skill's blows past the tile it
  // was aimed at, which lands with the first blow rather than with an
  // animation of its own. `followUp`: a followUp skill's second blow.
  | {
      type: 'skill';
      unitId: string;
      targetId: string;
      skill: Skill;
      damage: number;
      health: number;
      splash?: boolean;
      followUp?: boolean;
    }
  // A skill left `status` on `targetId` (statuses.ts).
  | { type: 'status'; unitId: string; targetId: string; status: StatusId }
  // A push skill shoved `push.unitId` (see push.ts). `health` is the shoved
  // unit's health after it, `collidedHealth` that of the unit it slammed
  // into, if any. A unit it left at 0 health (or drowned) is `defeated` next.
  | { type: 'pushed'; unitId: string; push: PushResult; health: number; collidedHealth: number | null }
  // A heal, with a staff or with `skill` (a healing skill, which spent its
  // mana).
  | { type: 'healed'; unitId: string; targetId: string; amount: number; skill?: Skill }
  | { type: 'item-used'; unitId: string; item: Consumable; amount: number }
  // A modifier's recovery (see modifiers.ts): HP healed on a kill
  // (`trigger` 'kill'), or HP or MP recovered as the unit's phase starts
  // ('phase').
  | {
      type: 'recovered';
      unitId: string;
      stat: 'health' | 'mana';
      amount: number;
      trigger: 'kill' | 'phase' | 'drain';
    }
  // A recoil skill cost its user `damage` HP, leaving it `health`.
  | { type: 'recoil'; unitId: string; damage: number; health: number }
  // A defeated unit's loot went to `unitId`, or to the convoy when `stored`.
  | { type: 'loot'; unitId: string; item: Item; stored: boolean }
  | { type: 'defeated'; unitId: string; at: Point }
  // XP gained, with where the unit's level and XP stood before it.
  | { type: 'experience'; unitId: string; from: { level: number; experience: number }; result: ExperienceGain }
  | { type: 'unit-done'; unitId: string }
  | { type: 'phase-started'; turnState: TurnState }
  // A boss's rules (see bosses.ts): its war horn marked `at` for an
  // arrival next enemy phase; that arrival came (`unitId`, done for the
  // phase it arrives in) or was blocked by `blockerId` standing there; or
  // a hit left it enraged, `strength` STR up and on the move.
  | { type: 'war-horn'; unitId: string; at: Point }
  | { type: 'reinforced'; unitId: string; at: Point }
  | { type: 'reinforcement-blocked'; blockerId: string | null; at: Point }
  | { type: 'boss-enraged'; unitId: string; strength: number }
  | { type: 'outcome'; outcome: BattleOutcome };

// The event of one type, e.g. BattleEventOf<'strike'>.
export type BattleEventOf<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>;

// The first event of `type` among `events`, if any.
export function findEvent<T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): BattleEventOf<T> | undefined {
  return events.find((event): event is BattleEventOf<T> => event.type === type);
}

export interface CommandResult {
  state: BattleState;
  events: readonly BattleEvent[];
}

// A command the battle can't carry out as it stands (a unit out of turn,
// a tile out of range, ...). The state is left as it was.
export class BattleCommandError extends Error {
  constructor(
    readonly command: BattleCommand,
    message: string,
  ) {
    super(`${command.type}: ${message}`);
    this.name = 'BattleCommandError';
  }
}

// The next state after `command`, and what happened on the way. Throws a
// BattleCommandError if the command isn't allowed (`state` is untouched
// either way).
export function applyCommand(state: BattleState, command: BattleCommand): CommandResult {
  const draft = new Draft(state, command);
  switch (command.type) {
    case 'place':
      place(draft, command.unitId, command.to);
      break;
    case 'start-battle':
      startBattle(draft);
      break;
    case 'move':
      move(draft, command.unitId, command.to, command.path);
      break;
    case 'equip':
      equip(draft, command.unitId, command.index);
      break;
    case 'attack':
      attack(draft, command.unitId, command.target);
      break;
    case 'skill':
      useSkill(draft, command.unitId, command.skillId, command.target);
      break;
    case 'heal':
      heal(draft, command.unitId, command.staffIndex, command.target);
      break;
    case 'item':
      useItem(draft, command.unitId, command.itemId);
      break;
    case 'wait':
      requireActor(draft, command.unitId);
      finishAction(draft, command.unitId);
      break;
    case 'end-phase':
      requireBattle(draft);
      startPhase(draft, getNextPhase(draft));
      break;
    case 'take-boon':
      takeLevelUpBoon(draft, command.unitId, command.level, command.boonId);
      break;
    default:
      draft.fail(`unknown command ${JSON.stringify(command)}`);
  }
  return { state: draft.finish(), events: draft.events };
}

// Movement options for `unit`: allies can be walked through, anyone else
// blocks.
export function getMovementOptions(units: ReadonlyMap<string, { team: Unit['team'] }>, unit: Unit): MovementOptions {
  return { canPassThrough: (unitId: string) => isAllyOf(units, unit.team, unitId) };
}

// Whether a unitId is hostile to `unit` (on another team).
export function hostileTo(units: ReadonlyMap<string, { team: Unit['team'] }>, unit: Unit) {
  return (unitId: string) => isHostileTo(units, unit.team, unitId);
}

// Whether the unit `otherId` is one `healerId` can heal: an ally of its,
// not itself, and wounded.
export function woundedAllyOf(units: ReadonlyMap<string, Unit>, healerId: string) {
  const healer = units.get(healerId);
  return (otherId: string) => {
    const other = units.get(otherId);
    return (
      otherId !== healerId &&
      healer !== undefined &&
      other !== undefined &&
      areAllied(other.team, healer.team) &&
      isWounded(other)
    );
  };
}

// Whether the unit `otherId` is an ally of `unitId`'s, not itself.
function allyOf(units: ReadonlyMap<string, Unit>, unitId: string) {
  const user = units.get(unitId);
  return (otherId: string) => {
    const other = units.get(otherId);
    return otherId !== unitId && user !== undefined && other !== undefined && areAllied(other.team, user.team);
  };
}

// Whether `skill`, used by `unitId`, affects the unit `otherId`: a wounded
// ally for a healing skill, any ally for a buff; for any other, a foe, or
// for a friendlyFire one anyone but the user.
function affectedBy(units: ReadonlyMap<string, Unit>, unitId: string, skill: Skill) {
  const user = units.get(unitId)!;
  if (isHealingSkill(skill)) return woundedAllyOf(units, unitId);
  if (isBuffSkill(skill)) return allyOf(units, unitId);
  if (skill.friendlyFire) return (otherId: string) => otherId !== unitId && units.has(otherId);
  return hostileTo(units, user);
}

// The tiles the unit `unitId` can use `skill` on from `from`: hostile units
// in its range, or wounded allies for a healing skill, or allies for a buff. A skill with range 0
// is aimed at the user's own tile, which it can use when its area holds
// anyone it affects (getSkillVictims).
export function getSkillTargets(
  grid: Grid,
  units: ReadonlyMap<string, Unit>,
  unitId: string,
  from: Point,
  skill: Skill,
): TargetTile[] {
  const user = units.get(unitId);
  if (!user) return [];
  if (skill.range === 0) {
    const self = { x: from.x, y: from.y, unitId };
    return getSkillVictims(grid, units, unitId, from, skill, self).length > 0 ? [self] : [];
  }
  return getAttackTargets(grid, from, skill.range, affectedBy(units, unitId, { ...skill, friendlyFire: false }));
}

// Everyone `skill`, used by `unitId` from `from` and aimed at `target`,
// lands on, as [{ x, y, unitId }]: the unit on `target` (never the user,
// for a range-0 skill), then each unit it affects on the tiles its area
// reaches (getSkillAreaTiles), in that order. Doesn't check that `target`
// is in reach (getSkillTargets does).
export function getSkillVictims(
  grid: Grid,
  units: ReadonlyMap<string, Unit>,
  unitId: string,
  from: Point,
  skill: Skill,
  target: Point,
): TargetTile[] {
  if (!units.has(unitId)) return [];
  const affects = affectedBy(units, unitId, skill);
  const victims: TargetTile[] = [];
  const aimed = getCell(grid, target.x, target.y)?.unitId;
  if (aimed && aimed !== unitId) victims.push({ x: target.x, y: target.y, unitId: aimed });
  for (const tile of getSkillAreaTiles(skill, from, target)) {
    const other = getCell(grid, tile.x, tile.y)?.unitId;
    if (other && affects(other)) victims.push({ x: tile.x, y: tile.y, unitId: other });
  }
  return victims;
}

// The state being built from the last one: the parts a command changes,
// copied, and the units it changes cloned once each.
class Draft {
  grid: Grid;
  units: Map<string, Unit>;
  stage: BattleStage;
  turnState: TurnState | null;
  outcome: BattleOutcome | null;
  deployed: readonly string[];
  fallen: Map<string, Unit>;
  convoyLoot: ItemSnapshot[];
  kills: Map<string, number>;
  boss: BossState | null;
  readonly events: BattleEvent[] = [];
  readonly rng: Rng;
  private readonly rngState: () => number;
  private readonly cloned = new Set<string>();

  constructor(
    readonly base: BattleState,
    readonly command: BattleCommand,
  ) {
    this.grid = base.grid;
    this.units = new Map(base.units);
    this.stage = base.stage;
    this.turnState = base.turnState;
    this.outcome = base.outcome;
    this.deployed = base.deployed;
    this.fallen = new Map(base.fallen);
    this.convoyLoot = [...base.convoyLoot];
    this.kills = new Map(base.kills);
    this.boss = base.boss;
    const { rng, state } = createResumableRng(base.rngState);
    this.rng = rng;
    this.rngState = state;
  }

  fail(message: string): never {
    throw new BattleCommandError(this.command, message);
  }

  // A unit in play, to read. Fails the command when there's none.
  unit(unitId: string): Unit {
    return this.units.get(unitId) ?? this.fail(`no unit ${unitId} in play`);
  }

  // A unit in play, to change: cloned the first time, so the last state's
  // unit is left alone.
  edit(unitId: string): Unit {
    const unit = this.unit(unitId);
    if (this.cloned.has(unitId)) return unit;
    const copy = unit.clone();
    this.units.set(unitId, copy);
    this.cloned.add(unitId);
    return copy;
  }

  tileOf(unitId: string): Point {
    return findUnit(this.grid, unitId) ?? this.fail(`${unitId} isn't on the map`);
  }

  finish(): BattleState {
    return Object.freeze({
      ...this.base,
      grid: this.grid,
      units: this.units,
      stage: this.stage,
      turnState: this.turnState,
      outcome: this.outcome,
      deployed: this.deployed,
      fallen: this.fallen,
      convoyLoot: Object.freeze(this.convoyLoot),
      kills: this.kills,
      rngState: this.rngState(),
      boss: this.boss,
    });
  }
}

function place(draft: Draft, unitId: string, to: Point) {
  const { roster, deploymentZone, deploymentLimit } = draft.base;
  if (draft.stage !== 'deployment') draft.fail('the battle has already started');
  if (!roster.includes(unitId)) draft.fail(`${unitId} isn't on the roster`);
  if (!canDeployUnitAt(draft.grid, deploymentZone, roster, deploymentLimit, unitId, to.x, to.y)) {
    draft.fail(
      canDeployUnit(draft.grid, roster, deploymentLimit, unitId)
        ? `${unitId} can't be placed on (${to.x}, ${to.y})`
        : 'every slot is taken',
    );
  }
  draft.grid = placeUnit(draft.grid, deploymentZone, unitId, to.x, to.y, roster);
  draft.events.push({ type: 'placed', unitId, to: { x: to.x, y: to.y } });
}

// Levels without a deployment zone (training) start with everyone on the
// map, so there's nothing to check there.
function startBattle(draft: Draft) {
  const { roster, deploymentZone } = draft.base;
  if (draft.stage !== 'deployment') draft.fail('the battle has already started');
  if (deploymentZone.length > 0 && !canStartBattle(draft.grid, roster)) draft.fail('no unit is placed');
  const deployed = roster.filter((unitId) => isPlaced(draft.grid, unitId));
  const benched = roster.filter((unitId) => !deployed.includes(unitId));
  for (const unitId of benched) draft.units.delete(unitId);
  draft.deployed = Object.freeze(deployed);
  draft.stage = 'battle';
  draft.events.push({ type: 'battle-started', benched: Object.freeze(benched) });
  startPhase(draft, getFirstPhase(1, hasGuests(draft)));
}

function requireBattle(draft: Draft) {
  if (draft.stage !== 'battle') draft.fail('the battle has not started');
  if (draft.outcome) draft.fail(`the battle is over (${draft.outcome})`);
}

// The unit giving an order: in play, on the phase's team, not done yet.
function requireActor(draft: Draft, unitId: string): Unit {
  requireBattle(draft);
  const unit = draft.unit(unitId);
  const turnState = draft.turnState!;
  if (unit.team !== turnState.team) draft.fail(`it's the ${turnState.team} phase, not ${unitId}'s`);
  if (isDone(turnState, unitId)) draft.fail(`${unitId} has already acted`);
  return unit;
}

// Gives `unitId` the boon it picked for reaching `level`: one it's
// eligible for, at a level it has reached.
function takeLevelUpBoon(draft: Draft, unitId: string, level: number, boonId: string) {
  if (draft.stage !== 'battle') draft.fail('the battle has not started');
  const unit = draft.unit(unitId);
  if (level > unit.level) draft.fail(`${unitId} hasn't reached level ${level}`);
  const boon =
    findTakenBoon(boonId, getBoonRank(unit.boons, parseBoonEntry(boonId).id) + 1) ?? draft.fail(`no boon ${boonId}`);
  if (!isBoonEligible(unit, boon)) draft.fail(`${unitId} can't take ${boonId}`);
  takeBoon(draft.edit(unitId), boon);
}

function move(draft: Draft, unitId: string, to: Point, path?: readonly Point[]) {
  const unit = requireActor(draft, unitId);
  if (hasMoved(draft.turnState!, unitId)) draft.fail(`${unitId} has already moved`);
  const from = draft.tileOf(unitId);
  const movement = getPhaseMovement(unit);
  const options = getMovementOptions(draft.units, unit);
  const range = getMovementRange(draft.grid, from, movement, options);
  if (!findTileAt(range, to)) draft.fail(`(${to.x}, ${to.y}) is out of ${unitId}'s reach`);
  const route = path ?? getMovePath(draft.grid, from, to, movement, options) ?? [from];
  if (!findTileAt([route[0]], from) || !canMoveAlongPath(range, route, to)) draft.fail('the path does not lead there');
  draft.grid = moveUnit(draft.grid, from, to);
  draft.turnState = markMoved(draft.turnState!, unitId);
  draft.events.push({
    type: 'moved',
    unitId,
    from,
    to: { x: to.x, y: to.y },
    path: route.map(({ x, y }) => ({ x, y })),
  });
}

function equip(draft: Draft, unitId: string, index: number) {
  const unit = requireActor(draft, unitId);
  if (!unit.wieldableWeapons.some((weapon) => weapon.index === index)) {
    draft.fail(`${unitId} has no weapon it can wield in slot ${index}`);
  }
  const weapon = draft.edit(unitId).equip(index);
  draft.events.push({ type: 'equipped', unitId, weapon });
}

// One unit attacks another with its equipped weapon (see resolveCombat):
// the exchange is rolled, every strike wears the striker's weapon (and a
// tome strike can teach its spell), hits are applied in turn, a unit
// brought to 0 health leaves the map (dropping its loot to a player
// killer), and the player unit in the fight, if it lived, earns its XP.
function attack(draft: Draft, unitId: string, target: Point) {
  const attacker = requireActor(draft, unitId);
  const weapon = attacker.weapon ?? draft.fail(`${unitId} has no weapon`);
  const from = draft.tileOf(unitId);
  const targets = getAttackTargets(
    draft.grid,
    from,
    weapon.maxRange,
    hostileTo(draft.units, attacker),
    weapon.minRange,
  );
  const tile = findTileAt(targets, target) ?? draft.fail(`no foe in reach on (${target.x}, ${target.y})`);
  resolveAttack(draft, unitId, tile, from);
  finishAction(draft, unitId);
}

function resolveAttack(draft: Draft, attackerId: string, target: TargetTile, from: Point) {
  const attacker = draft.unit(attackerId);
  const defender = draft.unit(target.unitId);
  const { strikes } = resolveCombat(attacker, defender, { distance: getDistance(from, target), rng: draft.rng });
  const ids = { attacker: attackerId, defender: target.unitId };
  for (const strike of strikes) {
    const strikerId = ids[strike.by];
    const struckId = ids[strike.target];
    const striker = draft.edit(strikerId);
    // A killing blow can spare the weapon (a Whetstone).
    const spared = strike.lethal && hasModifier(striker.modifiers, 'spare-weapon-on-kill');
    const { broke, learned, leftover } = spared ? SPARED_STRIKE : striker.spendWeaponUse();
    if (learned && leftover && areAllied(striker.team, 'player')) {
      draft.convoyLoot.push({ itemId: leftover.item.id, quantity: leftover.quantity });
    }
    const struck = draft.edit(struckId);
    if (strike.hit) struck.takeDamage(strike.damage);
    draft.events.push({
      type: 'strike',
      strikerId,
      targetId: struckId,
      hit: strike.hit,
      crit: strike.crit,
      damage: strike.hit ? strike.damage : 0,
      health: struck.health,
      broke,
      learned,
    });
    if (!struck.isAlive()) {
      dropLoot(draft, struckId, strikerId);
      defeat(draft, struckId, strikerId);
      healOnKill(draft, strikerId);
      break;
    }
  }
  awardCombatExperience(draft, ids, strikes);
}

// What spendWeaponUse would say for a strike that didn't wear the weapon.
const SPARED_STRIKE = Object.freeze({ broke: false, learned: null, leftover: null });

// A unit that defeated a foe heals its kill-heal modifiers' HP.
function healOnKill(draft: Draft, unitId: string) {
  recover(draft, unitId, 'health', sumModifiers(draft.unit(unitId).modifiers, 'kill-heal'), 'kill');
}

// Restores up to `amount` of a unit's HP or MP for a modifier, with a
// `recovered` event when that restored anything.
function recover(
  draft: Draft,
  unitId: string,
  stat: 'health' | 'mana',
  amount: number,
  trigger: 'kill' | 'phase' | 'drain',
) {
  if (amount <= 0) return;
  const unit = draft.unit(unitId);
  const restored = Math.min(amount, stat === 'health' ? unit.maxHealth - unit.health : unit.maxMana - unit.mana);
  if (restored <= 0) return;
  const patient = draft.edit(unitId);
  if (stat === 'health') patient.heal(restored);
  else patient.restoreMana(restored);
  draft.events.push({ type: 'recovered', unitId, stat, amount: restored, trigger });
}

// Only the player's side (its units and guests) earns XP, and only if it
// lived through the fight.
function awardCombatExperience(draft: Draft, ids: { attacker: string; defender: string }, strikes: readonly Strike[]) {
  const unitOf = (unitId: string) => draft.units.get(unitId) ?? draft.fallen.get(unitId)!;
  const side = (['attacker', 'defender'] as const).find((s) => areAllied(unitOf(ids[s]).team, 'player'));
  if (!side || !draft.units.has(ids[side])) return;
  const unit = unitOf(ids[side]);
  const opponent = unitOf(ids[side === 'attacker' ? 'defender' : 'attacker']);
  grantExperience(draft, ids[side], getCombatAward(unit, opponent, getCombatOutcome(strikes, side)));
}

function grantExperience(draft: Draft, unitId: string, { amount, scaled }: ExperienceAward) {
  if (amount <= 0) return;
  const unit = draft.edit(unitId);
  const from = { level: unit.level, experience: unit.experience };
  const result = unit.gainExperience(amount, scaled);
  draft.events.push({ type: 'experience', unitId, from, result });
}

// A skill always lands: mana is spent and its damage dealt to the foe it's
// aimed at, then to everyone else its area reaches (getSkillVictims), and
// it earns XP like a single strike that hit the one it rewards most. A
// followUp skill strikes its target again; a push skill shoves it. A
// healing skill mends instead (mendWith).
function useSkill(draft: Draft, unitId: string, skillId: string, target: Point) {
  const user = requireActor(draft, unitId);
  const skill = findUnitSkill(user, skillId) ?? draft.fail(`${unitId} doesn't know ${skillId}`);
  if (!canUseSkill(user, skill)) draft.fail(`${unitId} can't afford ${skillId}`);
  if (isHealingSkill(skill)) {
    mendWith(draft, unitId, skill, target);
    return;
  }
  if (isBuffSkill(skill)) {
    buffWith(draft, unitId, skill, target);
    return;
  }
  const from = draft.tileOf(unitId);
  const targets = getSkillTargets(draft.grid, draft.units, unitId, from, skill);
  const tile = findTileAt(targets, target) ?? draft.fail(`no foe in reach on (${target.x}, ${target.y})`);
  const victims = getSkillVictims(draft.grid, draft.units, unitId, from, skill, tile);
  draft.edit(unitId).spendMana(skill.manaCost);

  // Every blow lands before anyone falls, so a defeat doesn't change who
  // the area reaches.
  const blows = victims.map((victim, i) => {
    const defender = draft.edit(victim.unitId);
    let damage = calculateSkillDamage(skill, draft.unit(unitId), defender);
    defender.takeDamage(damage);
    const splash = i > 0;
    draft.events.push({
      type: 'skill',
      unitId,
      targetId: victim.unitId,
      skill,
      damage,
      health: defender.health,
      ...(splash && { splash }),
    });
    if (!splash && defender.isAlive()) {
      const second = getFollowUpDamage(skill, damage);
      if (second > 0) {
        defender.takeDamage(second);
        damage += second;
        draft.events.push({
          type: 'skill',
          unitId,
          targetId: victim.unitId,
          skill,
          damage: second,
          health: defender.health,
          followUp: true,
        });
      }
    }
    return { victim, defender, damage };
  });

  if (skill.status) {
    for (const { victim, defender } of blows) {
      if (!defender.isAlive() || areAllied(defender.team, draft.unit(unitId).team)) continue;
      defender.statuses = addStatus(defender.statuses, skill.status);
      draft.events.push({ type: 'status', unitId, targetId: victim.unitId, status: skill.status });
    }
  }

  const [aimed] = blows;
  const shoved = skill.push && aimed?.defender.isAlive() ? push(draft, unitId, from, aimed.victim) : null;
  if (shoved) aimed.damage += shoved.damage;

  if (skill.drain) {
    const dealt = blows
      .filter(({ defender }) => !areAllied(defender.team, draft.unit(unitId).team))
      .reduce((sum, { damage }) => sum + damage, 0);
    recover(draft, unitId, 'health', Math.ceil(dealt * skill.drain), 'drain');
  }
  if (skill.recoil) {
    const self = draft.edit(unitId);
    const damage = Math.min(skill.recoil, self.health - 1);
    if (damage > 0) {
      self.takeDamage(damage);
      draft.events.push({ type: 'recoil', unitId, damage, health: self.health });
    }
  }

  let award: ExperienceAward | null = null;
  for (const { victim, defender, damage } of blows) {
    const lethal = !defender.isAlive();
    const hostile = !areAllied(defender.team, draft.unit(unitId).team);
    if (lethal) {
      if (hostile) dropLoot(draft, victim.unitId, unitId);
      defeat(draft, victim.unitId, hostile ? unitId : null);
      if (hostile) healOnKill(draft, unitId);
    }
    if (!hostile) continue;
    const strikes: Strike[] = [{ by: 'attacker', target: 'defender', damage, hit: true, crit: false, lethal }];
    const earned = getCombatAward(draft.unit(unitId), defender, getCombatOutcome(strikes, 'attacker'));
    if (!award || earned.amount > award.amount) award = earned;
  }
  if (shoved?.collidedId) knockOut(draft, shoved.collidedId, unitId);
  if (award) grantExperience(draft, unitId, award);
  finishAction(draft, unitId);
}

// Shoves the unit on `target` one tile away from `from` (getPushResult):
// it slides there and loses what the push costs it, or sinks to 0 health
// (and is taken off the map by the caller), and a unit it slammed into
// loses the bump too.
function push(draft: Draft, pusherId: string, from: Point, target: TargetTile): PushResult | null {
  const result = getPushResult(draft.grid, draft.units, target, getPushDirection(from, target));
  if (!result) return null;
  const shoved = draft.edit(result.unitId);
  if (result.moved && !result.drowned) draft.grid = moveUnit(draft.grid, result.from, result.to);
  shoved.takeDamage(result.drowned ? shoved.health : result.damage);
  const collided = result.collidedId ? draft.edit(result.collidedId) : null;
  collided?.takeDamage(result.collisionDamage);
  draft.events.push({
    type: 'pushed',
    unitId: pusherId,
    push: result,
    health: shoved.health,
    collidedHealth: collided?.health ?? null,
  });
  return result;
}

// Takes a unit a shove left at 0 health off the map: a kill for the
// shover when it was a foe, and a loss with no one to credit otherwise.
function knockOut(draft: Draft, unitId: string, shoverId: string) {
  if (draft.unit(unitId).isAlive()) return;
  const hostile = !areAllied(draft.unit(unitId).team, draft.unit(shoverId).team);
  if (hostile) dropLoot(draft, unitId, shoverId);
  defeat(draft, unitId, hostile ? shoverId : null);
  if (hostile) healOnKill(draft, shoverId);
}

// A healing skill on the wounded ally on `target` (or, for a range-0 one,
// aimed at the user's own tile), and every wounded ally its area reaches
// (getSkillVictims): its mana is spent, each regains getSkillHealAmount,
// and the user earns a heal's XP once.
function mendWith(draft: Draft, unitId: string, skill: Skill, target: Point) {
  const from = draft.tileOf(unitId);
  const targets = getSkillTargets(draft.grid, draft.units, unitId, from, skill);
  const tile = findTileAt(targets, target) ?? draft.fail(`no wounded ally in reach on (${target.x}, ${target.y})`);

  draft.edit(unitId).spendMana(skill.manaCost);
  for (const victim of getSkillVictims(draft.grid, draft.units, unitId, from, skill, tile)) {
    const patient = draft.edit(victim.unitId);
    const amount = getSkillHealAmount(skill, draft.unit(unitId), patient);
    patient.heal(amount);
    draft.events.push({ type: 'healed', unitId, targetId: victim.unitId, amount, skill });
  }
  grantExperience(draft, unitId, { amount: HEAL_EXPERIENCE, scaled: true });
  finishAction(draft, unitId);
}

// A buff skill on the ally on `target` (or, for a range-0 one, aimed at
// the user's own tile), and every ally its area reaches: its mana is
// spent, each is given its status (statuses.ts), and the user earns a
// heal's XP once.
function buffWith(draft: Draft, unitId: string, skill: Skill, target: Point) {
  const from = draft.tileOf(unitId);
  const targets = getSkillTargets(draft.grid, draft.units, unitId, from, skill);
  const tile = findTileAt(targets, target) ?? draft.fail(`no ally in reach on (${target.x}, ${target.y})`);

  draft.edit(unitId).spendMana(skill.manaCost);
  for (const victim of getSkillVictims(draft.grid, draft.units, unitId, from, skill, tile)) {
    const ally = draft.edit(victim.unitId);
    ally.statuses = addStatus(ally.statuses, skill.status!);
    draft.events.push({ type: 'status', unitId, targetId: victim.unitId, status: skill.status! });
  }
  grantExperience(draft, unitId, { amount: HEAL_EXPERIENCE, scaled: true });
  finishAction(draft, unitId);
}

function heal(draft: Draft, unitId: string, staffIndex: number, target: Point) {
  const healer = requireActor(draft, unitId);
  const staff = healer.items[staffIndex]?.item;
  if (!staff || !isStaff(staff)) draft.fail(`${unitId} has no staff in slot ${staffIndex}`);
  const from = draft.tileOf(unitId);
  const targets = getHealTargets(draft.grid, from, staff, woundedAllyOf(draft.units, unitId));
  const tile = findTileAt(targets, target) ?? draft.fail(`no wounded ally in reach on (${target.x}, ${target.y})`);

  const patient = draft.edit(tile.unitId);
  const amount = getHealAmount(healer, staff, patient);
  patient.heal(amount);
  draft.edit(unitId).spendStaffUse(staffIndex);
  draft.events.push({ type: 'healed', unitId, targetId: tile.unitId, amount });
  grantExperience(draft, unitId, { amount: HEAL_EXPERIENCE, scaled: true });
  finishAction(draft, unitId);
}

function useItem(draft: Draft, unitId: string, itemId: string) {
  const unit = requireActor(draft, unitId);
  const entry = findItem(unit.items, itemId);
  if (!entry || entry.item.kind !== 'consumable') draft.fail(`${unitId} carries no ${itemId}`);
  if (!canUseItem(unit, entry.item)) draft.fail(`${itemId} would restore nothing`);
  const { item, amount } = draft.edit(unitId).useItem(itemId);
  draft.events.push({ type: 'item-used', unitId, item, amount });
  finishAction(draft, unitId);
}

// A defeated unit's loot goes to the player unit (or guest) that felled
// it, or to the convoy when its bag is full (see claimLoot). Enemies take
// no loot.
function dropLoot(draft: Draft, deadId: string, killerId: string) {
  const loot = draft.unit(deadId).loot;
  if (!loot || !areAllied(draft.unit(killerId).team, 'player')) return;
  draft.edit(deadId).loot = null;
  const killer = draft.edit(killerId);
  const { inventory, stored } = claimLoot(killer.items, loot);
  killer.items = inventory;
  if (stored) draft.convoyLoot.push({ itemId: loot.id, quantity: getLootQuantity(loot) });
  draft.events.push({ type: 'loot', unitId: killerId, item: loot, stored });
}

// Takes a unit at 0 health (or drowned) off the map, keeping it with the
// fallen, and counts the kill for `killerId` (no one's when null).
function defeat(draft: Draft, unitId: string, killerId: string | null) {
  if (killerId) draft.kills.set(killerId, (draft.kills.get(killerId) ?? 0) + 1);
  const at = draft.tileOf(unitId);
  draft.grid = setUnit(draft.grid, at.x, at.y, null);
  draft.fallen.set(unitId, draft.unit(unitId));
  draft.units.delete(unitId);
  draft.events.push({ type: 'defeated', unitId, at });
}

// Ends a unit's action, then the battle if that decided it, or else the
// phase once every unit of its team has acted.
function finishAction(draft: Draft, unitId: string) {
  draft.turnState = markDone(draft.turnState!, unitId);
  draft.events.push({ type: 'unit-done', unitId });
  if (checkOutcome(draft)) return;
  enrageBoss(draft);
  const turnState = draft.turnState;
  if (isPhaseOver(turnState, getTeamUnitIds(draft.units, turnState.team))) startPhase(draft, getNextPhase(draft));
}

// The phase after the current one, with a guest phase only while a guest
// is in play.
function getNextPhase(draft: Draft): TurnState {
  return nextPhase(draft.turnState!, hasGuests(draft));
}

function hasGuests(draft: Draft): boolean {
  return getTeamUnitIds(draft.units, 'guest').length > 0;
}

// A new phase can decide the battle on its own (a survive objective).
// Otherwise an enemy phase plays its boss's horn (runBossHorn), and the
// phase's units recover their phase-heal and phase-mana modifiers' HP and
// MP.
// Starts `turnState`'s phase. The debuffs on the team whose phase just
// ended and the buffs on the team whose phase starts wear off first
// (statuses.ts).
function startPhase(draft: Draft, turnState: TurnState) {
  const wearOff = (team: TurnState['team'], kind: StatusKind) => {
    for (const unitId of getTeamUnitIds(draft.units, team)) {
      const { statuses } = draft.unit(unitId);
      const left = clearStatuses(statuses, kind);
      if (left.length !== statuses.length) draft.edit(unitId).statuses = left;
    }
  };
  const ended = draft.turnState?.team;
  if (ended) wearOff(ended, 'debuff');
  wearOff(turnState.team, 'buff');
  draft.turnState = turnState;
  draft.events.push({ type: 'phase-started', turnState });
  if (checkOutcome(draft)) return;
  if (turnState.team === 'enemy') runBossHorn(draft);
  for (const unitId of getTeamUnitIds(draft.units, turnState.team)) {
    const { modifiers } = draft.unit(unitId);
    recover(draft, unitId, 'health', sumModifiers(modifiers, 'phase-heal'), 'phase');
    recover(draft, unitId, 'mana', sumModifiers(modifiers, 'phase-mana'), 'phase');
  }
}

function checkOutcome(draft: Draft): boolean {
  if (draft.outcome) return true;
  const snapshot = getBattleSnapshot({
    ...draft.base,
    grid: draft.grid,
    units: draft.units,
    turnState: draft.turnState,
  });
  const outcome = getObjectiveOutcome(draft.base.objective, snapshot);
  if (!outcome) return false;
  draft.outcome = outcome;
  draft.events.push({ type: 'outcome', outcome });
  return true;
}

// The boss's horn as an enemy phase starts, while the boss is in play:
// the arrival its last call marked comes, done for this phase (or is
// blocked by whoever stands on its tile), then, on a horn turn, it marks
// the tile for the next one.
function runBossHorn(draft: Draft) {
  const boss = draft.boss;
  const horn = boss && getBossRules(boss.rulesId)?.horn;
  if (!boss || !horn || !draft.units.has(boss.unitId)) return;
  let { incoming, called } = boss;
  if (incoming) {
    const at = incoming;
    if (canArrive(draft.grid, at)) {
      called += 1;
      const unitId = getHornUnitId(called);
      const label = UNIT_CLASSES.find((c) => c.id === horn.unitClass)?.label ?? horn.unitClass;
      const arrival = createUnitOfClass(horn.unitClass, { name: `Enemy ${label}`, team: 'enemy' });
      growToLevel(arrival, horn.level);
      draft.units.set(unitId, arrival);
      draft.grid = setUnit(draft.grid, at.x, at.y, unitId);
      draft.turnState = markDone(draft.turnState!, unitId);
      draft.events.push({ type: 'reinforced', unitId, at });
    } else {
      const blockerId = getCell(draft.grid, at.x, at.y)?.unitId ?? null;
      draft.events.push({ type: 'reinforcement-blocked', blockerId, at });
    }
    incoming = null;
  }
  const turn = draft.turnState!.turn;
  if (isHornTurn(horn, turn, { called, incoming })) {
    const at = pickHornTile(draft.grid, draft.tileOf(boss.unitId), horn.reach);
    if (at) {
      incoming = Object.freeze(at);
      draft.events.push({ type: 'war-horn', unitId: boss.unitId, at });
    }
  }
  draft.boss = Object.freeze({ ...boss, incoming, called });
}

// A boss whose last hit left it at or under its enrage share enrages: its
// STR rises and it stops holding its ground.
function enrageBoss(draft: Draft) {
  const boss = draft.boss;
  const enrage = boss && getBossRules(boss.rulesId)?.enrage;
  const unit = boss && draft.units.get(boss.unitId);
  if (!boss || !enrage || !unit || !shouldEnrage(enrage, boss, unit.health, unit.maxHealth)) return;
  const raging = draft.edit(boss.unitId);
  raging.strength += enrage.strength;
  raging.holdsPosition = false;
  draft.boss = Object.freeze({ ...boss, enraged: true });
  draft.events.push({ type: 'boss-enraged', unitId: boss.unitId, strength: enrage.strength });
}
