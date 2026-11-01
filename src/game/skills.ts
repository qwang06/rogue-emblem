// Pure rules for unit skills. Each unit class has a skill tree: a list of
// { level, skill } entries, and a unit knows every skill in its class's
// tree whose level it has reached — so skills are gained by leveling up —
// then those of its secondary class's tree it has reached the same way (a
// second skill set taught at camp, Final Fantasy Tactics style, see
// warband/mentors.ts), plus any its modifiers teach it (a level-up boon,
// see modifiers.ts). Using a skill costs mana. No Phaser, no rendering, no
// hidden state.

import type { MenuAction } from './actionMenu.ts';
import {
  calculateDamage,
  DAMAGE_TYPES,
  getDamageType,
  getFighterBonus,
  type CombatSide,
  type DamageStats,
  type ForecastSide,
  type SkillFighter,
} from './combat.ts';
import type { Point } from './grid.ts';
import { STATUSES, type StatusId } from './statuses.ts';
import { getModifierSkills, type Modifier } from './modifiers.ts';

// A skill: { id, label, manaCost, range, animation, might?, damageScale?,
// push?, effect?, power? }. Its damage is a variant of the user's regular
// hit: `might` (default 0) is added to the user's attack power, and the
// resulting damage is multiplied by `damageScale` (default 1). `range` is
// how far away (orthogonal steps) the target can be, and `animation` names
// the effect the presentation layer plays for it. A `push` skill also
// shoves a target it leaves standing one tile away from the user (see
// push.ts). A skill whose `effect` is 'heal' deals no damage: it mends a
// wounded ally instead, restoring its `power` plus the user's intelligence (like
// a staff, see healing.ts), or `intelligenceScale` of it.
//
// An `area` skill reaches past the tile it's aimed at (getSkillAreaTiles):
// 'sides' also strikes the tiles on either side of the target, 'line' the
// tile behind it (seen from the user), 'burst' the four tiles around it. A
// healing area skill mends every wounded ally there instead. It strikes
// only foes there unless it has `friendlyFire`, which strikes every unit
// but the user. A skill with range 0 is aimed at the user's own tile (an
// area around itself). `followUp` strikes the target a second time, at that
// fraction of the first blow's damage. A `status` skill leaves that status
// (statuses.ts) on every foe it lands on that's still standing. A skill
// whose `effect` is 'buff' strikes no one: it gives its `status` to an
// ally instead (or to every ally its area reaches). A `drain` skill heals
// the user that share of the damage it dealt foes, rounded up; a `recoil`
// one costs the user that much HP (never its last); `monsterMight` is
// power added on top of `might` against a monster.
//
// Some skills move the user (see skillMoves.ts). A `leap` skill jumps it
// up to that many tiles to land next to its target before it strikes (a
// `straight` one only along a row or column, over free tiles: a charge);
// a `retreat` one steps it that many tiles straight back from its target
// after; a `strafe` one flies it that far in a line, striking every foe it
// passes over, and lands it on the farthest free tile. `chargeMight` adds
// 1 power for each tile the user walked this turn, up to that much. A
// skill whose `effect` is 'swap' trades places with the ally it's aimed
// at.
//
// Some skills are aimed at a tile rather than a unit (see terrainSkills.ts):
// a `mine` skill lays a hidden mine dealing that much on an empty tile,
// and a `breach` skill knocks down a wall or rock.
//
// A `selfStatus` skill also leaves that status on its user (Taunt).

export interface Skill {
  id: string;
  label: string;
  manaCost: number;
  range: number;
  animation: string;
  might?: number;
  damageScale?: number;
  push?: boolean;
  effect?: 'heal' | 'buff' | 'swap';
  power?: number;
  intelligenceScale?: number;
  area?: SkillArea;
  friendlyFire?: boolean;
  followUp?: number;
  status?: StatusId;
  drain?: number;
  recoil?: number;
  monsterMight?: number;
  leap?: number;
  straight?: boolean;
  retreat?: number;
  strafe?: number;
  chargeMight?: number;
  mine?: number;
  breach?: boolean;
  selfStatus?: StatusId;
}

export type SkillArea = 'sides' | 'line' | 'burst' | 'wide';

export interface SkillTreeEntry {
  level: number;
  skill: Skill;
}

export type SkillTrees = Readonly<Record<string, readonly SkillTreeEntry[]>>;

export interface SkillAction extends MenuAction {
  manaCost: number;
  description: string; // what the skill does (describeSkill), shown for the highlighted entry
}

// The tree for unitClass; a class without one (or no class) has none.
function treeOf(unitClass: string | null, trees: SkillTrees): readonly SkillTreeEntry[] {
  return (unitClass !== null && trees[unitClass]) || [];
}

// Stones lobbed at a distant foe: half the damage of the user's regular
// attack, from up to 4 tiles away.
export const THROW_STONES: Skill = Object.freeze({
  id: 'throw-stones',
  label: 'Throw Stones',
  manaCost: 2,
  range: 4,
  damageScale: 0.5,
  animation: 'stone',
});

// A heavier blow against an adjacent foe: the user's regular attack with
// 3 more power behind it.
export const POWER_STRIKE: Skill = Object.freeze({
  id: 'power-strike',
  label: 'Power Strike',
  manaCost: 2,
  range: 1,
  might: 3,
  animation: 'strike',
});

// An arrow loosed from further off than the bow reaches: the user's
// regular attack from up to 3 tiles away. Like every skill it can't be
// countered, and it can hit an adjacent foe the bow can't. Flies like a
// thrown stone until it gets an arrow of its own.
export const LONG_SHOT: Skill = Object.freeze({
  id: 'long-shot',
  label: 'Long Shot',
  manaCost: 2,
  range: 3,
  animation: 'stone',
});

// A wide swing of the axe: the user's regular attack on an adjacent foe
// and on any foe on either side of it.
export const CLEAVE: Skill = Object.freeze({
  id: 'cleave',
  label: 'Cleave',
  manaCost: 3,
  range: 1,
  area: 'sides',
  animation: 'strike',
});

// An arrow driven clean through: the user's regular attack on a foe up to
// 3 tiles away and on a foe right behind it.
export const PIERCING_SHOT: Skill = Object.freeze({
  id: 'piercing-shot',
  label: 'Piercing Shot',
  manaCost: 3,
  range: 3,
  area: 'line',
  animation: 'stone',
});

// The rider's spear run through two foes: the user's regular attack with
// 1 more power on an adjacent foe and on a foe right behind it.
export const SKEWER: Skill = Object.freeze({
  id: 'skewer',
  label: 'Skewer',
  manaCost: 3,
  range: 1,
  might: 1,
  area: 'line',
  animation: 'strike',
});

// Rider and beast together: the rider's spear, then the beast's bite, on
// one adjacent foe. The bite deals half the spear's damage.
export const TANDEM_STRIKE: Skill = Object.freeze({
  id: 'tandem-strike',
  label: 'Tandem Strike',
  manaCost: 3,
  range: 1,
  followUp: 0.5,
  animation: 'strike',
});

// A keg packed with nails: half the user's regular attack on a tile up to
// 2 tiles away and the four around it, striking allies there too.
export const SHRAPNEL: Skill = Object.freeze({
  id: 'shrapnel',
  label: 'Shrapnel',
  manaCost: 4,
  range: 2,
  damageScale: 0.5,
  area: 'burst',
  friendlyFire: true,
  animation: 'stone',
});

// A volley from the siege engine: half its regular attack on a foe up to
// 3 tiles away and on any foe on the four tiles around it.
export const BARRAGE: Skill = Object.freeze({
  id: 'barrage',
  label: 'Barrage',
  manaCost: 3,
  range: 3,
  damageScale: 0.5,
  area: 'burst',
  animation: 'stone',
});

// A prayer over the wounded around the user: every wounded ally next to it
// regains 1 plus half the user's intelligence.
export const PRAYER: Skill = Object.freeze({
  id: 'prayer',
  label: 'Prayer',
  manaCost: 5,
  range: 0,
  effect: 'heal',
  power: 1,
  intelligenceScale: 0.5,
  area: 'burst',
  animation: 'mend',
});

// A shove with the tower shield behind the spear: the user's regular
// attack with 1 more power behind it, against an adjacent foe, which it
// then pushes a tile away like Shove does (see push.ts).
export const SHIELD_BASH: Skill = Object.freeze({
  id: 'shield-bash',
  label: 'Shield Bash',
  manaCost: 3,
  range: 1,
  might: 1,
  push: true,
  animation: 'strike',
});

// A beat of the beast's wings: half its regular attack against an
// adjacent foe, which it pushes a tile away (see push.ts).
export const WING_BUFFET: Skill = Object.freeze({
  id: 'wing-buffet',
  label: 'Wing Buffet',
  manaCost: 2,
  range: 1,
  damageScale: 0.5,
  push: true,
  animation: 'strike',
});

// A careful shot from the siege engine at its longest reach: its regular
// attack from up to 5 tiles away.
export const DEADEYE: Skill = Object.freeze({
  id: 'deadeye',
  label: 'Deadeye',
  manaCost: 2,
  range: 5,
  animation: 'stone',
});

// A shove with no blow behind it: the adjacent foe is pushed one tile
// away, onto spikes or into deep water if they're there, or slammed into
// whatever stops it (see push.ts). It deals no damage of its own.
export const SHOVE: Skill = Object.freeze({
  id: 'shove',
  label: 'Shove',
  manaCost: 1,
  range: 1,
  damageScale: 0,
  push: true,
  animation: 'strike',
});

// The skills a promoted class learns on promotion (see promotions.ts),
// each a heavier or longer-reaching variant of the regular hit, at 3 or 4
// mana.
function promotionSkill(id: string, label: string, fields: Partial<Skill>): Skill {
  return Object.freeze({ id, label, manaCost: 3, range: 1, animation: 'strike', ...fields });
}

// A wall of shields: no damage, but every ally next to the user is left
// Guarded (2 less damage from every hit) until its next phase.
export const PHALANX = promotionSkill('phalanx', 'Phalanx', {
  manaCost: 2,
  range: 0,
  area: 'burst',
  effect: 'buff',
  status: 'guarded',
  animation: 'mend',
});

// The ram's covered frame sheltering those beside it: Phalanx's effect.
export const BULWARK = promotionSkill('bulwark', 'Bulwark', {
  manaCost: 2,
  range: 0,
  area: 'burst',
  effect: 'buff',
  status: 'guarded',
  animation: 'mend',
});

// A blessing on one ally up to 2 tiles away: it's left Warded (4 less
// damage from every hit) until its next phase.
export const WARD = promotionSkill('ward', 'Ward', {
  manaCost: 2,
  range: 2,
  effect: 'buff',
  status: 'warded',
  animation: 'mend',
});

// A gust behind an adjacent ally: it's left Hastened (+2 MOV) until its
// next phase, so one that hasn't moved yet goes further this turn.
export const TAILWIND = promotionSkill('tailwind', 'Tailwind', {
  manaCost: 2,
  range: 1,
  effect: 'buff',
  status: 'hastened',
  animation: 'mend',
});

// A swift strike and away: the user's regular attack on an adjacent foe,
// then it darts up to 2 tiles straight back.
export const HIT_AND_RUN = promotionSkill('hit-and-run', 'Hit and Run', { manaCost: 2, retreat: 2 });

// A shot, then a step back: the user's regular attack on a foe up to 2
// tiles away, then it steps a tile straight back.
export const DISENGAGE = promotionSkill('disengage', 'Disengage', {
  manaCost: 2,
  range: 2,
  retreat: 1,
  animation: 'stone',
});

// A leap onto prey: the beast springs up to 3 tiles to land next to a foe
// and strikes it with its regular attack.
export const POUNCE = promotionSkill('pounce', 'Pounce', { manaCost: 2, range: 4, leap: 3 });

// A leaping overhead swing: the user jumps up to 2 tiles to land next to a
// foe and strikes with 2 more power.
export const JUMP_SWING = promotionSkill('jump-swing', 'Jump Swing', { range: 3, leap: 2, might: 2 });

// A lance charge: the user's regular attack on an adjacent foe, with 1
// more power for each tile it walked this turn, up to 4.
export const CHARGE = promotionSkill('charge', 'Charge', { manaCost: 2, chargeMight: 4 });

// The ram rolls up to 3 tiles along a row or column, over free ground, to
// slam the first foe in its way with its regular attack and push it a
// tile.
export const BATTERING_CHARGE = promotionSkill('battering-charge', 'Battering Charge', {
  manaCost: 2,
  range: 4,
  leap: 3,
  straight: true,
  push: true,
});

// The beast swoops low along a row or column, up to 3 tiles, while the
// rider spears every foe it passes over for half its regular attack; it
// lands on the farthest free tile.
export const STRAFING_RUN = promotionSkill('strafing-run', 'Strafing Run', {
  manaCost: 4,
  range: 3,
  strafe: 3,
  damageScale: 0.5,
});

// A hand up: the user trades places with an adjacent ally.
export const LEND_A_HAND = promotionSkill('lend-a-hand', 'Lend a Hand', {
  manaCost: 1,
  effect: 'swap',
  animation: 'mend',
});

// The flier swoops in to trade places with an ally up to 3 tiles away.
export const AIRLIFT = promotionSkill('airlift', 'Airlift', {
  manaCost: 2,
  range: 3,
  effect: 'swap',
  animation: 'mend',
});

// A hidden mine on an empty tile next to the sapper: the first foe to walk
// onto it takes 6 damage (never its last HP).
export const LAY_MINE = promotionSkill('lay-mine', 'Lay Mine', { manaCost: 2, mine: 6, animation: 'mend' });

// Knocks down a wall or rock next to the user, leaving open ground.
export const BREACH = promotionSkill('breach', 'Breach', { manaCost: 3, breach: true });

// The siege's breach: a bolt that knocks down a wall or rock up to 3 tiles
// away.
export const BREACHING_SHOT = promotionSkill('breaching-shot', 'Breaching Shot', {
  manaCost: 3,
  range: 3,
  breach: true,
  animation: 'stone',
});

// A challenge: no damage, but every foe within 2 tiles is left Taunted
// (it must go after a Taunting foe on its next phase) and the user
// Taunting until its own next phase.
export const TAUNT = promotionSkill('taunt', 'Taunt', {
  manaCost: 2,
  range: 0,
  damageScale: 0,
  area: 'wide',
  status: 'taunted',
  selfStatus: 'taunting',
});

// A blow that splits armor: the user's regular attack with 2 more power on
// an adjacent foe, which it leaves Sundered (3 more damage from every hit).
export const SUNDER = promotionSkill('sunder', 'Sunder', { might: 2, status: 'sundered' });

// An arrow through the foot: the user's regular attack on a foe up to 2
// tiles away, which it leaves Rooted.
export const PINNING_SHOT = promotionSkill('pinning-shot', 'Pinning Shot', {
  manaCost: 2,
  range: 2,
  status: 'rooted',
  animation: 'stone',
});

// A foe singled out for the others: no damage, but a foe up to 3 tiles
// away is left Marked (15 less avoid).
export const MARK = promotionSkill('mark', 'Mark', {
  manaCost: 1,
  range: 3,
  damageScale: 0,
  status: 'marked',
  animation: 'stone',
});

// A roar that freezes foes in place: no damage, but every foe next to the
// user is left Rooted.
export const ROAR = promotionSkill('roar', 'Roar', {
  manaCost: 2,
  range: 0,
  damageScale: 0,
  area: 'burst',
  status: 'rooted',
});
export const FRENZY = promotionSkill('frenzy', 'Frenzy', { manaCost: 4, might: 6 });
export const IMPALE = promotionSkill('impale', 'Impale', { might: 5 });
export const LUNGE = promotionSkill('lunge', 'Lunge', { manaCost: 2, range: 2, might: 2 });
export const CRUSHING_BLOW = promotionSkill('crushing-blow', 'Crushing Blow', { might: 5 });
export const BLAST = promotionSkill('blast', 'Blast', { range: 2, might: 3, animation: 'stone' });
export const BULWARK_BASH = promotionSkill('bulwark-bash', 'Bulwark Bash', { might: 3 });
export const HOLY_STRIKE = promotionSkill('holy-strike', 'Holy Strike', { might: 3 });
// Holy light from up to 2 tiles away: the user's regular attack with 3
// more power, and 3 more again against a monster.
export const SMITE = promotionSkill('smite', 'Smite', { range: 2, might: 3, monsterMight: 3, animation: 'stone' });

// The beast's jaws: its regular attack on an adjacent foe, healing it for
// half the damage dealt.
export const SAVAGE_BITE = promotionSkill('savage-bite', 'Savage Bite', { manaCost: 1, drain: 0.5 });

// An all-out swing: the user's regular attack with 6 more power on an
// adjacent foe, at the cost of 3 of its own HP (never its last).
export const RECKLESS_SWING = promotionSkill('reckless-swing', 'Reckless Swing', { might: 6, recoil: 3 });
// The mage's signature: a burst of flame on a foe up to 2 tiles away, the
// user's regular attack with 4 more power.
export const FLARE = promotionSkill('flare', 'Flare', { range: 2, might: 4, animation: 'stone' });

// The mage's level-up picks. A ball of fire thrown up to 3 tiles: the
// user's regular attack with 1 more power, on the target and every foe
// on the four tiles around it.
export const FIREBALL = promotionSkill('fireball', 'Fireball', {
  manaCost: 4,
  range: 3,
  might: 1,
  area: 'burst',
  animation: 'stone',
});

// A shard of ice up to 2 tiles away: the user's regular attack, through to
// the foe right behind the target, leaving both Rooted.
export const FROST_LANCE = promotionSkill('frost-lance', 'Frost Lance', {
  range: 2,
  area: 'line',
  status: 'rooted',
  animation: 'stone',
});

// Life drawn out of a foe up to 2 tiles away: the user's regular attack,
// healing it for half the damage dealt.
export const SIPHON = promotionSkill('siphon', 'Siphon', { manaCost: 2, range: 2, drain: 0.5, animation: 'stone' });

// The skills an evolution teaches (see warband/evolutions.ts).
export const VOLLEY = promotionSkill('volley', 'Volley', { range: 3, might: 3, animation: 'stone' });
export const INFERNO = promotionSkill('inferno', 'Inferno', { manaCost: 4, range: 3, might: 5, animation: 'stone' });
export const EARTHSHAKER = promotionSkill('earthshaker', 'Earthshaker', { manaCost: 4, might: 8 });
// A prayer that closes an adjacent ally's wounds without a staff: it
// restores 2 plus the user's intelligence, like the Heal staff.
export const MEND: Skill = Object.freeze({
  id: 'mend',
  label: 'Mend',
  manaCost: 3,
  range: 1,
  effect: 'heal',
  power: 2,
  animation: 'mend',
});

// The level each class's first skill unlocks at: a new unit starts with
// none (bar a Shove) and learns it on its first level up.
export const SKILL_UNLOCK_LEVEL = 2;

// The villager's tree, which its promotions keep: a villager that promotes
// still knows what it learned as one.
const VILLAGER_TREE: readonly SkillTreeEntry[] = Object.freeze([
  Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: THROW_STONES }),
]);

// A promoted class's tree: the villager's, then its own skills.
function promotedTree(...entries: SkillTreeEntry[]): readonly SkillTreeEntry[] {
  return Object.freeze([...VILLAGER_TREE, ...entries.map((entry) => Object.freeze(entry))]);
}

// The acolyte's tree, which the mage keeps: a promoted acolyte still knows
// Mend.
const ACOLYTE_TREE: readonly SkillTreeEntry[] = Object.freeze([
  Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: MEND }),
]);

// unitClass -> [{ level, skill }]: the skills a class learns by level,
// its signature skill at SKILL_UNLOCK_LEVEL. Classes without an entry (the
// specialized units bar the acolyte, the elementals and the monsters, for
// now) learn none by level.
export const SKILL_TREES: SkillTrees = Object.freeze({
  villager: VILLAGER_TREE,
  archer: promotedTree({ level: SKILL_UNLOCK_LEVEL, skill: LONG_SHOT }),
  soldier: promotedTree({ level: 1, skill: SHOVE }, { level: SKILL_UNLOCK_LEVEL, skill: SHIELD_BASH }),
  vanguard: promotedTree({ level: SKILL_UNLOCK_LEVEL, skill: CLEAVE }),
  sapper: promotedTree({ level: SKILL_UNLOCK_LEVEL, skill: BLAST }),
  acolyte: ACOLYTE_TREE,
  mage: Object.freeze([...ACOLYTE_TREE, Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: FLARE })]),
  siege: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: BARRAGE })]),
  beast: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: SAVAGE_BITE })]),
  scout: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: HIT_AND_RUN })]),
  'beast-rider': Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: CHARGE })]),
  ram: Object.freeze([Object.freeze({ level: SKILL_UNLOCK_LEVEL, skill: BATTERING_CHARGE })]),
});

// unitClass -> the skills a level up can offer a unit of the class to
// learn (a skill boon, see warband/boons.ts): its own, never another
// class's. Classes without an entry are offered none.
export const CLASS_SKILL_PICKS: Readonly<Record<string, readonly Skill[]>> = Object.freeze({
  villager: Object.freeze([LEND_A_HAND]),
  archer: Object.freeze([PIERCING_SHOT, PINNING_SHOT, DISENGAGE]),
  vanguard: Object.freeze([SUNDER, RECKLESS_SWING, JUMP_SWING]),
  soldier: Object.freeze([LUNGE, PHALANX, TAUNT]),
  sapper: Object.freeze([SHRAPNEL, LAY_MINE, BREACH]),
  acolyte: Object.freeze([SMITE, PRAYER, WARD]),
  mage: Object.freeze([FIREBALL, FROST_LANCE, SIPHON]),
  scout: Object.freeze([MARK, TAILWIND, AIRLIFT]),
  beast: Object.freeze([WING_BUFFET, ROAR, POUNCE]),
  'beast-rider': Object.freeze([SKEWER, TANDEM_STRIKE, STRAFING_RUN]),
  siege: Object.freeze([DEADEYE, BREACHING_SHOT]),
  ram: Object.freeze([BULWARK, BREACH]),
});

// The skills a level up can offer a unit of `unitClass` (CLASS_SKILL_PICKS).
export function getClassSkillPicks(
  unitClass: string | null,
  picks: Readonly<Record<string, readonly Skill[]>> = CLASS_SKILL_PICKS,
): readonly Skill[] {
  return (unitClass !== null && picks[unitClass]) || [];
}

// Whether `unitClass` has any skills to teach, e.g. as a secondary class.
export function hasSkillTree(unitClass: string, trees: SkillTrees = SKILL_TREES): boolean {
  return treeOf(unitClass, trees).length > 0;
}

// Every skill a unit of unitClass knows at the given level, in tree order.
export function getLearnedSkills(unitClass: string | null, level: number, trees: SkillTrees = SKILL_TREES): Skill[] {
  const tree = treeOf(unitClass, trees);
  return tree.filter((entry) => entry.level <= level).map((entry) => entry.skill);
}

// Skills newly learned by going from fromLevel up to toLevel, e.g. to
// announce them on level up.
export function getSkillsLearnedBetween(
  unitClass: string | null,
  fromLevel: number,
  toLevel: number,
  trees: SkillTrees = SKILL_TREES,
): Skill[] {
  const tree = treeOf(unitClass, trees);
  return tree.filter((entry) => entry.level > fromLevel && entry.level <= toLevel).map((entry) => entry.skill);
}

// What getUnitSkills reads off a unit. `secondaryClass` is the class whose
// skill set it has learned on top of its own, if any.
export interface SkillUser {
  unitClass: string | null;
  level: number;
  secondaryClass?: string | null;
  modifiers?: readonly Modifier[];
}

// The skills `unit` knows from its secondary class: that class's tree at
// the unit's own level, as if it were its own. None without one, or when
// the secondary is its own class.
export function getSecondarySkills(unit: SkillUser, trees: SkillTrees = SKILL_TREES): Skill[] {
  const { secondaryClass } = unit;
  if (!secondaryClass || secondaryClass === unit.unitClass) return [];
  return getLearnedSkills(secondaryClass, unit.level, trees);
}

// Every skill `unit` knows: its class's at its level (getLearnedSkills),
// then its secondary class's (getSecondarySkills), then those its
// modifiers teach, each only once.
export function getUnitSkills(unit: SkillUser, trees: SkillTrees = SKILL_TREES): Skill[] {
  const skills: Skill[] = [];
  const all = [
    ...getLearnedSkills(unit.unitClass, unit.level, trees),
    ...getSecondarySkills(unit, trees),
    ...getModifierSkills(unit.modifiers),
  ];
  for (const skill of all) if (!skills.some(({ id }) => id === skill.id)) skills.push(skill);
  return skills;
}

// Finds a skill `unit` knows (getUnitSkills) by id, or null.
export function findUnitSkill(unit: SkillUser, skillId: string, trees: SkillTrees = SKILL_TREES): Skill | null {
  return getUnitSkills(unit, trees).find((skill) => skill.id === skillId) ?? null;
}

// Damage a skill deals when `user` uses it on `defender`: the user's
// regular hit (calculateDamage, of its weapon's damage type and with its
// weapon's might) with the skill's `might` added to its attack power,
// times its `damageScale`, rounded up — so a scaled-down hit that would
// have dealt damage still deals at least 1. Each side's modifiers count
// as in an exchange the user started (withCombatBonus). Never below zero.
// Skills don't spend weapon uses.
export function calculateSkillDamage(skill: Skill, user: SkillFighter, defender: SkillFighter): number {
  const { power } = DAMAGE_TYPES[getDamageType(user)];
  // Copied field by field: a Unit's weapon and armor are getters, which a
  // spread drops.
  const boosted: DamageStats = {
    strength: user.strength,
    intelligence: user.intelligence,
    weapon: user.weapon,
    bonus: getFighterBonus(user, defender, true),
  };
  const charge = Math.min(skill.chargeMight ?? 0, user.movedTiles ?? 0);
  boosted[power] =
    (user[power] ?? 0) + (skill.might ?? 0) + charge + (defender.monster ? (skill.monsterMight ?? 0) : 0);
  const guarded: DamageStats = {
    defense: defender.defense,
    armorDefense: defender.armorDefense,
    resistance: defender.resistance,
    bonus: getFighterBonus(defender, user, false),
  };
  return Math.ceil(calculateDamage(boosted, guarded) * (skill.damageScale ?? 1));
}

// The damage of a `followUp` skill's second blow after a first one that
// dealt `first`: that fraction of it, rounded up (0 without one, or after
// a blow that dealt none).
export function getFollowUpDamage(skill: Pick<Skill, 'followUp'>, first: number): number {
  return skill.followUp && first > 0 ? Math.ceil(first * skill.followUp) : 0;
}

export type SkillForecastFighter = SkillFighter & {
  health: number;
  maxHealth: number;
};

// Forecast for `user` using an offensive `skill` on `defender`, in the same
// shape as getCombatForecast so the combat forecast window can display it:
// a skill always lands once, never crits, and can't be countered. For a push
// skill, `push` adds the shove's damage (or all the target's remaining HP if
// it drowns), and a `followUp` skill its second blow's. An area skill's
// forecast is for the foe it's aimed at.
export function getSkillForecast(
  skill: Skill,
  user: SkillForecastFighter,
  defender: SkillForecastFighter,
  push: { damage: number; drowned: boolean } | null = null,
): Record<CombatSide, ForecastSide> {
  const first = calculateSkillDamage(skill, user, defender);
  const struck = first + (defender.health - first > 0 ? getFollowUpDamage(skill, first) : 0);
  const survived = defender.health - struck > 0;
  const pushDamage = skill.push && push && survived ? (push.drowned ? defender.health - struck : push.damage) : 0;
  return {
    attacker: {
      health: user.health,
      maxHealth: user.maxHealth,
      damage: struck + pushDamage,
      hit: 100,
      crit: 0,
      strikes: 1,
      counters: true,
    },
    defender: {
      health: defender.health,
      maxHealth: defender.maxHealth,
      damage: null,
      hit: null,
      crit: null,
      strikes: 0,
      counters: false,
    },
  };
}

// The tiles past `target` an area skill used from `from` also reaches, as
// [{ x, y }] (none for a skill without one), in or out of the map: the
// caller keeps the ones it has. 'sides' and 'line' read the direction from
// `from` to `target` along its longer axis (x on a tie); 'burst' is the
// four tiles around `target`. Never `from` itself.
export function getSkillAreaTiles(skill: Pick<Skill, 'area'>, from: Point, target: Point): Point[] {
  if (!skill.area) return [];
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const step = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  let tiles: Point[];
  switch (skill.area) {
    case 'sides':
      tiles = [
        { x: target.x + step.y, y: target.y + step.x },
        { x: target.x - step.y, y: target.y - step.x },
      ];
      break;
    case 'line':
      tiles = [{ x: target.x + step.x, y: target.y + step.y }];
      break;
    case 'burst':
      tiles = [
        { x: target.x, y: target.y - 1 },
        { x: target.x + 1, y: target.y },
        { x: target.x, y: target.y + 1 },
        { x: target.x - 1, y: target.y },
      ];
      break;
    case 'wide':
      tiles = [];
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          if (Math.abs(x) + Math.abs(y) <= 2) tiles.push({ x: target.x + x, y: target.y + y });
        }
      }
      break;
  }
  return tiles.filter(
    (tile) => (tile.x !== from.x || tile.y !== from.y) && (tile.x !== target.x || tile.y !== target.y),
  );
}

// Whether `skill` gives allies a buff rather than striking a foe.
export function isBuffSkill(skill: Skill): boolean {
  return skill.effect === 'buff';
}

// Whether `skill` trades places with an ally.
export function isSwapSkill(skill: Skill): boolean {
  return skill.effect === 'swap';
}

// Whether `skill` is aimed at a tile (a mine or a breach) rather than a
// unit.
export function isTileSkill(skill: Skill): boolean {
  return skill.mine !== undefined || skill.breach === true;
}

// Whether `skill` is used on allies (a heal, a buff or a swap) rather than
// foes.
export function isSupportSkill(skill: Skill): boolean {
  return isHealingSkill(skill) || isBuffSkill(skill) || isSwapSkill(skill);
}

// Whether `skill` mends an ally rather than striking a foe.
export function isHealingSkill(skill: Skill): boolean {
  return skill.effect === 'heal';
}

// HP a healing skill restores to `patient`: its power plus the user's
// intelligence, capped at what the patient is missing (never below 0).
export function getSkillHealAmount(
  skill: Skill,
  user: { intelligence: number },
  patient: { health: number; maxHealth: number },
): number {
  const missing = Math.max(0, patient.maxHealth - patient.health);
  const intelligence = Math.floor(user.intelligence * (skill.intelligenceScale ?? 1));
  return Math.max(0, Math.min((skill.power ?? 0) + intelligence, missing));
}

// One line on what `skill` does, e.g. for a lesson's or a boon's offer.
const AREA_PHRASES: Readonly<Record<SkillArea, string>> = Object.freeze({
  sides: 'and those on either side of it',
  line: 'and the one behind it',
  burst: 'and the four tiles around it',
  wide: 'and every tile within 2 of it',
});

export function describeSkill(skill: Skill): string {
  const reach = skill.range === 1 ? 'next to it' : `up to ${skill.range} tiles away`;
  const int = skill.intelligenceScale === 0.5 ? 'half INT' : 'INT';
  if (isHealingSkill(skill)) {
    if (skill.range === 0) return `Heals every wounded ally next to it for ${skill.power ?? 0} + ${int}.`;
    return `Heals an ally ${reach} for ${skill.power ?? 0} + ${int}.`;
  }
  const status = skill.status && STATUSES[skill.status];
  const effect = status?.description.replace(/\.$/, '') ?? '';
  const leaves = status ? `${status.label} (${effect.charAt(0).toLowerCase()}${effect.slice(1)})` : '';
  if (isBuffSkill(skill)) {
    if (skill.range === 0) return `Leaves every ally next to it ${leaves} until your next phase.`;
    return `Leaves an ally ${reach} ${leaves} until your next phase.`;
  }
  if (isSwapSkill(skill)) return `Trades places with an ally ${reach}.`;
  if (skill.mine) {
    return `Lays a hidden mine on an empty tile ${reach}: the first foe to step on it takes ${skill.mine} damage (never its last HP).`;
  }
  if (skill.breach) return `Knocks down a wall or rock ${reach}, leaving open ground.`;
  const scale = skill.damageScale ?? 1;
  if (scale === 0 && skill.push) return `Pushes a foe ${reach} a tile away.`;
  if (scale === 0 && status) {
    const around = skill.area === 'wide' ? 'within 2 tiles' : 'next to it';
    const self = skill.selfStatus ? `, and itself ${STATUSES[skill.selfStatus].label} until your next phase` : '';
    if (skill.range === 0) return `Leaves every foe ${around} ${leaves}${self}.`;
    return `Leaves a foe ${reach} ${leaves}.`;
  }
  const hit = scale === 1 ? 'Its regular hit' : scale === 0.5 ? 'Half its regular hit' : `${scale}× its regular hit`;
  const might = skill.might ? ` with +${skill.might} power` : '';
  const area = skill.area ? ` ${AREA_PHRASES[skill.area]}` : '';
  const allies = skill.friendlyFire ? ', allies included' : '';
  const push = skill.push ? ', then pushes it a tile away' : '';
  const followUp = skill.followUp
    ? `, then a second hit for ${skill.followUp === 0.5 ? 'half' : `${skill.followUp}×`} that`
    : '';
  const after = status ? `, leaving it ${leaves}` : '';
  const monsters = skill.monsterMight ? ` (+${skill.monsterMight} more against monsters)` : '';
  const drain = skill.drain ? `, healing it for ${skill.drain === 0.5 ? 'half' : `${skill.drain}×`} the damage` : '';
  const recoil = skill.recoil ? `, costing it ${skill.recoil} HP` : '';
  const charge = skill.chargeMight ? ` (+1 for each tile it moved this turn, up to ${skill.chargeMight})` : '';
  const retreat = skill.retreat
    ? `, then steps ${skill.retreat === 1 ? 'a tile' : `up to ${skill.retreat} tiles`} back`
    : '';
  const tiles = (n: number) => `${n} ${n === 1 ? 'tile' : 'tiles'}`;
  if (skill.strafe) {
    return `Flies up to ${tiles(skill.strafe)} in a line, dealing ${hit.charAt(0).toLowerCase()}${hit.slice(1)} to every foe it passes over.`;
  }
  if (skill.leap) {
    const way = skill.straight ? `Charges up to ${tiles(skill.leap)} in a line` : `Leaps up to ${tiles(skill.leap)}`;
    return `${way} to a foe, then ${hit.charAt(0).toLowerCase()}${hit.slice(1)}${might}${push}.`;
  }
  return `${hit}${might}${charge}${monsters} on a foe ${reach}${area}${allies}${push}${followUp}${after}${drain}${recoil}${retreat}.`;
}

export function canUseSkill(unit: { mana: number }, skill: Skill): boolean {
  return unit.mana >= skill.manaCost;
}

// Entries for the skill menu: each skill with its cost and what it does,
// disabled if the unit can't afford it.
export function getSkillActions(unit: { mana: number }, skills: readonly Skill[]): readonly SkillAction[] {
  return Object.freeze(
    skills.map((skill) =>
      Object.freeze({
        id: skill.id,
        label: skill.label,
        manaCost: skill.manaCost,
        description: describeSkill(skill),
        disabled: !canUseSkill(unit, skill),
      }),
    ),
  );
}
