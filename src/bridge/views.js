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
    experience: unit.experience,
    health: unit.health,
    maxHealth: unit.maxHealth,
    mana: unit.mana,
    maxMana: unit.maxMana,
    strength: unit.strength,
    magic: unit.magic,
    skill: unit.skill,
    speed: unit.speed,
    luck: unit.luck,
    defense: unit.defense,
    resistance: unit.resistance,
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

// Snapshot of where a map tile shows on the canvas, for UI anchored beside
// it (e.g. a unit's menus): its edges as fractions of the canvas (see
// toCanvasFraction), so it stays put however large the canvas is displayed.
// `tile` is { x, y } in grid cells, `camera` as in worldToScreen, and `size`
// the canvas's { width, height }.
export function toTileAnchorView(tile, tileSize, camera, size) {
  const topLeft = toCanvasFraction(worldToScreen({ x: tile.x * tileSize, y: tile.y * tileSize }, camera), size);
  const bottomRight = toCanvasFraction(
    worldToScreen({ x: (tile.x + 1) * tileSize, y: (tile.y + 1) * tileSize }, camera),
    size,
  );
  return Object.freeze({ left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y });
}

// The smallest TileAnchorView covering both a and b (e.g. an attacker's
// and its target's tiles), so UI placed beside it covers neither.
export function mergeTileAnchors(a, b) {
  return Object.freeze({
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  });
}

// Snapshot of the combat forecast shown while aiming an attack, from
// getCombatForecast (src/game/combat.js): per side, the unit's name and
// team plus its forecast numbers (damage / hit / crit are null for a
// defender that can't counter, which the UI shows as "–"). `anchor` is a
// TileAnchorView covering both units, which the panel opens beside.
export function toCombatForecastView({ forecast, attacker, defender, anchor }) {
  const side = (unit, numbers) => Object.freeze({ name: unit.name, team: unit.team, ...numbers });
  return Object.freeze({
    attacker: side(attacker, forecast.attacker),
    defender: side(defender, forecast.defender),
    anchor,
  });
}

// How each kind of popup reads: damage is the bare number (a crit calls
// itself out), a miss says so, and recovery says what was restored.
const POPUP_TEXT = Object.freeze({
  damage: (amount) => `${amount}`,
  crit: (amount) => `Crit! ${amount}`,
  miss: () => 'Miss',
  health: (amount) => `+${amount} HP`,
  mana: (amount) => `+${amount} MP`,
});

// Snapshot of one floating number over a unit: damage taken (plain, a
// crit, or a miss), or health or mana recovered (`kind` is 'damage' |
// 'crit' | 'miss' | 'health' | 'mana', which the UI
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

// Snapshot of the XP bar shown after a player unit's combat: its name, the
// level it started at, how many XP it gained, and the bar's fill (0–100)
// before and after — a level up fills it to 100, and the level-up panel
// takes over from there. `from` is the unit's { level, experience } before
// the gain and `result` the resolveExperienceGain result (src/game/
// experience.js). `id` changes per bar so the UI restarts its animation.
export function toExperienceGainView({ id, name, from, result, durationMs }) {
  return Object.freeze({
    id,
    name,
    level: from.level,
    gained: result.amount,
    startPercent: from.experience,
    endPercent: result.levelUps.length > 0 ? 100 : result.experience,
    durationMs,
  });
}

// How each growth stat is labelled on the level-up panel, in display order.
const LEVEL_UP_STATS = Object.freeze([
  ['health', 'HP'],
  ['mana', 'MP'],
  ['strength', 'STR'],
  ['magic', 'MAG'],
  ['skill', 'SKL'],
  ['speed', 'SPD'],
  ['luck', 'LCK'],
  ['defense', 'DEF'],
  ['resistance', 'RES'],
]);

// Snapshot of the level-up panel for one level gained: the unit's name, the
// level reached, each stat's new value and gain (from a levelUps entry of
// resolveExperienceGain), and the labels of any skills learned. `id`
// changes per panel so the UI restarts its animation.
export function toLevelUpView({ id, name, levelUp, durationMs }) {
  return Object.freeze({
    id,
    name,
    level: levelUp.level,
    stats: Object.freeze(
      LEVEL_UP_STATS.map(([stat, label]) =>
        Object.freeze({ id: stat, label, value: levelUp.stats[stat], gain: levelUp.gains[stat] ?? 0 }),
      ),
    ),
    skills: Object.freeze(levelUp.skills.map((skill) => skill.label)),
    durationMs,
  });
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

// Snapshot of the line the dialog box shows, from a dialog
// (src/game/dialog.js). `id` changes per line so the UI restarts its
// typing; `sprite` is the unit art standing in for the speaker's portrait
// (null for none); `revealed` is true once the player has skipped the
// typing, and `charsPerSecond` is how fast it types otherwise, so the UI
// and the scene agree on when a line is fully shown.
export function toDialogView({ id, dialog, sprite, charsPerSecond }) {
  const { speaker, side, text } = dialog.lines[dialog.index];
  return Object.freeze({
    id,
    speaker,
    side,
    text,
    sprite: sprite ?? null,
    revealed: dialog.revealed,
    charsPerSecond,
    isLast: dialog.index === dialog.lines.length - 1,
  });
}
