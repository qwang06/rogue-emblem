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
