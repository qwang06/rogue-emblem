// Every piece of authored or tunable game data, grouped for the config
// editor's index page (#/configs). Each entry names the files it lives in
// and summarizes what's there now, read from the data itself so the counts
// never go stale. Editing pages for each entry come later.

import { CHARACTERS, DIALOGS } from '../data/dialogs.ts';
import { STORY_CHAPTERS } from '../game/battleSetup.ts';
import { CRIT_MULTIPLIER, DOUBLE_THRESHOLD } from '../game/combatStats.ts';
import { DUNGEON_CONFIGS } from '../data/dungeon.ts';
import { EXPERIENCE_PER_LEVEL, GROWTH_STATS, MAX_LEVEL } from '../game/experience.ts';
import { STARTING_ITEMS } from '../game/items.ts';
import { TERRAIN_MOVE_COSTS } from '../game/movement.ts';
import { SKILL_TREES } from '../game/skills.ts';
import { UNIT_CLASSES } from '../game/unitClasses.ts';
import { WEAPONS } from '../game/weapons.ts';

export interface ConfigEntry {
  id: string;
  title: string;
  description: string;
  sources: readonly string[];
  summary: string;
}

export interface ConfigGroup {
  id: string;
  title: string;
  entries: readonly ConfigEntry[];
}

export function plural(count: number, noun: string, nouns = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : nouns}`;
}

const classCount = () => plural(UNIT_CLASSES.length, 'class', 'classes');

export function getConfigCatalog(): readonly ConfigGroup[] {
  const dialogFiles = Object.values(DIALOGS);
  const conversations = dialogFiles.reduce((total, file) => total + Object.keys(file).length, 0);
  const skillCount = new Set(Object.values(SKILL_TREES).flatMap((tree) => tree.map((entry) => entry.skill.id))).size;

  return [
    {
      id: 'story',
      title: 'Story & Dialog',
      entries: [
        {
          id: 'dialogs',
          title: 'Dialogs',
          description: 'Conversations played at the opening, victory, defeat, or a given turn of each level.',
          sources: ['src/data/dialog/*.txt'],
          summary: `${plural(dialogFiles.length, 'file')} · ${plural(conversations, 'conversation')}`,
        },
        {
          id: 'characters',
          title: 'Characters',
          description: 'Everyone who can speak: name, team, unit class and portrait.',
          sources: ['src/data/characters.json'],
          summary: plural(Object.keys(CHARACTERS).length, 'character'),
        },
      ],
    },
    {
      id: 'maps',
      title: 'Maps',
      entries: [
        {
          id: 'story-chapters',
          title: 'Story Chapters',
          description: 'Hand-built maps: terrain layout, enemy positions, deployment zone and roster.',
          sources: ['src/game/battleSetup.ts', 'src/game/demoLevel.ts'],
          summary: plural(STORY_CHAPTERS.length, 'chapter'),
        },
        {
          id: 'dungeon-floors',
          title: 'Dungeon Floors',
          description: 'Per-floor settings for generated maps: size, terrain patches, enemies, trees and palette.',
          sources: ['src/data/dungeon.json'],
          summary: plural(DUNGEON_CONFIGS.length, 'floor config'),
        },
        {
          id: 'terrain-costs',
          title: 'Terrain Costs',
          description: 'Movement points spent to enter each kind of terrain, or impassable.',
          sources: ['src/game/movement.ts'],
          summary: plural(Object.keys(TERRAIN_MOVE_COSTS).length, 'terrain'),
        },
      ],
    },
    {
      id: 'units',
      title: 'Units',
      entries: [
        {
          id: 'unit-stats',
          title: 'Base Stats',
          description: "Each class's level-1 stat line, including movement.",
          sources: ['src/game/Villager.ts', 'src/game/Soldier.ts'],
          summary: classCount(),
        },
        {
          id: 'unit-growths',
          title: 'Growth Rates',
          description: 'Percent chance per level up that each stat rises.',
          sources: ['src/game/Villager.ts', 'src/game/Soldier.ts'],
          summary: `${classCount()} · ${plural(GROWTH_STATS.length, 'stat')}`,
        },
        {
          id: 'unit-caps',
          title: 'Stat Caps',
          description: 'The most each stat can reach through level ups.',
          sources: ['src/game/Villager.ts', 'src/game/Soldier.ts'],
          summary: classCount(),
        },
        {
          id: 'skills',
          title: 'Skills',
          description: 'Skills, their costs and power, and the level each class learns them at.',
          sources: ['src/game/skills.ts'],
          summary: plural(skillCount, 'skill'),
        },
      ],
    },
    {
      id: 'equipment',
      title: 'Equipment',
      entries: [
        {
          id: 'weapons',
          title: 'Weapons',
          description: 'Might, hit, crit, weight, range and uses of every weapon.',
          sources: ['src/game/weapons.ts'],
          summary: plural(WEAPONS.length, 'weapon'),
        },
        {
          id: 'items',
          title: 'Items',
          description: 'Consumables, what they restore, and what units carry into battle.',
          sources: ['src/game/items.ts'],
          summary: plural(STARTING_ITEMS.length, 'starting item'),
        },
      ],
    },
    {
      id: 'rules',
      title: 'Rules',
      entries: [
        {
          id: 'experience',
          title: 'Experience & Leveling',
          description: 'XP per level, the level cap, and XP for misses and kills.',
          sources: ['src/game/experience.ts'],
          summary: `${EXPERIENCE_PER_LEVEL} XP per level · cap ${MAX_LEVEL}`,
        },
        {
          id: 'combat',
          title: 'Combat',
          description: 'Crit multiplier and how much faster a unit must be to strike twice.',
          sources: ['src/game/combatStats.ts', 'src/game/combat.ts'],
          summary: `Crit ×${CRIT_MULTIPLIER} · doubles at +${DOUBLE_THRESHOLD} speed`,
        },
      ],
    },
  ];
}
