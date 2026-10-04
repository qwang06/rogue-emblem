import { useSyncExternalStore } from 'react';
import { parseRoute, type Route } from './route.ts';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getHash() {
  return window.location.hash;
}

// The current route, re-rendering whenever the URL's hash changes.
export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, getHash));
}
