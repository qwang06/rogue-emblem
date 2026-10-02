// Pure rules for unit skills. Each unit class has a skill tree: a list of
// { level, skill } entries, and a unit knows every skill in its class's
// tree whose level it has reached — so skills are gained by leveling up.
// Using a skill costs mana. No Phaser, no rendering, no hidden state.

// A skill: { id, label, manaCost, range, power, animation }. `range` is
// how far away (orthogonal steps) the target can be, `power` is the damage
// it deals before the target's defense, and `animation` names the effect
// the presentation layer plays for it.

export const THROW_GRENADE = Object.freeze({
  id: 'throw-grenade',
  label: 'Throw Grenade',
  manaCost: 3,
  range: 2,
  power: 6,
  animation: 'grenade',
});

// unitClass -> [{ level, skill }]. Classes without an entry know no skills.
export const SKILL_TREES = Object.freeze({
  soldier: Object.freeze([Object.freeze({ level: 1, skill: THROW_GRENADE })]),
});

// Every skill a unit of unitClass knows at the given level, in tree order.
export function getLearnedSkills(unitClass, level, trees = SKILL_TREES) {
  const tree = trees[unitClass] ?? [];
  return tree.filter((entry) => entry.level <= level).map((entry) => entry.skill);
}

// Skills newly learned by going from fromLevel up to toLevel, e.g. to
// announce them on level up.
export function getSkillsLearnedBetween(unitClass, fromLevel, toLevel, trees = SKILL_TREES) {
  const tree = trees[unitClass] ?? [];
  return tree
    .filter((entry) => entry.level > fromLevel && entry.level <= toLevel)
    .map((entry) => entry.skill);
}

// Finds a skill the unit knows by id, or null.
export function findLearnedSkill(unitClass, level, skillId, trees = SKILL_TREES) {
  return getLearnedSkills(unitClass, level, trees).find((skill) => skill.id === skillId) ?? null;
}

// Damage a damaging skill deals: its own power minus the target's defense,
// never below zero. It doesn't depend on the user's strength or magic.
export function calculateSkillDamage(skill, defender) {
  return Math.max(0, skill.power - defender.defense);
}

export function canUseSkill(unit, skill) {
  return unit.mana >= skill.manaCost;
}

// Entries for the skill menu: each skill with its cost, disabled if the
// unit can't afford it.
export function getSkillActions(unit, skills) {
  return Object.freeze(
    skills.map((skill) =>
      Object.freeze({
        id: skill.id,
        label: skill.label,
        manaCost: skill.manaCost,
        disabled: !canUseSkill(unit, skill),
      }),
    ),
  );
}
