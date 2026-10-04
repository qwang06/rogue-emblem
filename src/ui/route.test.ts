import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from './route.ts';

describe('parseRoute', () => {
  it('shows the game with no hash', () => {
    expect(parseRoute('')).toEqual({ page: 'game' });
    expect(parseRoute('#')).toEqual({ page: 'game' });
    expect(parseRoute('#/')).toEqual({ page: 'game' });
  });

  it('reads the configs index', () => {
    expect(parseRoute('#/configs')).toEqual({ page: 'configs' });
    expect(parseRoute('#configs')).toEqual({ page: 'configs' });
    expect(parseRoute('#/configs/')).toEqual({ page: 'configs' });
  });

  it("reads a config's page", () => {
    expect(parseRoute('#/configs/dialogs')).toEqual({ page: 'config', id: 'dialogs' });
    expect(parseRoute('#/configs/unit-stats/')).toEqual({ page: 'config', id: 'unit-stats' });
  });

  it("reads a dungeon floor config's preview", () => {
    expect(parseRoute('#/configs/dungeon-floors/preview/2/12345')).toEqual({
      page: 'dungeon-preview',
      index: 2,
      seed: 12345,
    });
    expect(parseRoute('#/configs/dungeon-floors/preview/0/7/')).toEqual({ page: 'dungeon-preview', index: 0, seed: 7 });
  });

  it('rejects malformed dungeon previews', () => {
    expect(parseRoute('#/configs/dungeon-floors/preview')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/dungeon-floors/preview/2')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/dungeon-floors/preview/x/1')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/dungeon-floors/preview/-1/1')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/dungeon-floors/preview/1/2/3')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/dungeon-floors/peek/1/2')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/dialogs/preview/1/2')).toEqual({ page: 'game' });
  });

  it('falls back to the game for unknown routes', () => {
    expect(parseRoute('#/nowhere')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/dialogs/extra')).toEqual({ page: 'game' });
    expect(parseRoute('#/configs/Bad%20Id')).toEqual({ page: 'game' });
  });
});

describe('routeHash', () => {
  it('round-trips through parseRoute', () => {
    const routes: Route[] = [
      { page: 'game' },
      { page: 'configs' },
      { page: 'config', id: 'dialogs' },
      { page: 'dungeon-preview', index: 0, seed: 4294967295 },
    ];
    for (const route of routes) expect(parseRoute(routeHash(route))).toEqual(route);
  });
});
