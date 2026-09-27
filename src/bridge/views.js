// Pure conversions from game objects to plain, frozen snapshots for the UI.
// React only ever sees these — never live Unit instances — so a mutation
// like takeDamage() can't silently change what's on screen without a new
// snapshot being published (and a re-render being triggered).

export function toUnitView(unit) {
  if (!unit) return null;
  return Object.freeze({
    name: unit.name,
    team: unit.team,
    level: unit.level,
    health: unit.health,
    maxHealth: unit.maxHealth,
    mana: unit.mana,
    maxMana: unit.maxMana,
    attack: unit.attack,
    defense: unit.defense,
    movement: unit.movement,
    range: unit.range,
    items: Object.freeze(
      (unit.items ?? []).map(({ item, quantity }) => Object.freeze({ id: item.id, label: item.label, quantity })),
    ),
  });
}

// Converts a world-space point to screen pixels (relative to the canvas and
// the HUD overlay that shares its box), at the canvas's own resolution. `camera` is the visible world
// rectangle's top-left plus the zoom: { x, y, zoom }.
export function worldToScreen(point, camera) {
  return {
    x: (point.x - camera.x) * camera.zoom,
    y: (point.y - camera.y) * camera.zoom,
  };
}

// Converts a point in canvas pixels to fractions (0–1) of the canvas size,
// so map-anchored UI stays in place however large the canvas is displayed.
// `size` is the canvas's { width, height }.
export function toCanvasFraction(point, size) {
  return { x: point.x / size.width, y: point.y / size.height };
}

// How each kind of popup reads: damage is the bare number, recovery says
// what was restored.
const POPUP_TEXT = Object.freeze({
  damage: (amount) => `${amount}`,
  health: (amount) => `+${amount} HP`,
  mana: (amount) => `+${amount} MP`,
});

// Snapshot of one floating number over a unit: damage taken, or health or
// mana recovered (`kind` is 'damage' | 'health' | 'mana', which the UI
// colors by; `text` is what it shows). `x`/`y` are the point the number
// rises from, as fractions of the canvas (see toCanvasFraction); `durationMs` is how long it stays up,
// so the UI animation and the store entry's lifetime agree.
export function toDamagePopupView({ id, amount, kind = 'damage', x, y, durationMs }) {
  const text = (POPUP_TEXT[kind] ?? POPUP_TEXT.damage)(amount);
  return Object.freeze({ id, amount, kind, text, x, y, durationMs });
}

// Snapshot of one unit in the deployment roster menu: its id, the name to
// show, the sprite to draw (a texture key), and whether it's already on
// the map.
export function toRosterEntryView({ id, unit, sprite, placed }) {
  return Object.freeze({ id, label: unit.name, sprite, placed });
}

const PHASE_LABELS = Object.freeze({ player: 'Player Phase', enemy: 'Enemy Phase' });

// Snapshot of whose phase it is, from a turn state (src/game/turns.js):
// the turn number, the team, and the phase's display name.
export function toTurnView(turnState) {
  if (!turnState) return null;
  const { turn, team } = turnState;
  return Object.freeze({ turn, team, label: PHASE_LABELS[team] ?? team });
}

// Snapshot of the banner announcing a new phase. `id` changes per banner so
// the UI restarts its animation; `durationMs` is how long it stays up.
export function toPhaseBannerView({ id, turnState, durationMs }) {
  return Object.freeze({ id, ...toTurnView(turnState), durationMs });
}
