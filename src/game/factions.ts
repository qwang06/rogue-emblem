// The factions: the six team-color versions of the unit art pack, each a
// people of its own. A unit of a faction class (FACTION_BODIES in
// tileset.ts) wears its faction's version of that class's art. The pack's
// versions pair up into four designs: Azure and Sunward are each their own
// people, the Rose Court and the Verdant Wardens are two houses of the
// same pale, crested-helm folk, and the Ironhold Clans and the Crimson
// Legion two clans of the same tower-shield, banded-helm folk. Neutral
// units (the elementals) and monsters belong to no faction. Pure data.

import type { Team } from './turns.ts';

export type FactionId = 'azure' | 'sunward' | 'rose' | 'ironhold' | 'verdant' | 'crimson';

export interface Faction {
  id: FactionId;
  name: string;
  // The art pack's version number, '01' to '06' (Soldier_02, ...).
  variant: string;
  // The faction's color, for the UI.
  color: string;
  // A line on who they are.
  description: string;
}

export const FACTIONS: readonly Faction[] = Object.freeze([
  Object.freeze<Faction>({
    id: 'azure',
    name: 'Azure Conclave',
    variant: '01',
    color: '#3f9fb4',
    description: 'Mages in pointed hats, riding wyverns and flying carpets and firing crystal cannons.',
  }),
  Object.freeze<Faction>({
    id: 'sunward',
    name: 'Sunward Kingdom',
    variant: '02',
    color: '#e0962c',
    description: 'Topknotted humans with griffins, hot-air balloons and mortars.',
  }),
  Object.freeze<Faction>({
    id: 'rose',
    name: 'Rose Court',
    variant: '03',
    color: '#d0457f',
    description: 'A house of the pale, crested-helm folk, with pegasi, giant birds and ballistae.',
  }),
  Object.freeze<Faction>({
    id: 'ironhold',
    name: 'Ironhold Clans',
    variant: '04',
    color: '#9a6a4f',
    description: 'Tower-shield clansfolk with drakes, gyrocopters and catapults.',
  }),
  Object.freeze<Faction>({
    id: 'verdant',
    name: 'Verdant Wardens',
    variant: '05',
    color: '#4e9a3c',
    description: "The Rose Court's rival house of the pale folk, in green.",
  }),
  Object.freeze<Faction>({
    id: 'crimson',
    name: 'Crimson Legion',
    variant: '06',
    color: '#c23a2e',
    description: "The Ironhold Clans' red-clad rivals.",
  }),
]);

// The player's warband's faction.
export const PLAYER_FACTION: FactionId = 'sunward';

// The faction enemies belong to when nothing (e.g. a region) says otherwise.
export const DEFAULT_ENEMY_FACTION: FactionId = 'crimson';

// The faction with `id`, or null.
export function findFaction(id: string | null | undefined): Faction | null {
  return FACTIONS.find((faction) => faction.id === id) ?? null;
}

// Whether `id` names a faction.
export function isFactionId(id: unknown): id is FactionId {
  return typeof id === 'string' && findFaction(id) !== null;
}

// The faction a unit on `team` belongs to when it isn't given one: the
// player's for the player and its guests, DEFAULT_ENEMY_FACTION for enemies.
export function getDefaultFaction(team: Team): FactionId {
  return team === 'enemy' ? DEFAULT_ENEMY_FACTION : PLAYER_FACTION;
}
