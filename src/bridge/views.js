// Pure conversions from game objects to plain, frozen snapshots for the UI.
// React only ever sees these — never live Unit instances — so a mutation
// like takeDamage() can't silently change what's on screen without a new
// snapshot being published (and a re-render being triggered).

export function toUnitView(unit) {
  if (!unit) return null;
  return Object.freeze({
    name: unit.name,
    team: unit.team,
    health: unit.health,
    maxHealth: unit.maxHealth,
    attack: unit.attack,
    defense: unit.defense,
    movement: unit.movement,
    range: unit.range,
  });
}

// Converts a world-space point to screen pixels (relative to the canvas and
// the #ui overlay that shares its box). `camera` is the visible world
// rectangle's top-left plus the zoom: { x, y, zoom }.
export function worldToScreen(point, camera) {
  return {
    x: (point.x - camera.x) * camera.zoom,
    y: (point.y - camera.y) * camera.zoom,
  };
}

// Snapshot of one floating damage number. `x`/`y` are screen pixels for
// the point the number rises from; `durationMs` is how long it stays up,
// so the UI animation and the store entry's lifetime agree.
export function toDamagePopupView({ id, amount, x, y, durationMs }) {
  return Object.freeze({ id, amount, x, y, durationMs });
}

// Snapshot of one unit in the deployment roster menu: its id, the name to
// show, the sprite frame to draw, and whether it's already on the map.
export function toRosterEntryView({ id, unit, frame, placed }) {
  return Object.freeze({ id, label: unit.name, frame, placed });
}
