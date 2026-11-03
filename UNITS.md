# UNITS.md

Reference for every unit class: base stats, growth rates, weapons and skills. Keep it in step with the code: whenever a class's numbers, weapons or skills change (`src/game/Villager.ts`, `src/game/Archer.ts`, `src/game/Soldier.ts`, `src/game/Vanguard.ts`, `src/game/Sapper.ts`, `src/game/Scout.ts`, `src/game/Beast.ts`, `src/game/BeastRider.ts`, `src/game/Siege.ts`, `src/game/Ram.ts`, `src/game/Acolyte.ts`, `src/game/Mage.ts`, `src/game/Bishop.ts`, `src/game/Elemental.ts`, `src/game/promotions.ts`, `src/game/Slime.ts`, `src/game/Goblin.ts`, `src/game/Skeleton.ts`, `src/game/Bat.ts`, `src/game/Orc.ts`, `src/game/Minotaur.ts`, `src/game/Troll.ts`, `src/game/Dragon.ts`, `src/game/healing.ts`, `src/game/weapons.ts`, `src/game/skills.ts`, or a new class in `src/game/unitClasses.ts`), update this file in the same change. `src/game/unitsDoc.test.ts` checks the tables below against the code and fails if they drift.

## How the numbers work

- **Weapons:** every attack is made with the unit's equipped weapon — the first weapon in its inventory it can wield. A class masters weapon types (`physical`, `magical`, `siege`) and can only wield those. Picking a weapon in the Attack menu equips it. A unit with no weapon it can wield can't attack or counter.
- **Damage** of a regular hit = `STR + Pow − DEF` for physical and siege weapons (`INT + Pow − RES` for magical ones), never below 0.
- **Attack speed** = `SPD − max(0, Wt − STR)`: a weapon heavier than the wielder's strength slows it down.
- **Hit chance** = (weapon `Hit` + `SKL × 2` + `LCK / 2`) − (attack speed `× 2` + `LCK` of the target), clamped to 0–100%.
- **Crit chance** = (weapon `Crit` + `SKL / 2`) − target's `LCK`, clamped to 0–100%. A crit deals ×3 damage.
- **Doubling:** a unit strikes twice in an exchange when its attack speed beats the opponent's by 4 or more.
- **Counters:** the defender strikes back if the attacker is within its weapon's range (`Rng`). Bows and siege engines can't strike adjacent foes.
- **Hands:** every weapon is one-handed (`1`) or two-handed (`2`); bows, the Great Axe, siege weapons and every staff take both hands. A unit wears a shield only while its equipped weapon is one-handed (bare hands count) and it carries no staff, so equipping a two-handed weapon takes its shield off until it equips a one-handed one again. Body armor is worn whatever the unit holds.
- **Healing:** a unit carrying a staff gets a **Heal** action. It restores the staff's power + the healer's `INT` to a wounded ally in the staff's range, capped at the ally's missing HP, spends one use of the staff (a staff with none left breaks), and earns the healer 10 XP. Staves aren't weapons: they can't attack or counter.
- **Uses:** every strike, hit or miss, spends one use of the striker's weapon. A weapon with no uses left breaks and is gone, and a unit whose weapon breaks mid-exchange stops striking. Fists never break (`∞`).
- **Tomes:** a tome is a magical weapon that teaches its spell. Each strike with it counts towards learning the spell (Fire Tome: 5); on the strike that reaches the count the spell takes the tome's slot and never breaks, and the tome keeps its remaining uses in the next free slot (or goes to the convoy when there's none) so another unit can learn from it. A unit that already knows the spell just uses the tome up. Progress is kept per unit, per tome, between stages.
- **Growths** are fixed, with no dice: a growth of 100% raises the stat by 1 every level, 50% every second level, 25% every fourth. Each level hands out the points the class's growths have earned by then, staggered so every level gives about the same number and each stat stays within a point of its share (`getLevelUpGains` in `experience.ts`); two units of the same class and level have the same stats, boons aside. Stats have no caps and there is no level cap. Level 1 to 2 takes 50 XP, every level after 100 XP.
- **XP rate** scales every XP gain (combat, skills, healing): a unit with a 150% rate earns 15 XP where others earn 10, rounded to the nearest point and never below 1.
- **Skills** always hit, never crit, and the target can't counter. Their damage is the user's regular hit (weapon power included) with any bonus `STR` added, then scaled; scaled damage rounds up. Using one costs mana, earns XP like a landed hit, and spends no weapon uses. A healing skill (Mend) instead restores its power + the user's `INT` to a wounded ally in range, capped at the ally's missing HP, and earns 10 XP like a staff heal.
- **Area skills** reach past the foe they're aimed at: the tiles on either side of it (Cleave), the tile behind it as seen from the user (Piercing Shot, Skewer), or the four tiles around it (Shrapnel, Barrage, and Prayer around the user itself). Each foe there takes the skill's damage too, worked out against it, and the user earns XP for whichever foe gives the most. Shrapnel strikes allies in its blast as well. **Tandem Strike** strikes its target twice, the second blow for half the first's damage, rounded up.
- **Statuses** a skill leaves on a foe last until the end of that foe's team's next phase: **Rooted** can't move, **Sundered** takes 3 more damage from every hit, **Marked** has 15 less avoid. A status doesn't stack with itself. **Buffs** a skill gives an ally last until the start of that ally's next phase, so one given in the player phase holds through the enemy phase: **Guarded** takes 2 less damage from every hit, **Warded** 4 less, **Hastened** moves 2 more tiles.
- **Learning skills:** a class learns its tree's skills (the tables below) by level. A promoted villager keeps the villager's Throw Stones. On top of that, a level up in Warband Mode can offer a skill pick (a skill boon), and only from the unit's own class: the "Level-up skill pick" lines below. A class without one is offered a second passive instead.
- **Secondary skill sets** (Warband Mode, switched off for now with the Mentors menu): a unit can learn one other class's skill set at camp and knows that class's skills as it reaches their levels, as if they were its own. A mentor (a roster unit of that class that knows its skills) teaches it for 20 gold; a Mentor's Scroll, a stage reward, teaches any class's set for free. A new set replaces the old one.
- **Shove** (Soldier, from level 1) deals no damage of its own: it pushes the adjacent foe one tile straight away from the user. Onto open ground it just slides; onto a spike trap it takes 5 damage; into deep water (not a ford) it drowns. If the map's edge, a wall, a mountain or another unit is in the way it stays put and takes 2 damage, and a unit it slams into takes 2 too. A boss holds its ground and can't be shoved. A unit knocked out by a shove is the shover's kill. Walking over a spike trap is safe.

Halves round down unless noted otherwise. Full formulas live in `ARCHITECTURES.md` (`combat.ts`, `combatStats.ts`, `weapons.ts`, `experience.ts`, `skills.ts`).

- **Factions:** every unit but the elementals and the monsters belongs to one of six factions (`src/game/factions.ts`), which for now only picks which version of its class's art it wears. The player's warband is the Sunward Kingdom; enemies are their region's faction (`faction` in `src/data/regions.json`), or the Crimson Legion when it sets none.

## Weapons

One starter weapon per armed unit in the unit catalog. Fists, the Wooden Sword, the Wooden Spear, the Iron Spear, the Iron Bow, the Iron Axe, the Powder Keg and the Ballista are carried by a class; the monsters, the Beast, the Ram and the elementals fight with natural weapons (Tackle, Club, Bone Claws, Fangs, Bite, Great Axe, Stone Maul, Fire Breath, Fire, Light), which never break; the rest of the wooden set is basic gear no class starts with; the Acolyte and the Bishop know Light from the start; the Mage knows Fire; and the Fire Tome drops as loot for an Acolyte to learn Fire from (and is the Mage's promotion gift).

| Weapon       | Type     | Hands | Pow | Hit | Crit | Wt  | Rng | For (catalog art)                                                |
| ------------ | -------- | ----- | --- | --- | ---- | --- | --- | ---------------------------------------------------------------- |
| Fists        | physical | 1     | 0   | 80  | 0    | 0   | 1   | Villager (once its sword breaks)                                 |
| Iron Spear   | physical | 1     | 1   | 80  | 0    | 3   | 1   | Soldier, Beast Rider                                             |
| Iron Axe     | physical | 1     | 3   | 65  | 0    | 5   | 1   | Vanguard (axe)                                                   |
| Iron Bow     | physical | 2     | 2   | 80  | 0    | 2   | 2   | Archer                                                           |
| Fire Tome    | magical  | 1     | 2   | 85  | 0    | 1   | 1–2 | Loot (teaches Fire)                                              |
| Fire         | magical  | 1     | 2   | 85  | 0    | 1   | 1–2 | Mage; learned from the Fire Tome; Fire Elemental                 |
| Light        | magical  | 1     | 0   | 90  | 0    | 0   | 1–2 | Acolyte, Bishop (known from the start), Water and Air Elementals |
| Powder Keg   | siege    | 2     | 5   | 70  | 0    | 6   | 1–2 | Sapper                                                           |
| Ballista     | siege    | 2     | 6   | 70  | 0    | 8   | 2–3 | Siege                                                            |
| Tackle       | physical | 1     | 0   | 75  | 0    | 0   | 1   | Slime, Ram, Earth Elemental                                      |
| Club         | physical | 1     | 2   | 75  | 0    | 2   | 1   | Goblin                                                           |
| Bone Claws   | physical | 1     | 2   | 80  | 0    | 1   | 1   | Skeleton                                                         |
| Fangs        | physical | 1     | 1   | 85  | 0    | 0   | 1   | Bat                                                              |
| Bite         | physical | 1     | 2   | 75  | 5    | 1   | 1   | Beast, Whelp                                                     |
| Great Axe    | physical | 2     | 3   | 65  | 0    | 4   | 1   | Orc, Minotaur                                                    |
| Stone Maul   | physical | 2     | 4   | 60  | 0    | 5   | 1   | Troll                                                            |
| Fire Breath  | physical | 1     | 4   | 75  | 0    | 0   | 1–2 | Dragon                                                           |
| Wooden Sword | physical | 1     | 1   | 90  | 0    | 1   | 1   | Villager                                                         |
| Wooden Spear | physical | 1     | 1   | 75  | 0    | 2   | 1   | Scout                                                            |
| Wooden Axe   | physical | 1     | 2   | 60  | 0    | 3   | 1   | –                                                                |

The wooden set is the basic gear: lighter and weaker than iron, and it breaks after 20 strikes. The villager starts with the sword and the scout with the spear. It comes with two pieces of armor. A unit wears the first shield and the first body armor it carries (equip another on the camp's roster screen; a shield only with a hand free for it, see Hands above), and each adds its DEF against physical hits. Its weight adds to the weapon's: a unit loses SPD (for avoid and doubling) by however much weapon and armor weight together exceed its STR:

| Armor         | Slot   | DEF | Wt  |
| ------------- | ------ | --- | --- |
| Wooden Shield | shield | 1   | 1   |
| Wooden Armor  | body   | 1   | 2   |

## Villager

The starting unit, a townsperson in a plain tunic with no armor: Warband Mode's only starting class, the player's units in the demo battle, and a recruit. A villager starts a point of strength below a soldier and swings only a wooden sword, so it's the weakest unit early on. In exchange it has the highest growth total of any class and earns XP half again as fast, and at level 5 it promotes into an Archer, Soldier, Vanguard or Sapper (see Promotions below).

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 10   | 100%   |
| MP   | 5    | 50%    |
| STR  | 3    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 3    | 50%    |
| SPD  | 3    | 50%    |
| LCK  | 2    | 50%    |
| DEF  | 2    | 50%    |
| RES  | 0    | 25%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Wooden Sword    | 150%    |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up |

Level-up skill pick: **Lend a Hand** (1 MP, range 1: trades places with an ally). Promoted classes keep the villager's Throw Stones but are offered only their own class's picks.

Carries a Wooden Sword, its Fists for when the sword breaks, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Promotions

In Warband Mode a villager or an acolyte that has reached **level 5** can promote at camp by spending a **Master Seal** (60 gold from the merchant, or a stage reward offered once someone is a level short of promoting and the warband holds none). A villager picks one of four tier-2 classes; an acolyte picks one of two tier-3 classes, the Mage or the Bishop, also with a Master Seal; they're defined in `src/game/promotions.ts`. A promotion:

- makes the unit that class: its growths, weapon types, XP rate and skill tree;
- adds whatever stats the class starts above the class it promotes from, on the spot, in full (a max HP or MP gain raises the current value too), and changes MOV by the difference;
- carries the class's passive into every battle;
- hands over the class's weapon, if it has one (in its inventory, or the convoy when it's full).

Level, XP, items, boons and tome progress carry over. The promoted classes are never recruits, starting picks or Training choices; the other specialized units (Scout, Beast, Beast Rider, Siege, Ram) don't promote.

| Base class | Promotes to                       | Gift                                       |
| ---------- | --------------------------------- | ------------------------------------------ |
| Villager   | Archer, Soldier, Vanguard, Sapper | Iron Bow, Iron Spear, Iron Axe, Powder Keg |
| Acolyte    | Mage, Bishop                      | Fire Tome, none                            |

## Archer

The ranged infantry: frail but accurate. Its bow only reaches two tiles away, so it can't strike or counter a foe on the next tile, and Long Shot is how it hits from further off (or up close). Villagers become one by promoting (see Promotions); a fresh one (an enemy) starts on the stat line below.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 9    | 50%    |
| MP   | 5    | 25%    |
| STR  | 3    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 5    | 100%   |
| SPD  | 4    | 50%    |
| LCK  | 2    | 25%    |
| DEF  | 1    | 25%    |
| RES  | 1    | 25%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Bow        | 100%    |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up |
| Long Shot    | 2          | 2    | 1–3   | The regular hit                  |

Level-up skill picks: **Piercing Shot** (3 MP, range 1–3, the regular hit, and on a foe right behind the target), **Pinning Shot** (2 MP, range 1–2, the regular hit, leaving the foe Rooted) and **Disengage** (2 MP, range 1–2, the regular hit, then steps a tile straight back).

Passive, **Steady Aim**: +10 hit. Carries an Iron Bow, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Soldier

The spear-and-shield infantry: the enemy in the demo battle. Villagers become one by promoting (see Promotions); a fresh one (an enemy) starts on the stat line below.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 10   | 75%    |
| MP   | 5    | 25%    |
| STR  | 4    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 3    | 25%    |
| SPD  | 3    | 25%    |
| LCK  | 2    | 25%    |
| DEF  | 2    | 100%   |
| RES  | 0    | 25%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Spear      | 100%    |

| Skill        | Learned at | Mana | Range | Damage                                          |
| ------------ | ---------- | ---- | ----- | ----------------------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up                |
| Shove        | 1          | 1    | 1     | None; pushes the foe a tile                     |
| Shield Bash  | 2          | 3    | 1     | The regular hit with +1 STR, then pushes a tile |

Level-up skill picks: **Lunge** (2 MP, range 1–2, the regular hit with +2 STR), **Phalanx** (2 MP, aimed at itself: every ally next to it is left Guarded) and **Taunt** (2 MP, aimed at itself: no damage, every foe within 2 tiles is left Taunted and must go after a Taunting foe on its next phase; the soldier is left Taunting until your next phase).

Passive, **Shield Wall**: takes 1 less damage when attacked. Carries an Iron Spear, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Vanguard

The axe-wielding front line: high HP and strength, low skill, speed and luck. Its strength matches the Iron Axe's weight, so the axe doesn't slow it, but the axe's low hit makes it the least accurate class. Villagers become one by promoting (see Promotions); a fresh one (an enemy) starts on the stat line below.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 12   | 100%   |
| MP   | 5    | 25%    |
| STR  | 5    | 100%   |
| INT  | 0    | 0%     |
| SKL  | 2    | 50%    |
| SPD  | 2    | 25%    |
| LCK  | 1    | 0%     |
| DEF  | 2    | 25%    |
| RES  | 0    | 0%     |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Axe        | 100%    |

| Skill        | Learned at | Mana | Range | Damage                                          |
| ------------ | ---------- | ---- | ----- | ----------------------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up                |
| Cleave       | 2          | 3    | 1     | The regular hit, and on the foes on either side |

Level-up skill picks: **Sunder** (3 MP, range 1, the regular hit with +2 STR, leaving the foe Sundered), **Reckless Swing** (3 MP, range 1, the regular hit with +6 STR, costing it 3 HP, never its last) and **Jump Swing** (3 MP, range 1–3, leaps up to 2 tiles to land next to the foe, then the regular hit with +2 STR).

Passive, **Heavy Swing**: +1 damage. Carries an Iron Axe, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Sapper

Promoted from the Villager. Hauls a powder keg on its back and throws it up to two tiles, or blasts a foe next to it: a heavy hit with few kegs to spare. Lightly armored. Villagers become one by promoting (see Promotions); a fresh one starts on the stat line below.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 10   | 75%    |
| MP   | 5    | 50%    |
| STR  | 4    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 3    | 100%   |
| SPD  | 3    | 25%    |
| LCK  | 2    | 0%     |
| DEF  | 1    | 25%    |
| RES  | 0    | 0%     |
| MOV  | 5    | –      |

| Weapon types    | Starting weapon | XP rate |
| --------------- | --------------- | ------- |
| physical, siege | Powder Keg      | 100%    |

| Skill        | Learned at | Mana | Range | Damage                           |
| ------------ | ---------- | ---- | ----- | -------------------------------- |
| Throw Stones | 2          | 2    | 1–4   | Half the regular hit, rounded up |
| Blast        | 2          | 3    | 1–2   | The regular hit with +3 power    |

Level-up skill picks: **Shrapnel** (4 MP, range 1–2, half the regular hit on the target and everyone on the 4 tiles around it, allies included), **Lay Mine** (2 MP, range 1, a hidden mine on an empty tile: the first foe to walk onto it takes 6 damage, never its last HP) and **Breach** (3 MP, range 1, knocks down a wall or rock, leaving open ground).

Passive, **Demolitions**: +5 crit. Carries a Powder Keg, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Scout

A specialized unit that doesn't promote, recruited or brought by the Sellswords origin: a flier (a flying carpet, hot-air balloon, giant bird or gyrocopter, by faction) that ranges furthest of any class, quick and lucky but frail. What it does beyond moving far comes later.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 8    | 50%    |
| MP   | 5    | 25%    |
| STR  | 2    | 25%    |
| INT  | 0    | 0%     |
| SKL  | 4    | 25%    |
| SPD  | 6    | 100%   |
| LCK  | 4    | 100%   |
| DEF  | 1    | 0%     |
| RES  | 2    | 25%    |
| MOV  | 7    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Wooden Spear    | 100%    |

| Skill       | Learned at | Mana | Range | Damage                                                  |
| ----------- | ---------- | ---- | ----- | ------------------------------------------------------- |
| Hit and Run | 2          | 2    | 1     | The regular hit, then steps up to 2 tiles straight back |

Level-up skill picks: **Mark** (1 MP, range 1–3, no damage, leaving the foe Marked), **Tailwind** (2 MP, range 1, an ally is left Hastened) and **Airlift** (2 MP, range 1–3, trades places with an ally).

Carries a Wooden Spear, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Beast

A specialized unit, recruited on its own (or grown from the Beast Tamer origin's Whelp): a riderless winged beast (wyvern, griffin, pegasus or drake, by faction) with lots of HP and strength. It fights with its Bite and carries nothing else.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 13   | 100%   |
| MP   | 2    | 25%    |
| STR  | 5    | 100%   |
| INT  | 0    | 0%     |
| SKL  | 2    | 25%    |
| SPD  | 4    | 50%    |
| LCK  | 1    | 0%     |
| DEF  | 2    | 25%    |
| RES  | 1    | 25%    |
| MOV  | 6    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Bite            | 100%    |

| Skill       | Learned at | Mana | Range | Damage                                            |
| ----------- | ---------- | ---- | ----- | ------------------------------------------------- |
| Savage Bite | 2          | 1    | 1     | The regular hit; heals for half of it, rounded up |

Level-up skill picks: **Wing Buffet** (2 MP, range 1, half the regular hit, then pushes the foe a tile), **Roar** (2 MP, aimed at itself: no damage, every foe next to it is left Rooted) and **Pounce** (2 MP, range 1–4, leaps up to 3 tiles to land next to the foe, then the regular hit).

It carries no potions.

## Whelp

The Beast Tamer origin's second unit: a young winged beast that hasn't grown into its wings yet. It starts about as strong as a Villager (a point less strength, but its Bite hits harder than the wooden sword), with the Beast's growths. At level 5 it grows into a Beast on its own, no Master Seal needed: it gains the stats the Beast starts above it (+3 HP, +1 MP, +3 STR, +1 SPD, +1 DEF, +1 RES, +1 MOV), which puts it where a Beast of its level would be, and learns the Beast's skills. It's never a recruit.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 10   | 100%   |
| MP   | 1    | 25%    |
| STR  | 2    | 100%   |
| INT  | 0    | 0%     |
| SKL  | 2    | 25%    |
| SPD  | 3    | 50%    |
| LCK  | 1    | 0%     |
| DEF  | 1    | 25%    |
| RES  | 0    | 25%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Bite            | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and is offered no skill picks until it grows up. It carries no potions.

## Beast Rider

A special unit of its own kind: a rider on the faction's winged beast, strong, fast and far-ranging, with a spear.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 12   | 75%    |
| MP   | 5    | 25%    |
| STR  | 5    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 4    | 50%    |
| SPD  | 5    | 100%   |
| LCK  | 3    | 25%    |
| DEF  | 3    | 25%    |
| RES  | 2    | 25%    |
| MOV  | 7    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Iron Spear      | 100%    |

| Skill  | Learned at | Mana | Range | Damage                                                              |
| ------ | ---------- | ---- | ----- | ------------------------------------------------------------------- |
| Charge | 2          | 2    | 1     | The regular hit, +1 STR for each tile it moved this turn (up to +4) |

Level-up skill picks: **Skewer** (3 MP, range 1, the regular hit with +1 STR, and on a foe right behind the target), **Tandem Strike** (3 MP, range 1, the regular hit, then the beast's bite for half that) and **Strafing Run** (4 MP, range 1–3, flies up to 3 tiles along a row or column to the farthest free tile, dealing half the regular hit to every foe it passes over).

Carries an Iron Spear, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Siege

A specialized unit that doesn't promote: a siege engine on wheels (crystal cannon, mortar, ballista or catapult, by faction). It strikes from two or three tiles away and can't strike or counter a foe next to it; slow and plodding.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 12   | 50%    |
| MP   | 4    | 50%    |
| STR  | 5    | 100%   |
| INT  | 0    | 0%     |
| SKL  | 3    | 50%    |
| SPD  | 1    | 0%     |
| LCK  | 0    | 0%     |
| DEF  | 3    | 25%    |
| RES  | 0    | 0%     |
| MOV  | 3    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| siege        | Ballista        | 100%    |

| Skill   | Learned at | Mana | Range | Damage                                                              |
| ------- | ---------- | ---- | ----- | ------------------------------------------------------------------- |
| Barrage | 2          | 3    | 1–3   | Half the regular hit, rounded up, and on foes on the 4 tiles around |

Level-up skill picks: **Deadeye** (2 MP, range 1–5, the regular hit) and **Breaching Shot** (3 MP, range 1–3, knocks down a wall or rock, leaving open ground).

It carries only its Ballista.

## Ram

A specialized unit that doesn't promote: a covered battering ram, the most HP and DEF of any class, that slams whatever stands in front of it. Slow.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 16   | 100%   |
| MP   | 4    | 25%    |
| STR  | 6    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 1    | 0%     |
| SPD  | 0    | 0%     |
| LCK  | 0    | 0%     |
| DEF  | 5    | 100%   |
| RES  | 0    | 0%     |
| MOV  | 4    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Tackle          | 100%    |

| Skill            | Learned at | Mana | Range | Damage                                                                                   |
| ---------------- | ---------- | ---- | ----- | ---------------------------------------------------------------------------------------- |
| Battering Charge | 2          | 2    | 1–4   | Rolls up to 3 tiles along a clear row or column to the foe, the regular hit, then a push |

Level-up skill picks: **Bulwark** (2 MP, aimed at itself: every ally next to it is left Guarded) and **Breach** (3 MP, range 1, knocks down a wall or rock, leaving open ground).

It fights with its Tackle and carries nothing else.

## Acolyte

A specialized unit that promotes into a Mage or a Bishop at level 5 (see Promotions). The healer and the warband's magic user: it mends a wounded ally next to it with its Heal staff, and fights with Light, a weak spell it knows from the start that strikes from one or two tiles away and never runs out. At level 1 a heal restores 5 HP (the staff's 2 power + 3 INT) and Light hits a soldier for 3 (2 through its Shield Wall). A tome it finds (see Tomes above) teaches it a stronger spell. Frail, but its RES and LCK make it hard to hurt with magic or crit.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 8    | 50%    |
| MP   | 6    | 75%    |
| STR  | 1    | 0%     |
| INT  | 3    | 100%   |
| SKL  | 2    | 25%    |
| SPD  | 3    | 25%    |
| LCK  | 4    | 25%    |
| DEF  | 1    | 25%    |
| RES  | 4    | 50%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Light           | 100%    |

| Staff | Power | Rng | Uses | Heals at level 1 |
| ----- | ----- | --- | ---- | ---------------- |
| Heal  | 2     | 1   | 20   | 5 HP             |

| Skill | Learned at | Mana | Range | Damage                        |
| ----- | ---------- | ---- | ----- | ----------------------------- |
| Mend  | 2          | 3    | 1     | None: heals an ally 2 + `INT` |

Level-up skill picks: **Smite** (3 MP, range 1–2, the regular hit with +3 `INT`, +3 more against a monster), **Prayer** (5 MP, aimed at itself: heals every wounded ally next to it for 1 + half its `INT`, rounded down) and **Ward** (2 MP, range 1–2, an ally is left Warded).

Mend heals like the Heal staff without needing one. Knows Light, and carries a Heal staff, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Mage

The acolyte's promotion: the battle caster. It trades nothing for more INT, MP and SKL than an acolyte and a flat damage bonus, so its spells hit hardest of any unit from one or two tiles away, but it's just as frail. A promoted acolyte keeps its Heal staff and Mend, and is handed a Fire Tome; a fresh one (an enemy) knows Fire and starts on the stat line below.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 8    | 50%    |
| MP   | 7    | 100%   |
| STR  | 1    | 0%     |
| INT  | 5    | 100%   |
| SKL  | 3    | 50%    |
| SPD  | 3    | 25%    |
| LCK  | 4    | 25%    |
| DEF  | 1    | 25%    |
| RES  | 4    | 50%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Fire            | 100%    |

| Skill | Learned at | Mana | Range | Damage                        |
| ----- | ---------- | ---- | ----- | ----------------------------- |
| Mend  | 2          | 3    | 1     | None: heals an ally 2 + `INT` |
| Flare | 2          | 3    | 1–2   | The regular hit with +4 `INT` |

Level-up skill picks: **Fireball** (4 MP, range 1–3, the regular hit with +1 `INT`, on the target and every foe on the four tiles around it), **Frost Lance** (3 MP, range 1–2, the regular hit, and on a foe right behind the target, leaving both Rooted) and **Siphon** (2 MP, range 1–2, the regular hit, healing the mage for half the damage dealt, rounded up).

Passive, **Arcane Might**: +2 damage. Knows Fire, and carries a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Bishop

The acolyte's other promotion: the healer, deepened. More MP, RES and LCK than an acolyte and a point more INT and DEF, so it outlasts magic and keeps healing longer, but it strikes no harder. Its signature, Sanctuary, mends a wounded ally up to two tiles away and every wounded ally around it at once. A promoted acolyte keeps its Light, Heal staff and Mend and is handed nothing new; a fresh one (an enemy) knows Light, carries a Heal staff and starts on the stat line below.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 9    | 60%    |
| MP   | 8    | 100%   |
| STR  | 1    | 0%     |
| INT  | 4    | 75%    |
| SKL  | 2    | 25%    |
| SPD  | 3    | 25%    |
| LCK  | 5    | 50%    |
| DEF  | 2    | 25%    |
| RES  | 6    | 75%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Light           | 100%    |

| Skill     | Learned at | Mana | Range | Damage                                                                       |
| --------- | ---------- | ---- | ----- | ---------------------------------------------------------------------------- |
| Mend      | 2          | 3    | 1     | None: heals an ally 2 + `INT`                                                |
| Sanctuary | 2          | 5    | 1–2   | None: heals a wounded ally and every wounded ally next to it, each 2 + `INT` |

Level-up skill picks: the acolyte's, **Smite**, **Prayer** and **Ward** (see Acolyte).

Passive, **Devotion**: regains 1 MP at the start of each of its phases. Knows Light, and carries a Heal staff, a Health Potion (+5 HP) and a Mana Potion (+3 MP).

## Water Elemental

A neutral unit, belonging to no faction (the pack's teal water spirit). Steady and hard to hurt with spells; strikes with Light from one or two tiles. Elementals aren't recruits or Training choices yet.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 11   | 60%    |
| MP   | 6    | 50%    |
| STR  | 0    | 0%     |
| INT  | 3    | 45%    |
| SKL  | 3    | 35%    |
| SPD  | 3    | 35%    |
| LCK  | 3    | 35%    |
| DEF  | 1    | 15%    |
| RES  | 4    | 45%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Light           | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It fights with its natural weapon and carries nothing else.

## Fire Elemental

A neutral unit (the pack's fire spirit). The hardest-hitting elemental, with Fire from one or two tiles, but frail. Elementals aren't recruits or Training choices yet.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 9    | 50%    |
| MP   | 6    | 50%    |
| STR  | 0    | 0%     |
| INT  | 4    | 55%    |
| SKL  | 3    | 40%    |
| SPD  | 4    | 45%    |
| LCK  | 2    | 25%    |
| DEF  | 0    | 10%    |
| RES  | 3    | 35%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Fire            | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It fights with its natural weapon and carries nothing else.

## Air Elemental

A neutral unit (the pack's white air spirit). The quickest and most elusive elemental; strikes with Light. Elementals aren't recruits or Training choices yet.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 8    | 45%    |
| MP   | 6    | 50%    |
| STR  | 0    | 0%     |
| INT  | 3    | 40%    |
| SKL  | 4    | 45%    |
| SPD  | 6    | 60%    |
| LCK  | 4    | 45%    |
| DEF  | 0    | 10%    |
| RES  | 3    | 35%    |
| MOV  | 6    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| magical      | Light           | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It fights with its natural weapon and carries nothing else.

## Earth Elemental

A neutral unit (the pack's brown rock spirit). Slow and heavy, it slams a foe next to it. Elementals aren't recruits or Training choices yet.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 15   | 80%    |
| MP   | 2    | 20%    |
| STR  | 5    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 2    | 30%    |
| SPD  | 1    | 10%    |
| LCK  | 1    | 15%    |
| DEF  | 4    | 45%    |
| RES  | 1    | 15%    |
| MOV  | 4    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Tackle          | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It fights with its natural weapon and carries nothing else.

## Slime

The weakest monster and Warband Mode's first fight: a slow blob of jelly that deals 1 damage to a level-1 villager and falls to two sword swings. It carries nothing but its Tackle.

Passive, **Bounce**: a hit in its own attack shoves the target a tile back once the exchange is over (onto spikes or into deep water if they're there, a bump if something's in the way; see `src/game/push.ts`). Not on a counter.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 6    | 60%    |
| MP   | 0    | 0%     |
| STR  | 3    | 30%    |
| INT  | 0    | 0%     |
| SKL  | 1    | 20%    |
| SPD  | 1    | 20%    |
| LCK  | 0    | 10%    |
| DEF  | 0    | 20%    |
| RES  | 2    | 30%    |
| MOV  | 3    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Tackle          | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Goblin

A quick, scrappy monster: as fast as anything at level 1 and hits about as hard as a soldier, but frail. It carries nothing but its Club.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 8    | 60%    |
| MP   | 0    | 0%     |
| STR  | 3    | 40%    |
| INT  | 0    | 0%     |
| SKL  | 4    | 45%    |
| SPD  | 5    | 50%    |
| LCK  | 1    | 25%    |
| DEF  | 1    | 20%    |
| RES  | 0    | 10%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Club            | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Skeleton

The sturdy monster: slow and unlucky, but its bones shrug off weak hits and its claws hit harder than a spear. It carries nothing but its Bone Claws.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 10   | 70%    |
| MP   | 0    | 0%     |
| STR  | 4    | 45%    |
| INT  | 0    | 0%     |
| SKL  | 3    | 35%    |
| SPD  | 2    | 25%    |
| LCK  | 0    | 5%     |
| DEF  | 3    | 40%    |
| RES  | 0    | 10%    |
| MOV  | 4    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Bone Claws      | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Bat

The nimblest monster: hard to hit and quick enough to strike twice, but frail and weak. It carries nothing but its Fangs.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 7    | 50%    |
| MP   | 0    | 0%     |
| STR  | 2    | 30%    |
| INT  | 0    | 0%     |
| SKL  | 3    | 40%    |
| SPD  | 6    | 55%    |
| LCK  | 3    | 35%    |
| DEF  | 0    | 10%    |
| RES  | 1    | 20%    |
| MOV  | 5    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Fangs           | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Orc

The heavy monster: slow, but tough enough to take several hits, and it hits harder than any other monster with its Great Axe, which never breaks. It carries nothing else.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 14   | 80%    |
| MP   | 0    | 0%     |
| STR  | 5    | 55%    |
| INT  | 0    | 0%     |
| SKL  | 2    | 30%    |
| SPD  | 2    | 20%    |
| LCK  | 1    | 15%    |
| DEF  | 2    | 35%    |
| RES  | 0    | 10%    |
| MOV  | 4    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Great Axe       | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Minotaur

The charging monster: as strong as an orc with the same Great Axe, but quick and far-ranging (6 MOV, 5 SPD), so it reaches the back line and often strikes twice. Its hide is thinner than an orc's, so it drops faster once it's caught. It carries nothing else.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 13   | 70%    |
| MP   | 0    | 0%     |
| STR  | 5    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 4    | 35%    |
| SPD  | 5    | 40%    |
| LCK  | 2    | 15%    |
| DEF  | 1    | 20%    |
| RES  | 0    | 10%    |
| MOV  | 6    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Great Axe       | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Troll

The wall of a monster: the most HP of any monster bar the dragon, slow and clumsy, swinging a Stone Maul that hits hard but often misses. Its passive, **Regeneration**, gives it back 3 HP at the start of each of its phases, so it has to be brought down in one push rather than worn down. It carries nothing else.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 18   | 100%   |
| MP   | 0    | 0%     |
| STR  | 4    | 45%    |
| INT  | 0    | 0%     |
| SKL  | 1    | 15%    |
| SPD  | 1    | 10%    |
| LCK  | 0    | 10%    |
| DEF  | 3    | 40%    |
| RES  | 1    | 15%    |
| MOV  | 4    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Stone Maul      | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Dragon

The Red Dragon, boss of the Dragon's Roost (the run's stage 10, before the Hold; its rules are in `src/game/bosses.ts`). The most HP and armor of any monster, and its Fire Breath reaches a tile further than a bite, so archers can't pick at it from range unanswered. Slow, so quick units can strike it twice. It carries nothing else.

| Stat | Base | Growth |
| ---- | ---- | ------ |
| HP   | 22   | 90%    |
| MP   | 0    | 0%     |
| STR  | 7    | 50%    |
| INT  | 0    | 0%     |
| SKL  | 4    | 30%    |
| SPD  | 3    | 20%    |
| LCK  | 2    | 15%    |
| DEF  | 5    | 40%    |
| RES  | 3    | 30%    |
| MOV  | 4    | –      |

| Weapon types | Starting weapon | XP rate |
| ------------ | --------------- | ------- |
| physical     | Fire Breath     | 100%    |

| Skill | Learned at | Mana | Range | Damage |
| ----- | ---------- | ---- | ----- | ------ |

It learns no skills and carries no potions.

## Matchups at level 1

The Villager and the Soldier differ by a point of strength and their weapons: the wooden sword has the spear's power but lands more often. Each attack is from as close as the attacker's weapon reaches (2 tiles for the bow). Damage is before passives (the Soldier's Shield Wall takes 1 off each hit it takes).

| Attacker | Target   | Weapon       | Damage | Hit | Crit | Strikes |
| -------- | -------- | ------------ | ------ | --- | ---- | ------- |
| Villager | Soldier  | Wooden Sword | 2      | 89% | 0%   | 1       |
| Soldier  | Villager | Iron Spear   | 3      | 79% | 0%   | 1       |
| Archer   | Soldier  | Iron Bow     | 3      | 83% | 0%   | 1       |
| Vanguard | Soldier  | Iron Axe     | 6      | 61% | 0%   | 1       |
| Sapper   | Soldier  | Powder Keg   | 7      | 69% | 0%   | 1       |
| Acolyte  | Soldier  | Light        | 3      | 88% | 0%   | 1       |

Every class learns its skill at level 2, its first level up (the Soldier's Shove, which deals no damage, is known from level 1); the skill rows use level-1 stats.

| Skill        | User     | Target   | Damage | Hit    | Crit  | Strikes       |
| ------------ | -------- | -------- | ------ | ------ | ----- | ------------- |
| Throw Stones | Villager | Soldier  | 1      | always | never | 1, no counter |
| Shield Bash  | Soldier  | Villager | 4      | always | never | 1, no counter |
| Long Shot    | Archer   | Soldier  | 2      | always | never | 1, no counter |
| Cleave       | Vanguard | Soldier  | 6      | always | never | 1, no counter |
| Blast        | Sapper   | Soldier  | 9      | always | never | 1, no counter |
