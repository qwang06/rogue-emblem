# UNITS.md

Reference for every unit class: base stats, growth rates, caps, and skills. Keep it in step with the code: whenever a class's numbers or skills change (`src/game/Villager.ts`, `src/game/Soldier.ts`, `src/game/skills.ts`, or a new class in `src/game/unitClasses.ts`), update this file in the same change. `src/game/unitsDoc.test.ts` checks the tables below against the code and fails if they drift.

## How the numbers work

- **Damage** of a regular hit = `STR − DEF` for physical units (`MAG − RES` for magical ones), never below 0. Both classes are physical.
- **Hit chance** = (80 + `SKL × 2` + `LCK / 2`) − (`SPD × 2` + `LCK` of the target), clamped to 0–100%. The flat 80 stands in for weapon hit until weapons exist.
- **Crit chance** = `SKL / 2` − target's `LCK`, clamped to 0–100%. A crit deals ×3 damage.
- **Doubling:** a unit strikes twice in an exchange when its `SPD` beats the opponent's by 4 or more.
- **Counters:** the defender strikes back if the attacker is within its range (`RNG`).
- **Growths** are the % chance a stat rises by 1 on each level up. A stat never grows past its cap. Max level is 20, 100 XP per level.
- **Skills** always hit, never crit, and the target can't counter. Their damage is the user's regular hit with any bonus `STR` added, then scaled; scaled damage rounds up. Using one costs mana and earns XP like a landed hit.

Halves round down unless noted otherwise. Full formulas live in `ARCHITECTURES.md` (`combat.ts`, `combatStats.ts`, `experience.ts`, `skills.ts`).

## Villager

The player's townsfolk in the demo battle. For now a villager has the same stat line, growths and caps as a soldier; its identity comes from its skill.

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
| RNG  | 1    | –      | –   |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 1          | 2    | 1–4   | Half the regular hit, rounded up |

Carries a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Soldier

The enemy infantry in the demo battle, and a choice in Training.

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
| RNG  | 1    | –      | –   |

| Skill        | Learned at | Mana | Range | Damage                      |
| ------------ | ---------- | ---- | ----- | --------------------------- |
| Power Strike | 1          | 2    | 1     | The regular hit with +3 STR |

Carries a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Matchups at level 1

Both classes share a stat line, so every level-1 pairing reads the same:

| Action         | Damage | Hit    | Crit  | Strikes                  |
| -------------- | ------ | ------ | ----- | ------------------------ |
| Regular attack | 2      | 79%    | 0%    | 1 each way (no doubling) |
| Throw Stones   | 1      | always | never | 1, no counter            |
| Power Strike   | 5      | always | never | 1, no counter            |
