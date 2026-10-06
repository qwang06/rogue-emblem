// A dev-server-only endpoint the config editor saves to, so edits made in
// the browser land in the repo's data files: POST /__configs/<id> with the
// file's text writes it, after the game's own parser accepts it, in the
// parser's formatting, then Prettier's (so the repo's format check passes).
// `vite build` and `vite preview` don't have it (the plugin only applies to
// `vite serve`), so a deployed game can't write anything; the editor saves
// to browser storage there instead.

import { writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import * as prettier from 'prettier';
import type { Plugin, ViteDevServer } from 'vite';
import { SAVE_CONFIG_HEADER, SAVE_CONFIG_PATH } from '../src/data/configSaveApi.ts';

const MAX_BODY_BYTES = 1024 * 1024;

// What a config id saves to: the data file, and the module whose `parse`
// checks the text (throwing on a mistake) and whose `format` writes the
// parsed value back out.
export interface SavableConfig {
  file: string;
  module: string;
  parse: string;
  format: string;
}

export const SAVABLE_CONFIGS: Readonly<Record<string, SavableConfig>> = Object.freeze({
  'dungeon-floors': {
    file: 'src/data/dungeon.json',
    module: '/src/game/dungeonConfigFile.ts',
    parse: 'parseDungeonSettings',
    format: 'formatDungeonSettings',
  },
});

export interface SaveResult {
  status: number;
  body: { ok: true } | { ok: false; error: string };
}

export interface SaveDeps {
  // Loads a module through the dev server, so it imports like it does in the game.
  load: (module: string) => Promise<Record<string, unknown>>;
  write: (file: string, text: string) => Promise<void>;
}

const failure = (status: number, error: string): SaveResult => ({ status, body: { ok: false, error } });

// Handles one save: checks the request, parses the text with the config's
// parser and writes the formatted result. Pure apart from `deps`.
export async function saveConfig(
  request: { method?: string; url: string; headers: Record<string, string | string[] | undefined>; body: string },
  configs: Readonly<Record<string, SavableConfig>>,
  deps: SaveDeps,
): Promise<SaveResult> {
  if (request.method !== 'POST') return failure(405, 'Saves must be POSTed');
  if (request.headers[SAVE_CONFIG_HEADER] !== '1') return failure(403, 'Missing the save header');
  const id = request.url.slice(SAVE_CONFIG_PATH.length);
  const config = Object.hasOwn(configs, id) ? configs[id] : undefined;
  if (!config) return failure(404, `No config "${id}" can be saved`);

  const mod = await deps.load(config.module);
  const parse = mod[config.parse] as (text: string) => unknown;
  const format = mod[config.format] as (value: unknown) => string;
  let text: string;
  try {
    text = format(parse(request.body));
  } catch (error) {
    return failure(400, (error as Error).message);
  }
  await deps.write(config.file, text);
  return { status: 200, body: { ok: true } };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(new Error('The file is too big to save'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

function send(res: ServerResponse, { status, body }: SaveResult) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function saveConfigsPlugin(): Plugin {
  return {
    name: 'rogue-emblem:save-configs',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(SAVE_CONFIG_PATH, (req, res) => {
        // Connect strips the mount path from req.url; originalUrl keeps it.
        const url = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '';
        readBody(req)
          .then((body) =>
            saveConfig({ method: req.method, url, headers: req.headers, body }, SAVABLE_CONFIGS, {
              load: (module) => server.ssrLoadModule(module),
              write: (file, text) => writeFormatted(resolve(server.config.root, file), text),
            }),
          )
          .then(
            (result) => send(res, result),
            (error: Error) => send(res, failure(500, error.message)),
          );
      });
    },
  };
}

// Writes `text` laid out by the repo's Prettier config, as `npm run format` would.
async function writeFormatted(file: string, text: string): Promise<void> {
  const options = (await prettier.resolveConfig(file)) ?? {};
  await writeFile(file, await prettier.format(text, { ...options, filepath: file }), 'utf8');
}
