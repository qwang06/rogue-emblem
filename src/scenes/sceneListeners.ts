// Listeners a game object hangs on its scene's events (UPDATE, POST_UPDATE,
// PRE_RENDER, ...) to follow or animate it, removed again when it's destroyed.
//
// Removing them with `off` alone isn't enough: Phaser's emitter calls the
// listeners an event had when it started, so when one listener destroys a
// sprite (a tween or timer finishing a unit's death fades it out), the
// sprite's own listeners further down the list still run that once, on a
// destroyed sprite whose `anims`, `frame` and so on are gone. A listener
// added here does nothing after `stop`, even mid-event.

type Listener = (...args: never[]) => void;

export interface SceneEvents {
  on(event: string, listener: Listener): unknown;
  off(event: string, listener: Listener): unknown;
}

// Adds `listeners` (event name → listener) to `events`. Returns `stop`, which
// removes them and makes any call still on its way a no-op.
export function listenUntilStopped(events: SceneEvents, listeners: Readonly<Record<string, Listener>>): () => void {
  let live = true;
  const added = Object.entries(listeners).map(([event, listener]) => {
    const guarded = (...args: never[]) => {
      if (live) listener(...args);
    };
    events.on(event, guarded);
    return { event, guarded };
  });
  return () => {
    live = false;
    for (const { event, guarded } of added) events.off(event, guarded);
  };
}
