// Every change to a battle is a command: a plain, serializable object
// (see BattleCommand) that applyCommand turns into the next state, plus the
// events saying what happened, which the map scene plays back as
// animations. The same commands come from the player's input, the enemy
// AI (ai.ts) or a pre-made list (runner.ts), so a battle can be undone
// (history.ts) or played through without the game running. Pure: the
// state passed in is never changed, and the dice come from the state's own
// seeded rolls. No Phaser.

import { getAttackTargets, resolveCombat, type Strike, type TargetTile } from '../combat.ts';
import { canDeployUnit, canDeployUnitAt, canStartBattle, isPlaced, placeUnit } from '../deployment.ts';
import { getPhaseMovement } from '../enemyAI.ts';
import { getCombatAward, getCombatOutcome, type ExperienceAward, type ExperienceGain } from '../experience.ts';
import { findTileAt, findUnit, getDistance, moveUnit, setUnit, type Grid, type Point } from '../grid.ts';
import { getHealAmount, getHealTargets, HEAL_EXPERIENCE, isStaff, isWounded } from '../healing.ts';
import { canUseItem, findItem, type Consumable, type Item } from '../items.ts';
import { claimLoot, getLootQuantity } from '../loot.ts';
import { getMovePath, getMovementRange, canMoveAlongPath, type MovementOptions } from '../movement.ts';
import { getObjectiveOutcome } from '../objectives.ts';
import { createResumableRng } from '../rng.ts';
import { calculateSkillDamage, canUseSkill, findLearnedSkill, type Skill } from '../skills.ts';
import { areAllied, getTeamUnitIds, isAllyOf, isHostileTo } from '../teams.ts';
import {
  createTurnState,
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
  // Uses a learned skill on the hostile unit on `target`.
  | { type: 'skill'; unitId: string; skillId: string; target: Point }
  // Heals the wounded ally on `target` with the staff in slot `staffIndex`.
  | { type: 'heal'; unitId: string; staffIndex: number; target: Point }
  // Uses a consumable on the unit itself.
  | { type: 'item'; unitId: string; itemId: string }
  // Ends the unit's action without doing anything.
  | { type: 'wait'; unitId: string }
  // Ends the current phase early; units that haven't acted forfeit.
  | { type: 'end-phase' };

export type BattleCommandType = BattleCommand['type'];

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
  | { type: 'skill'; unitId: string; targetId: string; skill: Skill; damage: number; health: number }
  | { type: 'healed'; unitId: string; targetId: string; amount: number }
  | { type: 'item-used'; unitId: string; item: Consumable; amount: number }
  // A defeated unit's loot went to `unitId`, or to the convoy when `stored`.
  | { type: 'loot'; unitId: string; item: Item; stored: boolean }
  | { type: 'defeated'; unitId: string; at: Point }
  // XP gained, with where the unit's level and XP stood before it.
  | { type: 'experience'; unitId: string; from: { level: number; experience: number }; result: ExperienceGain }
  | { type: 'unit-done'; unitId: string }
  | { type: 'phase-started'; turnState: TurnState }
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
      rngState: this.rngState(),
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
  startPhase(draft, createTurnState());
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
    const { broke, learned, leftover } = striker.spendWeaponUse();
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
      defeat(draft, struckId);
      break;
    }
  }
  awardCombatExperience(draft, ids, strikes);
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
  const result = unit.gainExperience(amount, draft.rng, scaled);
  draft.events.push({ type: 'experience', unitId, from, result });
}

// A skill always lands: mana is spent and its damage dealt, and it earns XP
// like a single strike that hit.
function useSkill(draft: Draft, unitId: string, skillId: string, target: Point) {
  const user = requireActor(draft, unitId);
  const skill =
    findLearnedSkill(user.unitClass, user.level, skillId) ?? draft.fail(`${unitId} doesn't know ${skillId}`);
  if (!canUseSkill(user, skill)) draft.fail(`${unitId} can't afford ${skillId}`);
  const from = draft.tileOf(unitId);
  const targets = getAttackTargets(draft.grid, from, skill.range, hostileTo(draft.units, user));
  const tile = findTileAt(targets, target) ?? draft.fail(`no foe in reach on (${target.x}, ${target.y})`);

  const defender = draft.edit(tile.unitId);
  const damage = calculateSkillDamage(skill, user, defender);
  draft.edit(unitId).spendMana(skill.manaCost);
  defender.takeDamage(damage);
  draft.events.push({ type: 'skill', unitId, targetId: tile.unitId, skill, damage, health: defender.health });
  const lethal = !defender.isAlive();
  if (lethal) {
    dropLoot(draft, tile.unitId, unitId);
    defeat(draft, tile.unitId);
  }
  const strikes: Strike[] = [{ by: 'attacker', target: 'defender', damage, hit: true, crit: false, lethal }];
  grantExperience(draft, unitId, getCombatAward(draft.unit(unitId), defender, getCombatOutcome(strikes, 'attacker')));
  finishAction(draft, unitId);
}

function heal(draft: Draft, unitId: string, staffIndex: number, target: Point) {
  const healer = requireActor(draft, unitId);
  const staff = healer.items[staffIndex]?.item;
  if (!staff || !isStaff(staff)) draft.fail(`${unitId} has no staff in slot ${staffIndex}`);
  const from = draft.tileOf(unitId);
  const canHeal = (otherId: string) => {
    const other = draft.units.get(otherId);
    return otherId !== unitId && other !== undefined && areAllied(other.team, healer.team) && isWounded(other);
  };
  const targets = getHealTargets(draft.grid, from, staff, canHeal);
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

// Takes a unit at 0 health off the map, keeping it with the fallen.
function defeat(draft: Draft, unitId: string) {
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
  const turnState = draft.turnState;
  if (isPhaseOver(turnState, getTeamUnitIds(draft.units, turnState.team))) startPhase(draft, getNextPhase(draft));
}

// The phase after the current one, with a guest phase only while a guest
// is in play.
function getNextPhase(draft: Draft): TurnState {
  return nextPhase(draft.turnState!, getTeamUnitIds(draft.units, 'guest').length > 0);
}

// A new phase can decide the battle on its own (a survive objective).
function startPhase(draft: Draft, turnState: TurnState) {
  draft.turnState = turnState;
  draft.events.push({ type: 'phase-started', turnState });
  checkOutcome(draft);
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
