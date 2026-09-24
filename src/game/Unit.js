// Base class for all units on the tactics board. No Phaser, no rendering —
// just stats and the state changes every unit shares (taking damage,
// healing, dying). Specific unit types extend this and add their own
// abilities on top.

export class Unit {
  constructor({ name, health, attack, defense, movement, range = 1, team }) {
    this.name = name;
    this.maxHealth = health;
    this.health = health;
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
}
