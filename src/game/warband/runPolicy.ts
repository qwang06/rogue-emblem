// The default policy for playing a Warband run by itself (see autoRun.ts):
// how it picks its starting relic, boons, rewards and recruits and what it does at
// camp. Each decision is a small
// rule over the run, with its thresholds as named constants to tune. The
// battles are played by the battle AI (battle/ai.ts). Pure: each function
// reads a session and returns the next command.

import { planPlayerDeployment, planPlayerTurn } from '../battle/playerAI.ts';
import type { BattleState } from '../battle/state.ts';
import { isStaff } from '../healing.ts';
import { MASTER_SEAL, type Item } from '../items.ts';
import { getPromotions } from '../promotions.ts';
import { createSeededRng, randomItem } from '../rng.ts';
import type { Unit } from '../Unit.ts';
import { createUnitOfClass } from '../unitClasses.ts';
import { canWield, isWeapon } from '../weapons.ts';
import type { RunPolicy } from './autoRun.ts';
import { canRest, hasMerchant, REST_COST } from './camp.ts';
import { canPromoteInRun, getPromotionCandidates } from './promotion.ts';
import { canGiveFromConvoy, lookUpItem } from './convoy.ts';
import { canBuy, getItemPrice, MERCHANT_STOCK } from './merchant.ts';
import { MAX_ROSTER_SIZE, type Reward } from './rewards.ts';
import { restoreUnit, type RunState, type UnitSnapshot } from './run.ts';
import type { Realm, Site } from './realm/realm.ts';
import { getTravelChoices } from './travel.ts';
import { RARITY_PERCENT, type Boon, type BoonKind } from './boons.ts';
import { getBoonOffer, type BoonOffer } from './levelUpPicks.ts';
import { getAffinityWeight, getUnitTagCounts, type TagCounts } from './boonTags.ts';
import { getRecruitOffers, getRelicOffers, getRewardOffers, type RunCommand, type RunSession } from './runCommands.ts';

// Rest at once when anyone deploying is under this share of their HP...
export const REST_BELOW_HEALTH = 0.5;
// ...and otherwise when the deploying units are missing this share of
// their HP between them.
export const REST_MISSING_HEALTH = 0.25;

// How much the policy wants each reward (higher is better); see scoreReward.
export const REWARD_SCORES = Object.freeze({
  // A recruit while the roster can't fill the deploy slots.
  recruitNeeded: 100,
  // A recruit otherwise, plus a bonus for a class the roster lacks.
  recruit: 30,
  newClassBonus: 10,
  arms: 32,
  relic: 45,
  lesson: 50,
  seal: 40,
  // Rest scores this times the share of HP the roster is missing.
  restPerMissing: 100,
  supplies: 10,
  gold: 20,
  // A skill set (a scroll). Never offered while Mentors are off
  // (MENTORS_ENABLED), and the policy doesn't learn secondary skill sets
  // at camp yet, so it stays low until it does.
  scroll: 5,
});

// The relics the policy would rather start with, best first; any other
// counts as worse than all of them.
export const RELIC_PREFERENCE: readonly string[] = Object.freeze([
  'bloodpact',
  'mending-charm',
  'duelists-gauntlet',
  'hunters-charm',
  'bulwark-crest',
  'scholars-quill',
  'winged-boots',
  'hawk-lens',
]);

// How much the policy wants each kind of boon (higher is better).
// (Sims with skill at 2.5 or 4 came out no better, so skills stay last.)
export const BOON_SCORES: Readonly<Record<BoonKind, number>> = Object.freeze({ passive: 3, stat: 2, skill: 1 });

// The starting relic pick: the offer highest in RELIC_PREFERENCE, else the
// first.
export function pickStartingRelic(session: RunSession): RunCommand {
  const offers = getRelicOffers(session);
  const rank = (id: string) => {
    const index = RELIC_PREFERENCE.indexOf(id);
    return index < 0 ? RELIC_PREFERENCE.length : index;
  };
  let best = 0;
  offers.forEach((relic, index) => {
    if (rank(relic.id) < rank(offers[best].id)) best = index;
  });
  return { type: 'pick-relic', index: best };
}

// A boon pick: the offer whose kind scores highest in BOON_SCORES (the
// first of equals).
export function pickBoonOffer(session: RunSession): RunCommand {
  const offer = getBoonOffer(session.run);
  return { type: 'pick-boon', index: offer ? getBestOfferIndex(offer) : 0 };
}

// Which boon of `offer` the policy takes (getBestBoonIndex, leaning toward
// the offered unit's tags).
export function getBestOfferIndex(offer: Pick<BoonOffer, 'unit' | 'boons'>): number {
  return getBestBoonIndex(offer.boons, getUnitTagCounts(offer.unit.classId, offer.unit.boons ?? []));
}

// Which of `boons` the policy takes: the one whose kind's BOON_SCORES
// times its rarity's RARITY_PERCENT is highest (the first of equals), so a
// rarer offer can beat a better kind. With the unit's `tagCounts`
// (boonTags.ts), a boon fitting its build scores up to half its offer
// weight's lean more, so the policy builds toward a plan too.
export function getBestBoonIndex(
  boons: readonly (Pick<Boon, 'kind' | 'rarity'> & { id?: string })[],
  tagCounts: TagCounts = {},
): number {
  const score = (boon: Pick<Boon, 'kind' | 'rarity'> & { id?: string }) =>
    BOON_SCORES[boon.kind] *
    RARITY_PERCENT[boon.rarity ?? 'common'] *
    (1 + (getAffinityWeight(boon.id ?? '', tagCounts) - 1) / 2);
  let best = 0;
  boons.forEach((boon, index) => {
    if (score(boon) > score(boons[best])) best = index;
  });
  return best;
}

// The units that deploy next stage: the healthiest deployCap of the
// roster (by share of health), as the player battle AI picks them
// (planPlayerDeployment).
export function getDeployingUnits(run: RunState): readonly UnitSnapshot[] {
  return [...run.roster].sort((a, b) => b.health / b.maxHealth - a.health / a.maxHealth).slice(0, run.deployCap);
}

// How much the policy wants `reward` for `run`.
export function scoreReward(run: RunState, reward: Reward): number {
  switch (reward.kind) {
    case 'recruit': {
      if (run.roster.length >= MAX_ROSTER_SIZE) return 0;
      if (run.roster.length < run.deployCap) return REWARD_SCORES.recruitNeeded;
      const isNew = !run.roster.some((unit) => unit.classId === reward.unit.classId);
      return REWARD_SCORES.recruit + (isNew ? REWARD_SCORES.newClassBonus : 0);
    }
    // A draft offers several classes, so one is almost always new.
    case 'draft':
      if (run.roster.length >= MAX_ROSTER_SIZE) return 0;
      if (run.roster.length < run.deployCap) return REWARD_SCORES.recruitNeeded;
      return REWARD_SCORES.recruit + REWARD_SCORES.newClassBonus;
    case 'rest':
      return REWARD_SCORES.restPerMissing * getMissingHealthShare(run.roster);
    case 'arms':
      return REWARD_SCORES.arms;
    case 'relic':
      return REWARD_SCORES.relic;
    case 'lesson':
      return REWARD_SCORES.lesson;
    case 'seal':
      return REWARD_SCORES.seal;
    case 'supplies':
      return REWARD_SCORES.supplies;
    case 'scroll':
      return REWARD_SCORES.scroll;
    case 'gold':
      return REWARD_SCORES.gold;
  }
}

// The reward pick: the best-scoring offer (the first of equals), or skip
// when there's none.
export function pickReward(session: RunSession): RunCommand {
  const offers = getRewardOffers(session);
  if (offers.length === 0) return { type: 'skip-reward' };
  let best = 0;
  offers.forEach((reward, index) => {
    if (scoreReward(session.run, reward) > scoreReward(session.run, offers[best])) best = index;
  });
  return { type: 'pick-reward', index: best };
}

// The recruit pick: the first offered recruit of a class the roster
// lacks, else the first offered, or decline when there's none.
export function pickRecruit(session: RunSession): RunCommand {
  const offers = getRecruitOffers(session);
  if (offers.length === 0) return { type: 'decline-recruit' };
  const isNew = (reward: Reward) =>
    reward.kind === 'recruit' && !session.run.roster.some((unit) => unit.classId === reward.unit.classId);
  return { type: 'pick-recruit', index: Math.max(0, offers.findIndex(isNew)) };
}

// Camp, one command at a time, in this order:
// 0. promote the first unit that can, to one of its class's promotions
//    picked at random (pickPromotion), or buy a seal for it when there's
//    a merchant and gold to spare
// 1. rest if anyone deploying is badly hurt (REST_BELOW_HEALTH)
// 2. each deploying unit armed: equip its best carried weapon (or staff)
//    if what it holds is about to break, else take one from the convoy,
//    else buy one
// 3. rest if the deploying units are missing enough HP between them
// 4. march
export function planCamp(session: RunSession, stock: readonly string[] = MERCHANT_STOCK): RunCommand {
  const { run } = session;
  const deploying = getDeployingUnits(run);
  const [candidate] = getPromotionCandidates(run);
  if (candidate) {
    const promotionId = pickPromotion(run, candidate);
    if (promotionId) return { type: 'promote', unitId: candidate.id, promotionId };
    const price = getItemPrice(MASTER_SEAL);
    if (hasMerchant(run) && canBuy(run, MASTER_SEAL.id, stock) && run.gold >= price + REST_COST) {
      return { type: 'buy', itemId: MASTER_SEAL.id };
    }
  }
  if (canRest(run) && deploying.some((unit) => unit.health < unit.maxHealth * REST_BELOW_HEALTH)) {
    return { type: 'rest' };
  }
  for (const snapshot of deploying) {
    const command = armUnit(run, snapshot, stock);
    if (command) return command;
  }
  if (canRest(run) && getMissingHealthShare(deploying) >= REST_MISSING_HEALTH) return { type: 'rest' };
  return { type: 'march' };
}

// The promotion `unit` takes, one of its class's it can take now picked at
// random, or null when it can't promote (no seal). The dice are seeded by
// the run's seed, the unit and its level, so a run replays the same.
export function pickPromotion(run: RunState, unit: UnitSnapshot): string | null {
  const options = getPromotions(unit.classId).filter((promotion) => canPromoteInRun(run, unit.id, promotion.id));
  if (options.length === 0) return null;
  const rng = createSeededRng((run.seed ^ Math.imul(hashText(unit.id) + unit.level, 0x9e3779b1)) >>> 0);
  return randomItem(rng, options).id;
}

// A 32-bit hash of `text` (FNV-1a), to seed dice from a name.
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

// How much the policy wants to travel to each kind of site (higher is
// better); see scoreSite.
export const SITE_SCORES = Object.freeze({
  battle: 40,
  // A village while the roster can't fill the deploy slots (a recruit),
  // and otherwise.
  villageNeeded: 70,
  village: 42,
  // A town when the warband needs arms or rest, and otherwise.
  townNeeded: 65,
  town: 10,
  // A shrine, plus a bonus when the warband is hurt.
  shrine: 38,
  shrineHurtBonus: 20,
  // A fort when the warband is healthy and at least FORT_ROSTER strong,
  // and otherwise.
  fortReady: 45,
  fort: 5,
  // An elite lair, likewise, for its relics.
  eliteReady: 50,
  elite: 4,
  // A wayside event.
  event: 30,
  hold: 100,
});
// A fort wants at least this many units.
export const FORT_ROSTER = 3;

// How much the policy wants to travel to `site` with `run`.
export function scoreSite(run: RunState, site: Site, stock: readonly string[] = MERCHANT_STOCK): number {
  const deploying = getDeployingUnits(run);
  const missing = getMissingHealthShare(deploying);
  switch (site.kind) {
    case 'battle':
      return SITE_SCORES.battle;
    case 'village':
      return run.roster.length < Math.min(run.deployCap, MAX_ROSTER_SIZE)
        ? SITE_SCORES.villageNeeded
        : SITE_SCORES.village;
    case 'town': {
      // What a unit would buy if there were a merchant (and gold enough).
      const shop: RunState = { ...run, route: undefined, gold: Infinity };
      const needsArms = deploying.some((unit) => armUnit(shop, unit, stock)?.type === 'buy');
      return needsArms || missing >= REST_MISSING_HEALTH ? SITE_SCORES.townNeeded : SITE_SCORES.town;
    }
    case 'shrine':
      return SITE_SCORES.shrine + (missing >= REST_MISSING_HEALTH ? SITE_SCORES.shrineHurtBonus : 0);
    case 'fort':
      return run.roster.length >= FORT_ROSTER && missing < REST_MISSING_HEALTH / 2
        ? SITE_SCORES.fortReady
        : SITE_SCORES.fort;
    case 'elite':
      return run.roster.length >= FORT_ROSTER && missing < REST_MISSING_HEALTH / 2
        ? SITE_SCORES.eliteReady
        : SITE_SCORES.elite;
    case 'event':
      return SITE_SCORES.event;
    case 'hold':
      return SITE_SCORES.hold;
    case 'home':
      return 0;
  }
}

// Where to travel: the best-scoring site the roads lead to (the
// northernmost of equals).
export function planTravel(session: RunSession, realm: Realm): RunCommand {
  const choices = getTravelChoices(session.run, realm);
  if (choices.length === 0) throw new Error('Nowhere to travel');
  let best = choices[0];
  for (const site of choices) if (scoreSite(session.run, site) > scoreSite(session.run, best)) best = site;
  return { type: 'travel', siteId: best.id };
}

// The policy autoRun plays with by default: the player battle AI
// (playerAI.ts) in battle, and pickStartingRelic, pickBoonOffer,
// pickReward, pickRecruit, planCamp and planTravel between battles.
export const DEFAULT_POLICY: RunPolicy = Object.freeze({
  battle: (state: BattleState) => (state.stage === 'deployment' ? planPlayerDeployment(state) : planPlayerTurn(state)),
  relic: pickStartingRelic,
  boon: pickBoonOffer,
  reward: pickReward,
  recruit: pickRecruit,
  camp: (session: RunSession) => planCamp(session),
  travel: planTravel,
});

// The share of max HP `units` are missing between them, 0 to 1.
function getMissingHealthShare(units: readonly UnitSnapshot[]): number {
  const max = units.reduce((sum, unit) => sum + unit.maxHealth, 0);
  const missing = units.reduce((sum, unit) => sum + unit.maxHealth - unit.health, 0);
  return max > 0 ? missing / max : 0;
}

// What arms `snapshot` for the next stage, or null when it already is (or
// nothing can). A healer (isHealer) is armed with a staff, anyone else
// with a weapon its class is trained in, in the main hand.
function armUnit(run: RunState, snapshot: UnitSnapshot, stock: readonly string[]): RunCommand | null {
  const unit = restoreUnit(snapshot);
  const heals = isHealer(snapshot.classId);
  if (unit.gearLayout !== 'humanoid') return null;
  const fits = (item: Item) => (heals ? isStaff(item) : isWeapon(item) && canWield(unit.weaponTypes, item));
  const main = unit.equipment.main;
  if (main && fits(main)) return null;
  // A unit wearing a shield would rather take a one-handed weapon.
  const shielded = unit.equipment.off !== undefined;
  const ranked = run.convoy
    .map((entry, index) => ({ item: lookUpItem(entry.itemId), index }))
    .filter(({ item, index }) => fits(item) && canGiveFromConvoy(run, snapshot.id, index))
    .sort((a, b) => Number(freesHand(b.item, shielded)) - Number(freesHand(a.item, shielded)));
  if (ranked.length > 0) return { type: 'give', unitId: snapshot.id, convoyIndex: ranked[0].index };
  if (!hasMerchant(run)) return null;
  const [buy] = stock
    .filter((itemId) => fits(lookUpItem(itemId)) && canBuy(run, itemId, stock))
    .sort(
      (a, b) =>
        preference(snapshot.classId, b) - preference(snapshot.classId, a) ||
        getItemPrice(lookUpItem(a)) - getItemPrice(lookUpItem(b)),
    );
  return buy ? { type: 'buy', itemId: buy } : null;
}

// Whether `item` leaves a shield on: anything but a two-handed weapon.
function freesHand(item: Item, shielded: boolean): boolean {
  return !shielded || !isWeapon(item) || item.hands === 1;
}

// Whether units of `classId` heal rather than fight: their class starts
// with a staff.
function isHealer(classId: string): boolean {
  return createUnitOfClass(classId, { name: '', team: 'player' }).staves.length > 0;
}

// How much a unit of `classId` would rather buy `itemId`: what its class
// starts with first (an archer's bow), then a weapon that strikes from as
// far as its class's first weapon.
function preference(classId: string, itemId: string): number {
  const starter = createUnitOfClass(classId, { name: '', team: 'player' });
  const item = lookUpItem(itemId);
  const own = starter.equipment.main?.id === itemId;
  const ranged = isWeapon(item) && item.maxRange > 1;
  const startsRanged = (starter.weapon?.maxRange ?? 1) > 1;
  return (own ? 2 : 0) + (ranged === startsRanged ? 1 : 0);
}
