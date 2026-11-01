import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENEMY_FACTION,
  FACTIONS,
  findFaction,
  getDefaultFaction,
  isFactionId,
  PLAYER_FACTION,
} from './factions.ts';

describe('FACTIONS', () => {
  it('gives each of the six art versions a faction, in order', () => {
    expect(FACTIONS.map(({ id, variant }) => [id, variant])).toEqual([
      ['azure', '01'],
      ['sunward', '02'],
      ['rose', '03'],
      ['ironhold', '04'],
      ['verdant', '05'],
      ['crimson', '06'],
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(FACTIONS)).toBe(true);
    expect(FACTIONS.every(Object.isFrozen)).toBe(true);
  });
});

describe('lookups', () => {
  it('finds a faction by id, and null for anything else', () => {
    expect(findFaction('rose')?.name).toBe('Rose Court');
    expect(findFaction('kraken')).toBeNull();
    expect(findFaction(null)).toBeNull();
    expect(findFaction(undefined)).toBeNull();
  });

  it('tells faction ids apart', () => {
    expect(isFactionId('verdant')).toBe(true);
    expect(isFactionId('Verdant')).toBe(false);
    expect(isFactionId(4)).toBe(false);
  });
});

describe('getDefaultFaction', () => {
  it("gives the player and guests the player's faction, and enemies the enemy default", () => {
    expect(getDefaultFaction('player')).toBe(PLAYER_FACTION);
    expect(getDefaultFaction('guest')).toBe(PLAYER_FACTION);
    expect(getDefaultFaction('enemy')).toBe(DEFAULT_ENEMY_FACTION);
  });
});
