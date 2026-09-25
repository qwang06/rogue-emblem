import { useGameStore } from './useGameStore.js';

export function UnitPanel() {
  const unit = useGameStore((state) => state.hoveredUnit);
  if (!unit) return null;

  return (
    <section className="panel unit-panel">
      <h2 className="unit-panel__name">{unit.name}</h2>
      <dl className="unit-panel__stats">
        <dt>LV</dt>
        <dd>{unit.level}</dd>
        <dt>HP</dt>
        <dd>
          {unit.health}/{unit.maxHealth}
        </dd>
        <dt>MP</dt>
        <dd>
          {unit.mana}/{unit.maxMana}
        </dd>
        <dt>ATK</dt>
        <dd>{unit.attack}</dd>
        <dt>DEF</dt>
        <dd>{unit.defense}</dd>
        <dt>MOV</dt>
        <dd>{unit.movement}</dd>
      </dl>
    </section>
  );
}
