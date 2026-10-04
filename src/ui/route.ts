// Which page the app shows, read from the URL's hash so it works from any
// path (the build is served from a GitHub Pages subpath) without server
// rewrites. '#/configs' is the config editor's index and '#/configs/<id>'
// one config's page; anything else is the game.

export type Route = { page: 'game' } | { page: 'configs' } | { page: 'config'; id: string };

const CONFIG_ID_PATTERN = /^[a-z0-9-]+$/;

export function parseRoute(hash: string): Route {
  const [first, second, ...rest] = hash.replace(/^#\/?/, '').replace(/\/+$/, '').split('/');
  if (first !== 'configs' || rest.length > 0) return { page: 'game' };
  if (second === undefined) return { page: 'configs' };
  return CONFIG_ID_PATTERN.test(second) ? { page: 'config', id: second } : { page: 'game' };
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
  }
}
