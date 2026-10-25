// Snapshot of a level up's boon pick (src/game/warband/levelUpPicks.ts) for
// the level-up screen: who levelled up and to what, their stats, and each
// boon on offer with what it would raise. The pick's menu (the boons' order
// and the cursor) is the reward menu GridScene drives (toBoonActions in
// views.ts); `boons` lines up with its entries. Plain frozen data.

import type { GrowthStat } from '../game/experience.ts';
import { getSkillsLearnedBetween } from '../game/skills.ts';
import { getUnitSprite } from '../game/tileset.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { getStatBoonGain, type BoonKind } from '../game/warband/boons.ts';
import { completesEvolution } from '../game/warband/evolutions.ts';
import type { BoonOffer } from '../game/warband/levelUpPicks.ts';
import { restoreUnit } from '../game/warband/run.ts';

export interface BoonStatView {
  stat: GrowthStat;
  label: string;
  value: number;
  // What this level up's growth roll added to the stat (0 when it didn't rise).
  gain: number;
}

export interface BoonChoiceView {
  // The boon's id, which also names its icon (src/assets/boons/).
  id: string;
  name: string;
  kind: BoonKind;
  description: string;
  // Whether taking it completes an evolution for the unit.
  evolves: boolean;
  // A stat boon's raise after the class's cap, else null.
  gain: { stat: GrowthStat; amount: number } | null;
}

export interface BoonPickView {
  // Tells one pick from the next (the unit and level), so the screen
  // replays its level-up effect for each.
  key: string;
  name: string;
  classLabel: string;
  sprite: string;
  level: number;
  stats: readonly BoonStatView[];
  // Labels of the skills this level up taught the unit.
  skills: readonly string[];
  boons: readonly BoonChoiceView[];
}

// The stats the screen lists, in the GBA's order; health is max HP and mana
// is max MP.
const STATS: readonly (readonly [GrowthStat, string])[] = [
  ['health', 'HP'],
  ['mana', 'MP'],
  ['strength', 'STR'],
  ['magic', 'MAG'],
  ['skill', 'SKL'],
  ['speed', 'SPD'],
  ['luck', 'LCK'],
  ['defense', 'DEF'],
  ['resistance', 'RES'],
];

// `offer` as the level-up screen shows it, with evolutions judged against
// the warband's `relics` (see warband/evolutions.ts).
export function toBoonPickView(offer: BoonOffer, relics: readonly string[] = []): BoonPickView {
  const { unit: snapshot, level } = offer;
  const unit = restoreUnit(snapshot);
  const learned = [
    ...getSkillsLearnedBetween(snapshot.classId, level - 1, level),
    ...(snapshot.secondaryClass && snapshot.secondaryClass !== snapshot.classId
      ? getSkillsLearnedBetween(snapshot.secondaryClass, level - 1, level)
      : []),
  ];
  const skills: string[] = [];
  for (const skill of learned) if (!skills.includes(skill.label)) skills.push(skill.label);
  return Object.freeze({
    key: `${snapshot.id}-${level}`,
    name: snapshot.name,
    classLabel: UNIT_CLASSES.find((unitClass) => unitClass.id === snapshot.classId)?.label ?? snapshot.classId,
    sprite: getUnitSprite(snapshot.classId),
    level,
    stats: Object.freeze(
      STATS.map(([stat, label]) =>
        Object.freeze({
          stat,
          label,
          value: stat === 'health' ? snapshot.maxHealth : stat === 'mana' ? snapshot.maxMana : snapshot[stat],
          gain: offer.gains?.[stat] ?? 0,
        }),
      ),
    ),
    skills: Object.freeze(skills),
    boons: Object.freeze(
      offer.boons.map((boon) => {
        const amount = getStatBoonGain(unit, boon);
        return Object.freeze({
          id: boon.id,
          name: boon.name,
          kind: boon.kind,
          description: boon.description,
          evolves: completesEvolution(snapshot, relics, { boon: boon.id }),
          gain: boon.stat && amount > 0 ? Object.freeze({ stat: boon.stat.stat, amount }) : null,
        });
      }),
    ),
  });
}
