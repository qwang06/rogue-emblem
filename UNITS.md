# UNITS.md

Reference for every unit class: base stats, growth rates, caps, weapons and skills. Keep it in step with the code: whenever a class's numbers, weapons or skills change (`src/game/Villager.ts`, `src/game/Soldier.ts`, `src/game/Archer.ts`, `src/game/Vanguard.ts`, `src/game/Wizard.ts`, `src/game/Guard.ts`, `src/game/weapons.ts`, `src/game/skills.ts`, or a new class in `src/game/unitClasses.ts`), update this file in the same change. `src/game/unitsDoc.test.ts` checks the tables below against the code and fails if they drift.

## How the numbers work

- **Weapons:** every attack is made with the unit's equipped weapon — the first weapon in its inventory it can wield. A class masters weapon types (`physical`, `magical`, `siege`) and can only wield those. Picking a weapon in the Attack menu equips it. A unit with no weapon it can wield can't attack or counter.
- **Damage** of a regular hit = `STR + Mt − DEF` for physical and siege weapons (`MAG + Mt − RES` for magical ones), never below 0.
- **Attack speed** = `SPD − max(0, Wt − STR)`: a weapon heavier than the wielder's strength slows it down.
- **Hit chance** = (weapon `Hit` + `SKL × 2` + `LCK / 2`) − (attack speed `× 2` + `LCK` of the target), clamped to 0–100%.
- **Crit chance** = (weapon `Crit` + `SKL / 2`) − target's `LCK`, clamped to 0–100%. A crit deals ×3 damage.
- **Doubling:** a unit strikes twice in an exchange when its attack speed beats the opponent's by 4 or more.
- **Counters:** the defender strikes back if the attacker is within its weapon's range (`Rng`). Bows and siege engines can't strike adjacent foes.
- **Uses:** every strike, hit or miss, spends one use of the striker's weapon. A weapon with no uses left breaks and is gone, and a unit whose weapon breaks mid-exchange stops striking. Fists never break (`∞`).
- **Growths** are the % chance a stat rises by 1 on each level up. A stat never grows past its cap. Max level is 20, 100 XP per level.
- **Skills** always hit, never crit, and the target can't counter. Their damage is the user's regular hit (weapon might included) with any bonus `STR` added, then scaled; scaled damage rounds up. Using one costs mana, earns XP like a landed hit, and spends no weapon uses.

Halves round down unless noted otherwise. Full formulas live in `ARCHITECTURES.md` (`combat.ts`, `combatStats.ts`, `weapons.ts`, `experience.ts`, `skills.ts`).

## Weapons

One starter weapon per armed unit in the unit catalog. Fists, the Iron Spear, the Iron Bow, the Iron Axe and Fire are carried by a class; the rest wait for their classes (milestone 2.3).

| Weapon     | Type     | Mt  | Hit | Crit | Wt  | Rng | Uses | For (catalog art)           |
| ---------- | -------- | --- | --- | ---- | --- | --- | ---- | --------------------------- |
| Fists      | physical | 0   | 80  | 0    | 0   | 1   | ∞    | Villager                    |
| Iron Spear | physical | 1   | 80  | 0    | 3   | 1   | 40   | Soldier                     |
| Iron Axe   | physical | 3   | 65  | 0    | 5   | 1   | 40   | Vanguard (axe)              |
| Iron Bow   | physical | 2   | 80  | 0    | 2   | 2   | 40   | Archer                      |
| Fire       | magical  | 2   | 85  | 0    | 1   | 1–2 | 30   | Elemental, Vanguard (staff) |
| Powder Keg | siege    | 5   | 70  | 0    | 6   | 1–2 | 5    | Sapper                      |
| Ballista   | siege    | 6   | 70  | 0    | 8   | 2–3 | 10   | Siege                       |

## Villager

The player's townsfolk in the demo battle. For now a villager has the same stat line, growths and caps as a soldier; its identity comes from its skill and its bare fists.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 10   | 70%    | 40  |
| MP   | 5    | 40%    | 30  |
| STR  | 4    | 45%    | 20  |
| MAG  | 0    | 5%     | 20  |
| SKL  | 3    | 40%    | 20  |
| SPD  | 3    | 40%    | 20  |
| LCK  | 2    | 30%    | 20  |
| DEF  | 2    | 30%    | 20  |
| RES  | 0    | 15%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon |
| ------------ | --------------- |
| physical     | Fists           |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 1          | 2    | 1–4   | Half the regular hit, rounded up |

Carries Fists, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Soldier

The spear-and-shield infantry: the enemy in the demo battle, and a choice in Training.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 10   | 70%    | 40  |
| MP   | 5    | 40%    | 30  |
| STR  | 4    | 45%    | 20  |
| MAG  | 0    | 5%     | 20  |
| SKL  | 3    | 40%    | 20  |
| SPD  | 3    | 40%    | 20  |
| LCK  | 2    | 30%    | 20  |
| DEF  | 2    | 30%    | 20  |
| RES  | 0    | 15%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon |
| ------------ | --------------- |
| physical     | Iron Spear      |

| Skill        | Learned at | Mana | Range | Damage                      |
| ------------ | ---------- | ---- | ----- | --------------------------- |
| Power Strike | 1          | 2    | 1     | The regular hit with +3 STR |

Carries an Iron Spear, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Archer

The ranged infantry: frail but accurate. Its bow only reaches two tiles away, so it can't strike or counter a foe on the next tile, and Long Shot is how it hits from further off (or up close).

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 9    | 60%    | 40  |
| MP   | 5    | 40%    | 30  |
| STR  | 3    | 40%    | 20  |
| MAG  | 0    | 5%     | 20  |
| SKL  | 5    | 55%    | 20  |
| SPD  | 4    | 45%    | 20  |
| LCK  | 2    | 35%    | 20  |
| DEF  | 1    | 20%    | 20  |
| RES  | 1    | 20%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon |
| ------------ | --------------- |
| physical     | Iron Bow        |

| Skill     | Learned at | Mana | Range | Damage          |
| --------- | ---------- | ---- | ----- | --------------- |
| Long Shot | 1          | 2    | 1–3   | The regular hit |

Carries an Iron Bow, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Vanguard

The axe-wielding front line: high HP and strength, low skill, speed and luck. Its strength matches the Iron Axe's weight, so the axe doesn't slow it, but the axe's low hit makes it the least accurate class.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 12   | 85%    | 40  |
| MP   | 5    | 30%    | 30  |
| STR  | 5    | 55%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 2    | 30%    | 20  |
| SPD  | 2    | 30%    | 20  |
| LCK  | 1    | 25%    | 20  |
| DEF  | 2    | 30%    | 20  |
| RES  | 0    | 10%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon |
| ------------ | --------------- |
| physical     | Iron Axe        |

| Skill  | Learned at | Mana | Range | Damage                      |
| ------ | ---------- | ---- | ----- | --------------------------- |
| Cleave | 1          | 2    | 1     | The regular hit with +2 STR |

Carries an Iron Axe, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Wizard

The spellcaster: magic instead of strength and resistance instead of defense, with more mana than anyone. Fire hits with `MAG` against the target's `RES`, so a soldier's armor doesn't help it, and reaches two tiles, so the wizard can strike without being countered by a melee foe. In return it has the least HP and no defense.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 8    | 50%    | 40  |
| MP   | 8    | 60%    | 30  |
| STR  | 1    | 10%    | 20  |
| MAG  | 4    | 55%    | 20  |
| SKL  | 3    | 40%    | 20  |
| SPD  | 3    | 40%    | 20  |
| LCK  | 2    | 30%    | 20  |
| DEF  | 0    | 10%    | 20  |
| RES  | 3    | 40%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon |
| ------------ | --------------- |
| magical      | Fire            |

| Skill    | Learned at | Mana | Range | Damage                      |
| -------- | ---------- | ---- | ----- | --------------------------- |
| Fireball | 1          | 3    | 1–3   | The regular hit with +1 MAG |

Carries Fire, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Guard

The armored infantry behind a tower shield: a soldier's strength and spear with 5 DEF, so a level-1 soldier's spear can't hurt it, but it's slow (1 SPD, 4 MOV) and has no resistance, so magic hits it in full.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 12   | 75%    | 40  |
| MP   | 5    | 25%    | 30  |
| STR  | 4    | 45%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 3    | 35%    | 20  |
| SPD  | 1    | 20%    | 20  |
| LCK  | 1    | 25%    | 20  |
| DEF  | 5    | 50%    | 20  |
| RES  | 0    | 10%    | 20  |
| MOV  | 4    | –      | –   |

| Weapon types | Starting weapon |
| ------------ | --------------- |
| physical     | Iron Spear      |

| Skill       | Learned at | Mana | Range | Damage                      |
| ----------- | ---------- | ---- | ----- | --------------------------- |
| Shield Bash | 1          | 2    | 1     | The regular hit with +1 STR |

Carries an Iron Spear, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Matchups at level 1

Villager and Soldier share a stat line, so between them the difference is the weapon: the soldier's spear adds 1 might. Each attack is from as close as the attacker's weapon reaches (2 tiles for the bow).

| Attacker | Target   | Weapon     | Damage | Hit | Crit | Strikes |
| -------- | -------- | ---------- | ------ | --- | ---- | ------- |
| Villager | Soldier  | Fists      | 2      | 79% | 0%   | 1       |
| Soldier  | Villager | Iron Spear | 3      | 79% | 0%   | 1       |
| Archer   | Soldier  | Iron Bow   | 3      | 83% | 0%   | 1       |
| Vanguard | Soldier  | Iron Axe   | 6      | 61% | 0%   | 1       |
| Wizard   | Soldier  | Fire       | 6      | 84% | 0%   | 1       |
| Guard    | Soldier  | Iron Spear | 3      | 78% | 0%   | 1       |
| Soldier  | Guard    | Iron Spear | 0      | 84% | 0%   | 1       |

| Skill        | User     | Target   | Damage | Hit    | Crit  | Strikes       |
| ------------ | -------- | -------- | ------ | ------ | ----- | ------------- |
| Throw Stones | Villager | Soldier  | 1      | always | never | 1, no counter |
| Power Strike | Soldier  | Villager | 6      | always | never | 1, no counter |
| Long Shot    | Archer   | Soldier  | 3      | always | never | 1, no counter |
| Cleave       | Vanguard | Soldier  | 8      | always | never | 1, no counter |
| Fireball     | Wizard   | Soldier  | 7      | always | never | 1, no counter |
| Shield Bash  | Guard    | Soldier  | 4      | always | never | 1, no counter |
