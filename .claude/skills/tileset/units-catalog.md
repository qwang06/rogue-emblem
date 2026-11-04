# Unit sprite catalog

What's in `src/assets/units/`: every unit sheet from the source pack, read
from the pixels, plus the monsters and the red dragon. The pack's six
versions of each unit are the six factions (see "Versions are factions"
below): a faction class (`FACTION_BODIES` in `src/game/tileset.ts`) wears
its faction's version, so every version of the villager, archer, soldier,
vanguard, sapper, scout, beast, beast rider, siege engine, ram and acolyte
is in use, and the four elementals are the neutral elemental classes
(`UNIT_SPRITES`). `src/assets/sprites.ts` loads every sheet in the folder
but the ships, which no class uses yet.

## Red dragon (not from the pack)

`Red_Dragon` is the dragon class's art (`UNIT_SPRITES.dragon`), the Red
Dragon boss. The user's source sheets were 3x upscales of true 32px art
(every art pixel an exact 3x3 block), so they were cut back to 1x without
loss; the 3x originals (`AdultRedDragon_*.png`) are in the project files under
`art/red-dragon/raw/`. Rows are down/left/right/up like the pack. A red
horned dragon with cream belly and horns, purple-brown outline, wings spread
to the tile's edges; RGBA, with a **baked shadow** (a grey ellipse at alpha
100 on y 30–31, under x 4–27 standing), so the map adds none
(`UNIT_ART.Red_Dragon.bakedShadow`) and its outline skips alpha under 128.
Every sheet is listed in `UNIT_ART` in `tileset.ts` with its frame size and
where the unit's tile sits in a frame:

| Sheet                   | Frames | Frame size | Tile at | What it shows                                                                                   |
| ----------------------- | ------ | ---------- | ------- | ----------------------------------------------------------------------------------------------- |
| `Red_Dragon_Idle`       | 4      | 32x32      | 0, 0    | standing, wings half-folded, a slow breath                                                      |
| `Red_Dragon_Move`       | 4      | 48x32      | 8, 0    | flying, wings beating past both sides, body raised over its shadow                              |
| `Red_Dragon_Attack`     | 6      | 112x96     | 40, 32  | fire breath: rears (frame 0), then a fireball grows and bursts up to 3 tiles out the facing way |
| `Red_Dragon_AttackBody` | 6      | 112x96     | 40, 32  | the attack with the dragon alone (viewer only)                                                  |
| `Red_Dragon_AttackFire` | 6      | 112x96     | 40, 32  | the attack's flame alone, frame 0 empty (viewer only; the source had 5 frames, for frames 1–5)  |
| `Red_Dragon_Hit`        | 2      | 32x32      | 0, 0    | a bright orange flash frame, then a darker recoil                                               |
| `Red_Dragon_Die`        | 1      | 32x32      | 0, 0    | a ghostly teal silhouette                                                                       |

The blow lands on attack frame 2 (`impactFrame`), when the fireball is
biggest. The animation viewer (`#/animations`) plays every sheet.

## Monsters (not from the pack)

Five enemy monsters, the art of the monster classes (`UNIT_SPRITES.slime`
and so on): `Slime`, `Goblin`, `Skeleton`, `Bat` and `Orc`. The user's
source sheets were 3x upscales of 16px art (every art pixel an exact 3x3
block), redrawn at 2x like the pack (every art pixel a 2x2 block); the 3x
originals are in the project files under `art/monsters-v2/raw/`. Rows are
down/left/right/up like the pack. RGBA, with a **baked shadow** (a dark
ellipse at alpha 100 under the feet), so the map adds none
(`UNIT_ART.<name>.bakedShadow`). Each has seven sheets, listed in
`UNIT_ART` (built by `monsterArt` in `tileset.ts`):

| Sheet                 | Frames | Frame size (Orc) | Tile at      | What it shows                                                                         |
| --------------------- | ------ | ---------------- | ------------ | ------------------------------------------------------------------------------------- |
| `<name>_Idle`         | 4      | 32x32 (32x48)    | 0, 0 (0, 16) | standing, a small bob                                                                 |
| `<name>_Move`         | 4      | 32x32 (32x48)    | 0, 0 (0, 16) | walking (the bat flying, the slime hopping)                                           |
| `<name>_Attack`       | 5      | 96x96 (96x112)   | 32, 32       | a lunge with its swipe or slash (frame 0 the wind-up)                                 |
| `<name>_AttackBody`   | 5      | 96x96 (96x112)   | 32, 32       | the attack without the swipe (viewer only)                                            |
| `<name>_AttackEffect` | 5      | 96x96 (96x112)   | 32, 32       | the swipe alone, frame 0 empty (viewer only; the source had 4 frames, for frames 1–4) |
| `<name>_Hit`          | 2      | 32x32 (32x48)    | 0, 0 (0, 16) | struck                                                                                |
| `<name>_Die`          | 1      | 32x32 (32x48)    | 0, 0 (0, 16) | fallen                                                                                |

The orc stands a tile and a half tall (its frames are 48px high with the
tile at their foot); the attack frames have 16 more rows under the tile
for its swing. The blow lands on attack frame 1 for the goblin, skeleton
and orc, frame 2 for the slime and bat (`impactFrame`). The slime is a
green blob, the goblin a green goblin with a club, the skeleton a bone
warrior with a sword, the bat a purple bat, the orc a hulking red-brown
orc in a horned helmet. The animation viewer (`#/animations`) plays every
sheet.

## Minotaur and troll (not from the pack)

Two big monsters, the art of the minotaur and troll classes
(`UNIT_SPRITES.minotaur`, `.troll`): `Minotaur`, a horned bull-man in
red-brown with a long-hafted axe, and `Troll`, a grey-skinned troll with a
pink mohawk, green-and-brown hide clothes and a boulder lashed to a
branch. The user's own 32px art (`bigMonsterArt` in `tileset.ts`); rows
down/left/right/up like the pack; RGBA with alpha only 0 or 255 and **no
baked shadow** (feet on y 30), so the map adds `UNIT_SHADOW`.

| Sheet                 | Frames | Frame size | Tile at | What it shows                                                                                                    |
| --------------------- | ------ | ---------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `<name>_Idle`         | 4      | 32x32      | 0, 0    | standing, a small bob                                                                                            |
| `<name>_Move`         | 4      | 32x32      | 0, 0    | walking                                                                                                          |
| `<name>_Attack`       | 6      | 112x96     | 40, 32  | weapon raised (frames 0–1), then the swing and its trail out the facing way                                      |
| `<name>_AttackBody`   | 6      | 112x96     | 40, 32  | the attack without the effect (viewer only)                                                                      |
| `<name>_AttackEffect` | 6      | 112x96     | 40, 32  | the effect alone, frame 0 empty: the minotaur's slash arc, the troll's ground burst and shock ring (viewer only) |
| `<name>_Hit`          | 2      | 32x32      | 0, 0    | an orange flash frame, then a recoil                                                                             |
| `<name>_Die`          | 1      | 32x32      | 0, 0    | fallen                                                                                                           |

The blow lands on attack frame 2 (`impactFrame`), where the slash or
burst is biggest. The source files were named `minotaur_attack_fx`
(-> `_Attack`), `minotaur_attack` (-> `_AttackBody`), `minotaur_slash_fx` /
`troll_smash_fx` (-> `_AttackEffect`), `_death` (-> `_Die`), `_walk`
(-> `_Move`).

## Files and layout

- **Names:** `{Unit}_{NN}_{Idle|Move}.png`, `NN` = version `01`–`06`
  (`Elemental` has only `01`–`04`). 16 units, 94 arts, 188 files.
- **Every file has the same layout:** 128x128, a 4x4 grid of 32px frames,
  all 16 frames filled. Rows are facings, top to bottom **down, left, right,
  up** (the layout `UNIT_SHEET` expects); columns are the 4 animation frames.
  So any art drops into `UNIT_SPRITES` with no other code change.
- **Format:** RGB with a `tRNS` color key making black transparent. There are
  no partially transparent pixels and no opaque pure black (outlines are
  `#291d2b`).
- **Scale:** already the game's 2x (32px tiles). `Villager_01_Idle` and
  `Soldier_03_Idle` used to be rescaled from the pack's 3x 192x192 sheets.
  The copies here are pixel-identical to those, just re-encoded.
- **Animation:** idle is a small bob or sway in place. Move is a walk cycle
  for people, wing flaps for fliers, and rocking or rowing for boats and
  carts. Most move rows have 3 distinct frames (one repeats), and some idle
  rows do too, so `UNIT_ANIMATIONS` timing works unchanged.

## Versions are factions

The six versions of each unit are the same unit for six factions
(`src/game/factions.ts`). Each has its own color, and the peoples pair up:

| Version | Faction         | Color         | Look (people)                                                                   |
| ------- | --------------- | ------------- | ------------------------------------------------------------------------------- |
| `01`    | Azure Conclave  | blue / teal   | Pointed wizard hats, teal accents (the player's warband)                        |
| `02`    | Sunward Kingdom | orange / gold | Humans with hair buns or topknots, green eyes                                   |
| `03`    | Rose Court      | pink / purple | Pale or lavender skin, crested helmets, yellow or red eyes                      |
| `04`    | Ironhold Clans  | brown / tan   | Banded helmets or hoods that hide the face, tower shields                       |
| `05`    | Verdant Wardens | green         | Same design as `03`, recolored                                                  |
| `06`    | Crimson Legion  | red           | Same design as `04`, recolored (ginger beard shows on some, e.g. `Vanguard_06`) |

Vehicles and fliers follow the same pairing: `03`/`05` share a design, `04`/`06`
share a design, and `01` and `02` are each unique. Units with no people's
design (acolytes, boats, rams) are only recolored. A unit's art is
`getUnitSprite(unitClass, faction)`: its class's body (`FACTION_BODIES`)
in its faction's version, e.g. a Rose Court archer is `Archer_03`. The
player's warband is Azure (`PLAYER_FACTION`); enemies are their region's
faction, the Crimson Legion by default. Elementals and monsters belong to no
faction and look the same on any side. Checked as a contact sheet of each
down-facing idle frame (project files `art/factions/unit-variants.png`);
none of the people brings its own ground shadow.

## Units

Footprint is the opaque area of the down-facing idle frame 0, in sheet pixels
(x, y within the 32px frame). "Feet" is the bottom opaque row, which is where
`UNIT_SHADOW` sits.

| Unit            | What it shows                                                                                                                                                                                                                              | Footprint                                                                      | Feet          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------- |
| `Acolyte`       | Hooded robed figure, glowing eyes in a dark hood, small hands. Same body in all six, only recolored. A healer or cleric.                                                                                                                   | x 4–27, y 0–29                                                                 | y 29, x 10–21 |
| `Mage`          | Not from the pack (the user's own art, 2026-11-03): a robed caster with a tall pointed hood over a shadowed face with glowing eyes and a long staff held at its side; the faction color is the robe. Same body in all six, only recolored. | x 0–31, y 0–29                                                                 | y 29          |
| `Bishop`        | Not from the pack (the user's own art, 2026-11-03): a cleric in a tall mitre with a gold or white cross band down the robe and a staff topped by a gem; the faction color is the robe. Same body in all six, only recolored.               | x 0–31, y 0–29                                                                 | y 29          |
| `Archer`        | Archer with a drawn bow held across the body. Race design per variant (wizard hat, topknot, crested helm, banded hood).                                                                                                                    | x 2–31, y 0–29                                                                 | y 29, x 10–21 |
| `Battleship`    | Big warship. Down/up: a pointed hull seen end-on; left/right: side view with a team-colored sail and a railing of shields. Blue water shadow under the hull.                                                                               | x 2–29, y 0–31                                                                 | y 31          |
| `BeastRider`    | Rider on a winged mount (wings spread toward the camera). Mount design per variant, like `Beast`. Dark ground shadow drawn at the bottom (y 28–31).                                                                                        | x 0–31, y 0–31                                                                 | y 31, x 8–23  |
| `Beast`         | Riderless winged beast: `01` teal wyvern, `02` orange griffin/lion, `03`/`05` white pegasus-like, `04`/`06` brown/red drake. Its own ground shadow at y 28–31.                                                                             | x 0–31, y 0–31                                                                 | y 31, x 8–23  |
| `Elemental`     | Four kinds, not team colors: `01` teal water/plant, `02` fire, `03` white air spirit with gold sparks, `04` brown earth/rock. Small (fits in ~24px).                                                                                       | `01` x 4–27 y 4–29, `02` x 6–25 y 2–29, `03` x 2–29 y 4–29, `04` x 4–27 y 6–29 | y 29          |
| `FishingBoat`   | Small rowboat with one team-colored sailor and peach oars. Blue water shadow under it.                                                                                                                                                     | x 2–29, y 6–31                                                                 | y 31          |
| `Frigate`       | Sailing ship with team-colored sails, narrower than `Battleship`. Blue water shadow.                                                                                                                                                       | x 6–25, y 0–31                                                                 | y 31          |
| `Ram`           | Covered battering ram: a wooden shed on wheels with a team-colored roof stripe and the ram's head poking out the front.                                                                                                                    | x 4–27, y 2–31                                                                 | y 31          |
| `Sapper`        | Figure carrying a big powder keg or bomb on their back with a lit fuse. Race design per variant (`01` hooded, `03`/`05` pale skin, `04`/`06` dark skin or beard).                                                                          | x 4–31, y 0–29                                                                 | y 29, x 10–21 |
| `Scout`         | A different flier per variant: `01` flying carpet with rider, `02` hot-air balloon, `03`/`05` big bird, `04`/`06` gyrocopter (rotor on top, own ground shadow).                                                                            | `01`/`02`/`04`/`06` x 0–31 y 0–31, `03`/`05` x 2–29 y 2–29                     | y 29–31       |
| `Siege`         | Siege engine on wheels: `01` teal crystal cannon, `02` orange mortar, `03`/`05` ballista, `04`/`06` catapult.                                                                                                                              | x 0–31 at widest, y 0–29                                                       | y 29, x 6–25  |
| `Soldier`       | Spear and shield infantry. `01` wizard hat, `02` topknot, `03`/`05` crested helm with a visor, `04`/`06` big tower shield with a white helm. Spear points lower left.                                                                      | x 0–27, y 0–31                                                                 | y 29–31       |
| `TransportShip` | Wide oared galley with a team-colored sail stripe, many oars along the sides. Blue water shadow.                                                                                                                                           | x 2–29, y 4–31                                                                 | y 31          |
| `Vanguard`      | Tall polearm carrier (staff, spear or axe held upright on the left in the down facing): `01` wizard with staff, `02` gold spear, `03`/`05` gold-tipped spear, `04`/`06` axe.                                                               | x 0–27, y 0–29                                                                 | y 29, x 4–21  |
| `Villager`      | Unarmed townsperson in each race's design. Same proportions as the soldiers without weapons.                                                                                                                                               | x 4–27, y 0–29                                                                 | y 29, x 10–21 |

## Using a new unit art

1. Import both sheets in `src/assets/sprites.ts` (from `./units/...`) under
   their file names as keys, e.g. `Archer_02_Idle`, `Archer_02_Move`.
2. Map the class to the art name in `UNIT_SPRITES` (`archer: 'Archer_02'`).
3. Check the shadow. `addUnitShadow` draws a translucent ellipse at the feet
   for every unit (`UNIT_SHADOW`), tuned for the pack's villager and soldier
   (feet at y 28–31). Units that bring their own shadow (`Beast`,
   `BeastRider`, gyrocopter `Scout`s, every ship's water shadow) would get a
   second one, so they'd need a per-art opt-out before going on the map.
4. Ships are drawn as if floating on water. They'd look wrong on land, so
   give them water-only movement before using them.

To look at sheets yourself, render them zoomed rather than dumping 188 files
as ASCII. `sheet-grid.js` takes a single sheet, e.g.
`node .claude/skills/tileset/scripts/sheet-grid.js --scale 4 src/assets/units/Archer_02_Idle.png <scratchpad>/archer.png 0 0 3 3`.
