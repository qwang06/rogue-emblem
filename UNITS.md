# UNITS.md

Reference for every unit class: base stats, growth rates, caps, weapons and skills. Keep it in step with the code: whenever a class's numbers, weapons or skills change (`src/game/Warrior.ts`, `src/game/Soldier.ts`, `src/game/Archer.ts`, `src/game/Vanguard.ts`, `src/game/Guard.ts`, `src/game/Acolyte.ts`, `src/game/promotions.ts`, `src/game/Slime.ts`, `src/game/Goblin.ts`, `src/game/Skeleton.ts`, `src/game/Bat.ts`, `src/game/Wolf.ts`, `src/game/Orc.ts`, `src/game/healing.ts`, `src/game/weapons.ts`, `src/game/skills.ts`, or a new class in `src/game/unitClasses.ts`), update this file in the same change. `src/game/unitsDoc.test.ts` checks the tables below against the code and fails if they drift.

## How the numbers work

- **Weapons:** every attack is made with the unit's equipped weapon — the first weapon in its inventory it can wield. A class masters weapon types (`physical`, `magical`, `siege`) and can only wield those. Picking a weapon in the Attack menu equips it. A unit with no weapon it can wield can't attack or counter.
- **Damage** of a regular hit = `STR + Mt − DEF` for physical and siege weapons (`MAG + Mt − RES` for magical ones), never below 0.
- **Attack speed** = `SPD − max(0, Wt − STR)`: a weapon heavier than the wielder's strength slows it down.
- **Hit chance** = (weapon `Hit` + `SKL × 2` + `LCK / 2`) − (attack speed `× 2` + `LCK` of the target), clamped to 0–100%.
- **Crit chance** = (weapon `Crit` + `SKL / 2`) − target's `LCK`, clamped to 0–100%. A crit deals ×3 damage.
- **Doubling:** a unit strikes twice in an exchange when its attack speed beats the opponent's by 4 or more.
- **Counters:** the defender strikes back if the attacker is within its weapon's range (`Rng`). Bows and siege engines can't strike adjacent foes.
- **Hands:** every weapon is one-handed (`1`) or two-handed (`2`); bows, the Great Axe, siege weapons and every staff take both hands. A unit wears a shield only while its equipped weapon is one-handed (bare hands count) and it carries no staff, so equipping a two-handed weapon takes its shield off until it equips a one-handed one again. Body armor is worn whatever the unit holds.
- **Healing:** a unit carrying a staff gets a **Heal** action. It restores the staff's power + the healer's `MAG` to a wounded ally in the staff's range, capped at the ally's missing HP, spends one use of the staff (a staff with none left breaks), and earns the healer 10 XP. Staves aren't weapons: they can't attack or counter.
- **Uses:** every strike, hit or miss, spends one use of the striker's weapon. A weapon with no uses left breaks and is gone, and a unit whose weapon breaks mid-exchange stops striking. Fists never break (`∞`).
- **Tomes:** a tome is a magical weapon that teaches its spell. Each strike with it counts towards learning the spell (Fire Tome: 5); on the strike that reaches the count the spell takes the tome's slot and never breaks, and the tome keeps its remaining uses in the next free slot (or goes to the convoy when there's none) so another unit can learn from it. A unit that already knows the spell just uses the tome up. Progress is kept per unit, per tome, between stages.
- **Growths** are the % chance a stat rises by 1 on each level up. A stat never grows past its cap. Max level is 20. Level 1 to 2 takes 50 XP, every level after 100 XP.
- **XP rate** scales every XP gain (combat, skills, healing): a unit with a 150% rate earns 15 XP where others earn 10, rounded to the nearest point and never below 1.
- **Skills** always hit, never crit, and the target can't counter. Their damage is the user's regular hit (weapon might included) with any bonus `STR` added, then scaled; scaled damage rounds up. Using one costs mana, earns XP like a landed hit, and spends no weapon uses. A healing skill (Mend) instead restores its power + the user's `MAG` to a wounded ally in range, capped at the ally's missing HP, and earns 10 XP like a staff heal.
- **Secondary skill sets** (Warband Mode): a unit can learn one other class's skill set at camp and knows that class's skills as it reaches their levels, as if they were its own. A mentor (a roster unit of that class that knows its skills) teaches it for 20 gold; a Mentor's Scroll, a stage reward, teaches any class's set for free. A new set replaces the old one.
- **Shove** (Soldier, Guard and their promotions, from level 1) deals no damage of its own: it pushes the adjacent foe one tile straight away from the user. Onto open ground it just slides; onto a spike trap it takes 5 damage; into deep water (not a ford) it drowns. If the map's edge, a wall, a mountain or another unit is in the way it stays put and takes 2 damage, and a unit it slams into takes 2 too. A boss holds its ground and can't be shoved. A unit knocked out by a shove is the shover's kill. Walking over a spike trap is safe.

Halves round down unless noted otherwise. Full formulas live in `ARCHITECTURES.md` (`combat.ts`, `combatStats.ts`, `weapons.ts`, `experience.ts`, `skills.ts`).

## Weapons

One starter weapon per armed unit in the unit catalog. Fists, the Wooden Sword, the Iron Spear, the Iron Bow and the Iron Axe are carried by a class; the monsters fight with Tackle, Club, Bone Claws, Fangs, Bite and Great Axe, which never break; the Powder Keg and Ballista wait for their classes (milestone 2.3); the rest of the wooden set is basic gear no class starts with; the Acolyte knows Light from the start; and the Fire Tome drops as loot for an Acolyte to learn Fire from.

| Weapon       | Type     | Hands | Mt  | Hit | Crit | Wt  | Rng | Uses | For (catalog art)               |
| ------------ | -------- | ----- | --- | --- | ---- | --- | --- | ---- | ------------------------------- |
| Fists        | physical | 1     | 0   | 80  | 0    | 0   | 1   | ∞    | Warrior (once its sword breaks) |
| Iron Spear   | physical | 1     | 1   | 80  | 0    | 3   | 1   | 40   | Soldier                         |
| Iron Axe     | physical | 1     | 3   | 65  | 0    | 5   | 1   | 40   | Vanguard (axe)                  |
| Iron Bow     | physical | 2     | 2   | 80  | 0    | 2   | 2   | 40   | Archer                          |
| Fire Tome    | magical  | 1     | 2   | 85  | 0    | 1   | 1–2 | 30   | Elemental, Vanguard (staff)     |
| Fire         | magical  | 1     | 2   | 85  | 0    | 1   | 1–2 | ∞    | Learned from the Fire Tome      |
| Light        | magical  | 1     | 0   | 90  | 0    | 0   | 1–2 | ∞    | Acolyte (known from the start)  |
| Powder Keg   | siege    | 2     | 5   | 70  | 0    | 6   | 1–2 | 5    | Sapper                          |
| Ballista     | siege    | 2     | 6   | 70  | 0    | 8   | 2–3 | 10   | Siege                           |
| Tackle       | physical | 1     | 0   | 75  | 0    | 0   | 1   | ∞    | Slime                           |
| Club         | physical | 1     | 2   | 75  | 0    | 2   | 1   | ∞    | Goblin                          |
| Bone Claws   | physical | 1     | 2   | 80  | 0    | 1   | 1   | ∞    | Skeleton                        |
| Fangs        | physical | 1     | 1   | 85  | 0    | 0   | 1   | ∞    | Bat                             |
| Bite         | physical | 1     | 2   | 75  | 5    | 1   | 1   | ∞    | Wolf                            |
| Great Axe    | physical | 2     | 3   | 65  | 0    | 4   | 1   | ∞    | Orc                             |
| Wooden Sword | physical | 1     | 1   | 90  | 0    | 1   | 1   | 20   | Warrior                         |
| Wooden Spear | physical | 1     | 1   | 75  | 0    | 2   | 1   | 20   | –                               |
| Wooden Axe   | physical | 1     | 2   | 60  | 0    | 3   | 1   | 20   | –                               |

The wooden set is the basic gear: lighter and weaker than iron, and it breaks after 20 strikes. Only the warrior starts with a piece of it, the sword. It comes with two pieces of armor. A unit wears the first shield and the first body armor it carries (equip another on the camp's roster screen; a shield only with a hand free for it, see Hands above), and each adds its DEF against physical hits. Its weight adds to the weapon's: a unit loses SPD (for avoid and doubling) by however much weapon and armor weight together exceed its STR:

| Armor         | Slot   | DEF | Wt  |
| ------------- | ------ | --- | --- |
| Wooden Shield | shield | 1   | 1   |
| Wooden Armor  | body   | 1   | 2   |

## Warrior

The common fighter in a plain tunic and no armor: the player's units in the demo battle, and the late bloomer of Warband Mode's starting classes. A warrior starts a point of strength below a soldier and swings only a wooden sword, so it's the weakest pick early on. In exchange it has the highest growth total and the highest caps of any class and earns XP half again as fast, so a warrior that survives the early stages outgrows everyone else.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 10   | 85%    | 50  |
| MP   | 5    | 45%    | 35  |
| STR  | 3    | 60%    | 25  |
| MAG  | 0    | 10%    | 20  |
| SKL  | 3    | 55%    | 25  |
| SPD  | 3    | 55%    | 25  |
| LCK  | 2    | 50%    | 25  |
| DEF  | 2    | 45%    | 25  |
| RES  | 0    | 25%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Wooden Sword    | 150%    |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up |

Carries a Wooden Sword, its Fists for when the sword breaks, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

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

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Spear      | 100%    |

| Skill        | Learned at | Mana | Range | Damage                      |
| ------------ | ---------- | ---- | ----- | --------------------------- |
| Shove        | 1          | 1    | 1     | None; pushes the foe a tile |
| Power Strike | 2          | 2    | 1     | The regular hit with +3 STR |

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

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Bow        | 100%    |

| Skill     | Learned at | Mana | Range | Damage          |
| --------- | ---------- | ---- | ----- | --------------- |
| Long Shot | 2          | 2    | 1–3   | The regular hit |

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

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Axe        | 100%    |

| Skill  | Learned at | Mana | Range | Damage                      |
| ------ | ---------- | ---- | ----- | --------------------------- |
| Cleave | 2          | 2    | 1     | The regular hit with +2 STR |

Carries an Iron Axe, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

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

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Spear      | 100%    |

| Skill       | Learned at | Mana | Range | Damage                      |
| ----------- | ---------- | ---- | ----- | --------------------------- |
| Shove       | 1          | 1    | 1     | None; pushes the foe a tile |
| Shield Bash | 2          | 2    | 1     | The regular hit with +1 STR |

Carries an Iron Spear, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Acolyte

The healer and the warband's magic user: it mends a wounded ally next to it with its Heal staff, and fights with Light, a weak spell it knows from the start that strikes from one or two tiles away and never runs out. At level 1 a heal restores 5 HP (the staff's 2 power + 3 MAG) and Light hits a soldier for 3. A tome it finds (see Tomes above) teaches it a stronger spell. Frail, but its RES and LCK make it hard to hurt with magic or crit.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 8    | 50%    | 40  |
| MP   | 6    | 50%    | 30  |
| STR  | 1    | 10%    | 20  |
| MAG  | 3    | 50%    | 20  |
| SKL  | 2    | 30%    | 20  |
| SPD  | 3    | 40%    | 20  |
| LCK  | 4    | 50%    | 20  |
| DEF  | 1    | 15%    | 20  |
| RES  | 4    | 45%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Light           | 100%    |

| Staff | Power | Rng | Uses | Heals at level 1 |
| ----- | ----- | --- | ---- | ---------------- |
| Heal  | 2     | 1   | 20   | 5 HP             |

| Skill | Learned at | Mana | Range | Damage                        |
| ----- | ---------- | ---- | ----- | ----------------------------- |
| Mend  | 2          | 3    | 1     | None: heals an ally 2 + `MAG` |

Mend heals like the Heal staff without needing one, so another class that learns the Acolyte's skill set can heal too. Knows Light, and carries a Heal staff, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Promotions

In Warband Mode a unit that has reached **level 5** can promote at camp by spending a **Master Seal** (60 gold from the merchant, or a stage reward offered once someone is a level short of promoting and the warband holds none). Each base class has two promotions to choose from, defined in `src/game/promotions.ts`. A promotion:

- adds a few points to the stats on the spot, each up to the new cap (a max HP or MP gain raises the current value too);
- raises every cap by 5 (HP by 10) and shifts the growths;
- keeps the base class's skill tree and adds a skill of its own, known at once;
- carries a passive into every battle;
- for four of them, masters a second weapon type and hands over a weapon of it.

Level, XP, items, boons and tome progress carry over, so a promotion is a step up rather than a fresh start. Promoted classes are never recruits, starting picks or Training choices.

| Base class | Promotes to          | Second weapon type, gift      |
| ---------- | -------------------- | ----------------------------- |
| Warrior    | Hero, Berserker      | –                             |
| Soldier    | General, Halberdier  | –                             |
| Archer     | Sniper, Arbalest     | Arbalest: siege, Ballista     |
| Vanguard   | Champion, Bombardier | Bombardier: siege, Powder Keg |
| Guard      | Bastion, Templar     | Templar: magical, Light       |
| Acolyte    | Bishop, Sage         | Sage: a Fire Tome             |

## Hero

Promoted from the Warrior. The all-rounder the warrior was growing into: quick, sure-handed and hard to stop. Promoting adds +4 HP, +2 STR, +2 SKL, +2 SPD, +1 DEF, +1 RES (each up to the new cap). The Base column is a fresh level-1 Hero: the Warrior's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 14   | 85%    | 60  |
| MP   | 5    | 45%    | 40  |
| STR  | 5    | 60%    | 30  |
| MAG  | 0    | 10%    | 25  |
| SKL  | 5    | 60%    | 30  |
| SPD  | 5    | 60%    | 30  |
| LCK  | 2    | 50%    | 30  |
| DEF  | 3    | 45%    | 30  |
| RES  | 1    | 25%    | 30  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Wooden Sword    | 150%    |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up |
| Sunder       | 1          | 3    | 1     | The regular hit with +4 power    |

Passive, **Hero's Poise**: +10 crit.

## Berserker

Promoted from the Warrior. Trades guard for raw strength, and hits hardest when bleeding. Promoting adds +6 HP, +3 STR, +1 SKL, +1 SPD (each up to the new cap). The Base column is a fresh level-1 Berserker: the Warrior's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 16   | 90%    | 60  |
| MP   | 5    | 45%    | 40  |
| STR  | 6    | 70%    | 30  |
| MAG  | 0    | 10%    | 25  |
| SKL  | 4    | 55%    | 30  |
| SPD  | 4    | 55%    | 30  |
| LCK  | 2    | 50%    | 30  |
| DEF  | 2    | 35%    | 30  |
| RES  | 0    | 25%    | 30  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Wooden Sword    | 150%    |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up |
| Frenzy       | 1          | 4    | 1     | The regular hit with +6 power    |

Passive, **Bloodrage**: +3 damage while under half HP.

## General

Promoted from the Soldier. Heavy armor over the spear: holds the line and shrugs off blows. Promoting adds +5 HP, +2 STR, +4 DEF, +2 RES (each up to the new cap). The Base column is a fresh level-1 General: the Soldier's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 15   | 70%    | 50  |
| MP   | 5    | 40%    | 35  |
| STR  | 6    | 45%    | 25  |
| MAG  | 0    | 5%     | 25  |
| SKL  | 3    | 40%    | 25  |
| SPD  | 3    | 30%    | 25  |
| LCK  | 2    | 30%    | 25  |
| DEF  | 6    | 45%    | 25  |
| RES  | 2    | 15%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Spear      | 100%    |

| Skill        | Learned at | Mana | Range | Damage                        |
| ------------ | ---------- | ---- | ----- | ----------------------------- |
| Shove        | 1          | 1    | 1     | None; pushes the foe a tile   |
| Power Strike | 2          | 2    | 1     | The regular hit with +3 power |
| Impale       | 1          | 3    | 1     | The regular hit with +5 power |

Passive, **Iron Wall**: Takes 2 less damage when attacked.

## Halberdier

Promoted from the Soldier. A long polearm and a sure aim: strikes from two tiles off with Lunge. Promoting adds +3 HP, +2 STR, +3 SKL, +2 SPD (each up to the new cap). The Base column is a fresh level-1 Halberdier: the Soldier's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 13   | 70%    | 50  |
| MP   | 5    | 40%    | 35  |
| STR  | 6    | 45%    | 25  |
| MAG  | 0    | 5%     | 25  |
| SKL  | 6    | 50%    | 25  |
| SPD  | 5    | 50%    | 25  |
| LCK  | 2    | 30%    | 25  |
| DEF  | 2    | 30%    | 25  |
| RES  | 0    | 15%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Spear      | 100%    |

| Skill        | Learned at | Mana | Range | Damage                        |
| ------------ | ---------- | ---- | ----- | ----------------------------- |
| Shove        | 1          | 1    | 1     | None; pushes the foe a tile   |
| Power Strike | 2          | 2    | 1     | The regular hit with +3 power |
| Lunge        | 1          | 3    | 1–2   | The regular hit with +2 power |

Passive, **Reach**: +15 hit.

## Sniper

Promoted from the Archer. A master of the bow, deadly from four tiles away. Promoting adds +3 HP, +2 STR, +3 SKL, +1 SPD, +1 LCK (each up to the new cap). The Base column is a fresh level-1 Sniper: the Archer's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 12   | 60%    | 50  |
| MP   | 5    | 40%    | 35  |
| STR  | 5    | 45%    | 25  |
| MAG  | 0    | 5%     | 25  |
| SKL  | 8    | 65%    | 25  |
| SPD  | 5    | 45%    | 25  |
| LCK  | 3    | 35%    | 25  |
| DEF  | 1    | 20%    | 25  |
| RES  | 1    | 20%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Bow        | 100%    |

| Skill         | Learned at | Mana | Range | Damage                        |
| ------------- | ---------- | ---- | ----- | ----------------------------- |
| Long Shot     | 2          | 2    | 1–3   | The regular hit               |
| Piercing Shot | 1          | 3    | 1–4   | The regular hit with +2 power |

Passive, **Deadeye**: +10 crit.

## Arbalest

Promoted from the Archer. Crews a ballista: slow, but masters siege weapons and gets one on promotion. Promoting adds +5 HP, +3 STR, +2 DEF, −1 MOV (each up to the new cap). The Base column is a fresh level-1 Arbalest: the Archer's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 14   | 60%    | 50  |
| MP   | 5    | 40%    | 35  |
| STR  | 6    | 50%    | 25  |
| MAG  | 0    | 5%     | 25  |
| SKL  | 5    | 55%    | 25  |
| SPD  | 4    | 35%    | 25  |
| LCK  | 2    | 35%    | 25  |
| DEF  | 3    | 30%    | 25  |
| RES  | 1    | 20%    | 25  |
| MOV  | 4    | –      | –   |

| Weapon types    | Starting weapon | XP rate |
| --------------- | --------------- | ------- |
| physical, siege | Iron Bow        | 100%    |

| Skill     | Learned at | Mana | Range | Damage                        |
| --------- | ---------- | ---- | ----- | ----------------------------- |
| Long Shot | 2          | 2    | 1–3   | The regular hit               |
| Bombard   | 1          | 3    | 1–3   | The regular hit with +3 power |

Passive, **Braced**: +2 damage when it attacks. Gets a Ballista on promotion (in its inventory, or the convoy when it's full).

## Champion

Promoted from the Vanguard. The axe in sure hands at last: faster and far more accurate. Promoting adds +4 HP, +2 STR, +2 SKL, +2 SPD, +1 DEF (each up to the new cap). The Base column is a fresh level-1 Champion: the Vanguard's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 16   | 85%    | 50  |
| MP   | 5    | 30%    | 35  |
| STR  | 7    | 55%    | 25  |
| MAG  | 0    | 0%     | 25  |
| SKL  | 4    | 40%    | 25  |
| SPD  | 4    | 40%    | 25  |
| LCK  | 1    | 25%    | 25  |
| DEF  | 3    | 30%    | 25  |
| RES  | 0    | 10%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Axe        | 100%    |

| Skill         | Learned at | Mana | Range | Damage                        |
| ------------- | ---------- | ---- | ----- | ----------------------------- |
| Cleave        | 2          | 2    | 1     | The regular hit with +2 power |
| Crushing Blow | 1          | 3    | 1     | The regular hit with +5 power |

Passive, **Onslaught**: +2 damage when it attacks.

## Bombardier

Promoted from the Vanguard. Masters siege weapons and gets a powder keg on promotion. Promoting adds +3 HP, +2 STR, +2 SKL, +1 DEF (each up to the new cap). The Base column is a fresh level-1 Bombardier: the Vanguard's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 15   | 85%    | 50  |
| MP   | 5    | 30%    | 35  |
| STR  | 7    | 55%    | 25  |
| MAG  | 0    | 0%     | 25  |
| SKL  | 4    | 40%    | 25  |
| SPD  | 2    | 30%    | 25  |
| LCK  | 1    | 25%    | 25  |
| DEF  | 3    | 30%    | 25  |
| RES  | 0    | 10%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types    | Starting weapon | XP rate |
| --------------- | --------------- | ------- |
| physical, siege | Iron Axe        | 100%    |

| Skill  | Learned at | Mana | Range | Damage                        |
| ------ | ---------- | ---- | ----- | ----------------------------- |
| Cleave | 2          | 2    | 1     | The regular hit with +2 power |
| Blast  | 1          | 3    | 1–2   | The regular hit with +3 power |

Passive, **Steady Fuse**: +10 hit. Gets a Powder Keg on promotion (in its inventory, or the convoy when it's full).

## Bastion

Promoted from the Guard. A living wall: harder to hurt with weapons or magic. Promoting adds +5 HP, +1 STR, +3 DEF, +3 RES (each up to the new cap). The Base column is a fresh level-1 Bastion: the Guard's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 17   | 75%    | 50  |
| MP   | 5    | 25%    | 35  |
| STR  | 5    | 45%    | 25  |
| MAG  | 0    | 0%     | 25  |
| SKL  | 3    | 35%    | 25  |
| SPD  | 1    | 20%    | 25  |
| LCK  | 1    | 25%    | 25  |
| DEF  | 8    | 60%    | 25  |
| RES  | 3    | 25%    | 25  |
| MOV  | 4    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Spear      | 100%    |

| Skill        | Learned at | Mana | Range | Damage                        |
| ------------ | ---------- | ---- | ----- | ----------------------------- |
| Shove        | 1          | 1    | 1     | None; pushes the foe a tile   |
| Shield Bash  | 2          | 2    | 1     | The regular hit with +1 power |
| Bulwark Bash | 1          | 3    | 1     | The regular hit with +3 power |

Passive, **Bulwark**: Takes 2 less damage from every hit.

## Templar

Promoted from the Guard. Spear and spell: learns magic and gets Light on promotion. Promoting adds +3 HP, +3 MAG, +1 SPD, +4 RES (each up to the new cap). The Base column is a fresh level-1 Templar: the Guard's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 15   | 75%    | 50  |
| MP   | 5    | 25%    | 35  |
| STR  | 4    | 45%    | 25  |
| MAG  | 3    | 35%    | 25  |
| SKL  | 3    | 35%    | 25  |
| SPD  | 2    | 20%    | 25  |
| LCK  | 1    | 25%    | 25  |
| DEF  | 5    | 50%    | 25  |
| RES  | 4    | 30%    | 25  |
| MOV  | 4    | –      | –   |

| Weapon types      | Starting weapon | XP rate |
| ----------------- | --------------- | ------- |
| physical, magical | Iron Spear      | 100%    |

| Skill       | Learned at | Mana | Range | Damage                        |
| ----------- | ---------- | ---- | ----- | ----------------------------- |
| Shove       | 1          | 1    | 1     | None; pushes the foe a tile   |
| Shield Bash | 2          | 2    | 1     | The regular hit with +1 power |
| Holy Strike | 1          | 3    | 1     | The regular hit with +3 power |

Passive, **Devotion**: Recovers 1 HP at the start of each of your phases. Gets a Light on promotion (in its inventory, or the convoy when it's full).

## Bishop

Promoted from the Acolyte. A seasoned healer whose mana never runs dry. Promoting adds +3 HP, +3 MP, +2 MAG, +3 RES (each up to the new cap). The Base column is a fresh level-1 Bishop: the Acolyte's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 11   | 60%    | 50  |
| MP   | 9    | 50%    | 35  |
| STR  | 1    | 10%    | 25  |
| MAG  | 5    | 55%    | 25  |
| SKL  | 2    | 30%    | 25  |
| SPD  | 3    | 40%    | 25  |
| LCK  | 4    | 50%    | 25  |
| DEF  | 1    | 15%    | 25  |
| RES  | 7    | 50%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Light           | 100%    |

| Skill | Learned at | Mana | Range | Damage                        |
| ----- | ---------- | ---- | ----- | ----------------------------- |
| Mend  | 2          | 3    | 1     | None: heals an ally 2 + `MAG` |
| Smite | 1          | 3    | 1–2   | The regular hit with +3 power |

Passive, **Wellspring**: Recovers 1 MP at the start of each of your phases.

## Sage

Promoted from the Acolyte. Turns to battle magic and gets a Fire Tome on promotion. Promoting adds +2 HP, +3 MAG, +2 SKL, +2 SPD (each up to the new cap). The Base column is a fresh level-1 Sage: the Acolyte's base stats plus those bonuses.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 10   | 50%    | 50  |
| MP   | 6    | 50%    | 35  |
| STR  | 1    | 10%    | 25  |
| MAG  | 6    | 60%    | 25  |
| SKL  | 4    | 40%    | 25  |
| SPD  | 5    | 45%    | 25  |
| LCK  | 4    | 50%    | 25  |
| DEF  | 1    | 15%    | 25  |
| RES  | 4    | 45%    | 25  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Light           | 100%    |

| Skill | Learned at | Mana | Range | Damage                        |
| ----- | ---------- | ---- | ----- | ----------------------------- |
| Mend  | 2          | 3    | 1     | None: heals an ally 2 + `MAG` |
| Flare | 1          | 3    | 1–2   | The regular hit with +4 power |

Passive, **Arcane Focus**: +10 hit. Gets a Fire Tome on promotion (in its inventory, or the convoy when it's full).

## Slime

The weakest monster and Warband Mode's first fight: a slow blob of jelly that deals 1 damage to a level-1 warrior and falls to two sword swings. It carries nothing but its Tackle.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 6    | 60%    | 40  |
| MP   | 0    | 0%     | 0   |
| STR  | 3    | 30%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 1    | 20%    | 20  |
| SPD  | 1    | 20%    | 20  |
| LCK  | 0    | 10%    | 20  |
| DEF  | 0    | 20%    | 20  |
| RES  | 2    | 30%    | 20  |
| MOV  | 3    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Tackle          | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Goblin

A quick, scrappy monster: as fast as anything at level 1 and hits about as hard as a soldier, but frail. It carries nothing but its Club.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 8    | 60%    | 40  |
| MP   | 0    | 0%     | 0   |
| STR  | 3    | 40%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 4    | 45%    | 20  |
| SPD  | 5    | 50%    | 20  |
| LCK  | 1    | 25%    | 20  |
| DEF  | 1    | 20%    | 20  |
| RES  | 0    | 10%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Club            | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Skeleton

The sturdy monster: slow and unlucky, but its bones shrug off weak hits and its claws hit harder than a spear. It carries nothing but its Bone Claws.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 10   | 70%    | 40  |
| MP   | 0    | 0%     | 0   |
| STR  | 4    | 45%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 3    | 35%    | 20  |
| SPD  | 2    | 25%    | 20  |
| LCK  | 0    | 5%     | 20  |
| DEF  | 3    | 40%    | 20  |
| RES  | 0    | 10%    | 20  |
| MOV  | 4    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Bone Claws      | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Bat

The nimblest monster: hard to hit and quick enough to strike twice, but frail and weak. It carries nothing but its Fangs.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 7    | 50%    | 40  |
| MP   | 0    | 0%     | 0   |
| STR  | 2    | 30%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 3    | 40%    | 20  |
| SPD  | 6    | 55%    | 20  |
| LCK  | 3    | 35%    | 20  |
| DEF  | 0    | 10%    | 20  |
| RES  | 1    | 20%    | 20  |
| MOV  | 5    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Fangs           | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Wolf

A fast hunter: it covers the most ground of any monster and bites hard, but its hide stops little. Its Bite is the one natural weapon that can crit. It carries nothing else.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 9    | 60%    | 40  |
| MP   | 0    | 0%     | 0   |
| STR  | 4    | 45%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 4    | 40%    | 20  |
| SPD  | 5    | 50%    | 20  |
| LCK  | 2    | 25%    | 20  |
| DEF  | 1    | 20%    | 20  |
| RES  | 0    | 10%    | 20  |
| MOV  | 6    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Bite            | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Orc

The heavy monster: slow, but tough enough to take several hits, and it hits harder than any other monster with its Great Axe, which never breaks. It carries nothing else.

| Stat | Base | Growth | Cap |
| ---- | ---- | ------ | --- |
| HP   | 14   | 80%    | 40  |
| MP   | 0    | 0%     | 0   |
| STR  | 5    | 55%    | 20  |
| MAG  | 0    | 0%     | 20  |
| SKL  | 2    | 30%    | 20  |
| SPD  | 2    | 20%    | 20  |
| LCK  | 1    | 15%    | 20  |
| DEF  | 2    | 35%    | 20  |
| RES  | 0    | 10%    | 20  |
| MOV  | 4    | –      | –   |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Great Axe       | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Matchups at level 1

Warrior and Soldier differ by a point of strength and their weapons: the wooden sword has the spear's might but lands more often. Each attack is from as close as the attacker's weapon reaches (2 tiles for the bow).

| Attacker | Target  | Weapon       | Damage | Hit | Crit | Strikes |
| -------- | ------- | ------------ | ------ | --- | ---- | ------- |
| Warrior  | Soldier | Wooden Sword | 2      | 89% | 0%   | 1       |
| Soldier  | Warrior | Iron Spear   | 3      | 79% | 0%   | 1       |
| Archer   | Soldier | Iron Bow     | 3      | 83% | 0%   | 1       |
| Vanguard | Soldier | Iron Axe     | 6      | 61% | 0%   | 1       |
| Guard    | Soldier | Iron Spear   | 3      | 78% | 0%   | 1       |
| Soldier  | Guard   | Iron Spear   | 0      | 84% | 0%   | 1       |
| Acolyte  | Soldier | Light        | 3      | 88% | 0%   | 1       |

Every class learns its skill at level 2, its first level up (the Soldier's and Guard's Shove, which deals no damage, is known from level 1); the skill rows use level-1 stats.

| Skill        | User     | Target  | Damage | Hit    | Crit  | Strikes       |
| ------------ | -------- | ------- | ------ | ------ | ----- | ------------- |
| Throw Stones | Warrior  | Soldier | 1      | always | never | 1, no counter |
| Power Strike | Soldier  | Warrior | 6      | always | never | 1, no counter |
| Long Shot    | Archer   | Soldier | 3      | always | never | 1, no counter |
| Cleave       | Vanguard | Soldier | 8      | always | never | 1, no counter |
| Shield Bash  | Guard    | Soldier | 4      | always | never | 1, no counter |
