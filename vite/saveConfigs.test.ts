import { describe, expect, it } from 'vitest';
import { SAVE_CONFIG_HEADER } from '../src/data/configSaveApi.ts';
import { SAVABLE_CONFIGS, saveConfig, type SavableConfig } from './saveConfigs.ts';

const CONFIGS: Record<string, SavableConfig> = {
  things: { file: 'src/data/things.json', module: '/things.ts', parse: 'parse', format: 'format' },
};

// A parser that wants a JSON object with a numeric `n`, and a formatter
// that writes it back with a trailing newline.
const thingsModule = {
  parse(text: string) {
    const json = JSON.parse(text);
    if (typeof json.n !== 'number') throw new Error('n must be a number');
    return json;
  },
  format: (value: unknown) => `${JSON.stringify(value)}\n`,
};

function setup() {
  const writes: [string, string][] = [];
  const deps = {
    load: async () => thingsModule,
    write: async (file: string, text: string) => {
      writes.push([file, text]);
    },
  };
  return { writes, deps };
}

const request = (overrides: Partial<Parameters<typeof saveConfig>[0]> = {}) => ({
  method: 'POST',
  url: '/__configs/things',
  headers: { [SAVE_CONFIG_HEADER]: '1' },
  body: '{ "n": 3 }',
  ...overrides,
});

describe('saveConfig', () => {
  it('writes the parsed, formatted text to the config file', async () => {
    const { writes, deps } = setup();
    expect(await saveConfig(request(), CONFIGS, deps)).toEqual({ status: 200, body: { ok: true } });
    expect(writes).toEqual([['src/data/things.json', '{"n":3}\n']]);
  });

  it('turns away text the parser rejects, writing nothing', async () => {
    const { writes, deps } = setup();
    const result = await saveConfig(request({ body: '{ "n": "three" }' }), CONFIGS, deps);
    expect(result).toEqual({ status: 400, body: { ok: false, error: 'n must be a number' } });
    expect(writes).toEqual([]);
  });

  it.each([
    ['a GET', request({ method: 'GET' }), 405],
    ['a save without its header', request({ headers: {} }), 403],
    ['an unknown config', request({ url: '/__configs/other' }), 404],
    ['an inherited key', request({ url: '/__configs/constructor' }), 404],
  ])('turns away %s', async (_, req, status) => {
    const { writes, deps } = setup();
    expect((await saveConfig(req, CONFIGS, deps)).status).toBe(status);
    expect(writes).toEqual([]);
  });

  it('saves the dungeon floors to the built-in data file', () => {
    expect(SAVABLE_CONFIGS['dungeon-floors'].file).toBe('src/data/dungeon.json');
  });
});
