// Boon tags: the build each level-up boon (boons.ts) belongs to, so offers
// can lean toward what a unit already has and a run grows a build instead
// of a pile of the biggest numbers. Every boon has zero to two tags, every
// class leans toward one or two (a Soldier toward Guard, a Mage toward
// Mana and Power), and a unit's tag counts are its class's leanings plus
// each tag of every passive and skill boon it has taken (stat boons don't
// count, so a build shows in what the unit chose to do, not its stats).
// rollBoons draws each offer slot weighted by getAffinityWeight. Pure data
// and lookups.
export const BOON_TAGS = Object.freeze([
  'power',
  'precision',
  'guard',
  'evasion',
  'kill',
  'blood',
  'mana',
  'move',
  'status',
  'team',
] as const);
export type BoonTag = (typeof BOON_TAGS)[number];

export const BOON_TAG_LABELS: Readonly<Record<BoonTag, string>> = Object.freeze({
  power: 'Power',
  precision: 'Precision',
  guard: 'Guard',
  evasion: 'Evasion',
  kill: 'Kill',
  blood: 'Blood',
  mana: 'Mana',
  move: 'Move',
  status: 'Status',
  team: 'Team',
});

// Boon id -> its tags. A boon missing here (Quick Study, the retired skill
// boons) has none and is offered at the plain weight.
const TAGS_BY_BOON: Readonly<Record<string, readonly BoonTag[]>> = Object.freeze({
  // Stat boons.
  'stat-health': ['guard', 'blood'],
  'stat-strength': ['power'],
  'stat-intelligence': ['power', 'mana'],
  'stat-skill': ['precision'],
  'stat-speed': ['evasion'],
  'stat-luck': ['precision'],
  'stat-defense': ['guard'],
  'stat-resistance': ['guard'],
  // Passives.
  'keen-eye': ['precision'],
  deadly: ['precision'],
  nimble: ['evasion'],
  brawler: ['power'],
  stalwart: ['guard'],
  'monster-hunter': ['power'],
  wrath: ['power', 'blood'],
  fleet: ['move', 'evasion'],
  bloodthirst: ['kill', 'blood'],
  regeneration: ['blood'],
  focus: ['mana'],
  ferocity: ['power'],
  'thick-skin': ['guard'],
  'twin-strike': ['power', 'evasion'],
  finisher: ['kill', 'precision'],
  'cleave-through': ['power', 'kill'],
  'chain-kill': ['kill'],
  momentum: ['kill', 'move'],
  // Skill boons (skill-<skill id>).
  'skill-lend-a-hand': ['team', 'move'],
  'skill-piercing-shot': ['power'],
  'skill-pinning-shot': ['status'],
  'skill-disengage': ['move', 'evasion'],
  'skill-sunder': ['status', 'power'],
  'skill-reckless-swing': ['power', 'blood'],
  'skill-jump-swing': ['move', 'power'],
  'skill-lunge': ['power'],
  'skill-phalanx': ['guard', 'team'],
  'skill-taunt': ['guard', 'status'],
  'skill-shrapnel': ['power'],
  'skill-lay-mine': ['status'],
  'skill-breach': ['move'],
  'skill-smite': ['power'],
  'skill-prayer': ['team', 'blood'],
  'skill-ward': ['guard', 'team'],
  'skill-fireball': ['power', 'mana'],
  'skill-frost-lance': ['status', 'mana'],
  'skill-siphon': ['mana', 'blood'],
  'skill-mark': ['status', 'team'],
  'skill-tailwind': ['team', 'move'],
  'skill-airlift': ['team', 'move'],
  'skill-wing-buffet': ['status'],
  'skill-roar': ['status'],
  'skill-pounce': ['move', 'kill'],
  'skill-skewer': ['power'],
  'skill-tandem-strike': ['team', 'power'],
  'skill-strafing-run': ['move', 'power'],
  'skill-deadeye': ['precision'],
  'skill-breaching-shot': ['power'],
  'skill-bulwark': ['guard'],
});

// Class id -> the tags its units lean toward from their first level up.
export const CLASS_TAGS: Readonly<Record<string, readonly BoonTag[]>> = Object.freeze({
  villager: ['team'],
  whelp: ['kill'],
  archer: ['precision'],
  soldier: ['guard'],
  vanguard: ['power'],
  sapper: ['status', 'power'],
  acolyte: ['mana', 'team'],
  mage: ['mana', 'power'],
  bishop: ['team', 'blood'],
  scout: ['move', 'evasion'],
  beast: ['kill', 'blood'],
  'beast-rider': ['move', 'power'],
  siege: ['precision'],
  ram: ['guard'],
});

// How much each count of a shared tag adds to a boon's offer weight, and
// the most the weight can reach, so a focused unit still sees other boons.
export const AFFINITY_PER_TAG = 0.5;
export const MAX_AFFINITY_WEIGHT = 4;

// The boon id a taken entry names (see encodeBoonEntry in boons.ts).
function entryId(entry: string): string {
  return entry.split('|')[0];
}

// The tags of boon `id` (or of the boon an entry names); none if unknown.
export function getBoonTags(id: string): readonly BoonTag[] {
  return TAGS_BY_BOON[entryId(id)] ?? [];
}

export type TagCounts = Readonly<Partial<Record<BoonTag, number>>>;

// How strongly a unit of `classId` with the taken boons `entries` leans
// toward each tag: one for each of its class's tags, plus one for each tag
// of every passive and skill boon it has taken (a passive's every rank
// counts). Stat boons don't count.
export function getUnitTagCounts(classId: string | null, entries: readonly string[] = []): TagCounts {
  const counts: Partial<Record<BoonTag, number>> = {};
  const add = (tag: BoonTag) => (counts[tag] = (counts[tag] ?? 0) + 1);
  for (const tag of (classId !== null && CLASS_TAGS[classId]) || []) add(tag);
  for (const entry of entries) {
    const id = entryId(entry);
    if (id.startsWith('stat-')) continue;
    for (const tag of getBoonTags(id)) add(tag);
  }
  return Object.freeze(counts);
}

// How likely boon `id` is to be drawn for a unit with tag `counts`,
// relative to a boon sharing none of its tags (1): AFFINITY_PER_TAG more
// for each count of each of its tags, up to MAX_AFFINITY_WEIGHT.
export function getAffinityWeight(id: string, counts: TagCounts): number {
  const shared = getBoonTags(id).reduce((sum, tag) => sum + (counts[tag] ?? 0), 0);
  return Math.min(MAX_AFFINITY_WEIGHT, 1 + AFFINITY_PER_TAG * shared);
}
