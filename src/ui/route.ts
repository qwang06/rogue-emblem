// Which page the app shows, read from the URL's hash so it works from any
// path (the build is served from a GitHub Pages subpath) without server
// rewrites. '#/configs' is the config editor's index, '#/configs/<id>' one
// config's page, and '#/configs/dungeon-floors/preview/<index>/<seed>' the
// map a dungeon floor config makes from a seed, shown read-only on the
// battle stage; anything else is the game.

export type Route =
  | { page: 'game' }
  | { page: 'configs' }
  | { page: 'config'; id: string }
  | { page: 'dungeon-preview'; index: number; seed: number };

const CONFIG_ID_PATTERN = /^[a-z0-9-]+$/;
// Config indices and seeds (seeds are below 2^32, so ten digits at most).
const NUMBER_PATTERN = /^\d{1,10}$/;

export function parseRoute(hash: string): Route {
  const [first, second, ...rest] = hash.replace(/^#\/?/, '').replace(/\/+$/, '').split('/');
  if (first !== 'configs') return { page: 'game' };
  if (second === 'dungeon-floors' && rest.length > 0) return parseDungeonPreview(rest);
  if (rest.length > 0) return { page: 'game' };
  if (second === undefined) return { page: 'configs' };
  return CONFIG_ID_PATTERN.test(second) ? { page: 'config', id: second } : { page: 'game' };
}

// The 'preview/<index>/<seed>' after '#/configs/dungeon-floors/'.
function parseDungeonPreview([word, index = '', seed = '', ...rest]: string[]): Route {
  if (word !== 'preview' || rest.length > 0 || !NUMBER_PATTERN.test(index) || !NUMBER_PATTERN.test(seed)) {
    return { page: 'game' };
  }
  return { page: 'dungeon-preview', index: Number(index), seed: Number(seed) };
}

// The hash that leads to a route (usable as an href).
export function routeHash(route: Route): string {
  switch (route.page) {
    case 'game':
      return '#/';
    case 'configs':
      return '#/configs';
    case 'config':
      return `#/configs/${route.id}`;
    case 'dungeon-preview':
      return `#/configs/dungeon-floors/preview/${route.index}/${route.seed}`;
  }
}
