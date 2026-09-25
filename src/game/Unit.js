// Base class for all units on the tactics board. No Phaser, no rendering —
// just stats and the state changes every unit shares (taking damage,
// healing, dying, spending mana, leveling up). Specific unit types extend
// this and set their own class and stats; the skills a unit knows come
// from its class's skill tree and its level (see skills.js).

export class Unit {
  constructor({ name, unitClass = null, level = 1, health, mana = 0, attack, defense, movement, range = 1, team }) {
    this.name = name;
    this.unitClass = unitClass;
    this.level = level;
    this.maxHealth = health;
    this.health = health;
    this.maxMana = mana;
    this.mana = mana;
    this.attack = attack;
    this.defense = defense;
    this.movement = movement;
    this.range = range;
    this.team = team;
  }

  isAlive() {
    return this.health > 0;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health;
  }

  // Throws if the unit can't afford it — check canUseSkill first.
  spendMana(amount) {
    if (amount > this.mana) {
      throw new Error(`${this.name} has ${this.mana} mana, can't spend ${amount}`);
    }
    this.mana -= amount;
    return this.mana;
  }

  restoreMana(amount) {
    this.mana = Math.min(this.maxMana, this.mana + amount);
    return this.mana;
  }

  levelUp() {
    this.level += 1;
    return this.level;
  }
}
