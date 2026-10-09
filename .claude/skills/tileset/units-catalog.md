# Unit sprite catalog

What's in `src/assets/units/`: every unit sheet from the source pack, read
from the pixels. Only `Villager_01`, `Soldier_03`, `Archer_02`, `Vanguard_04`,
`Vanguard_01` and `Soldier_04` are wired into the game
(`UNIT_SPRITES` in `src/game/tileset.ts`); everything else is ready to import
in `src/assets/sprites.ts` when a class needs art.

## Files and layout

- **Names:** `{Unit}_{NN}_{Idle|Move}.png`, `NN` = variant `01`–`06`
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

## Variants are team colors and races

The six variants of each unit are the same unit for six factions. Each has its
own color, and the races pair up:

| Variant | Color         | Look (people)                                                                   |
| ------- | ------------- | ------------------------------------------------------------------------------- |
| `01`    | blue / teal   | Pointed wizard hats, teal accents                                               |
| `02`    | orange / gold | Humans with hair buns or topknots, green eyes                                   |
| `03`    | pink / purple | Pale or lavender skin, crested helmets, yellow or red eyes                      |
| `04`    | brown / tan   | Banded helmets or hoods that hide the face, tower shields                       |
| `05`    | green         | Same design as `03`, recolored                                                  |
| `06`    | red           | Same design as `04`, recolored (ginger beard shows on some, e.g. `Vanguard_06`) |

Vehicles and fliers follow the same pairing: `03`/`05` share a design, `04`/`06`
share a design, and `01` and `02` are each unique. Units with no team design
(acolytes, boats, rams) are only recolored.

The game currently gives a class the same art on both teams, so the variant is
a look rather than a team marker. `Villager_01` (blue), `Soldier_03` (pink), `Archer_02` (orange),
`Vanguard_04` (brown, axe), `Vanguard_01` (teal wizard with a staff, the
wizard class) and `Soldier_04` (brown tower shield, the guard class) are what's
in use.

## Units

Footprint is the opaque area of the down-facing idle frame 0, in sheet pixels
(x, y within the 32px frame). "Feet" is the bottom opaque row, which is where
`UNIT_SHADOW` sits.

| Unit            | What it shows                                                                                                                                                                | Footprint                                                                      | Feet          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------- |
| `Acolyte`       | Hooded robed figure, glowing eyes in a dark hood, small hands. Same body in all six, only recolored. A healer or cleric.                                                     | x 4–27, y 0–29                                                                 | y 29, x 10–21 |
| `Archer`        | Archer with a drawn bow held across the body. Race design per variant (wizard hat, topknot, crested helm, banded hood).                                                      | x 2–31, y 0–29                                                                 | y 29, x 10–21 |
| `Battleship`    | Big warship. Down/up: a pointed hull seen end-on; left/right: side view with a team-colored sail and a railing of shields. Blue water shadow under the hull.                 | x 2–29, y 0–31                                                                 | y 31          |
| `BeastRider`    | Rider on a winged mount (wings spread toward the camera). Mount design per variant, like `Beast`. Dark ground shadow drawn at the bottom (y 28–31).                          | x 0–31, y 0–31                                                                 | y 31, x 8–23  |
| `Beast`         | Riderless winged beast: `01` teal wyvern, `02` orange griffin/lion, `03`/`05` white pegasus-like, `04`/`06` brown/red drake. Its own ground shadow at y 28–31.               | x 0–31, y 0–31                                                                 | y 31, x 8–23  |
| `Elemental`     | Four kinds, not team colors: `01` teal water/plant, `02` fire, `03` white air spirit with gold sparks, `04` brown earth/rock. Small (fits in ~24px).                         | `01` x 4–27 y 4–29, `02` x 6–25 y 2–29, `03` x 2–29 y 4–29, `04` x 4–27 y 6–29 | y 29          |
| `FishingBoat`   | Small rowboat with one team-colored sailor and peach oars. Blue water shadow under it.                                                                                       | x 2–29, y 6–31                                                                 | y 31          |
| `Frigate`       | Sailing ship with team-colored sails, narrower than `Battleship`. Blue water shadow.                                                                                         | x 6–25, y 0–31                                                                 | y 31          |
| `Ram`           | Covered battering ram: a wooden shed on wheels with a team-colored roof stripe and the ram's head poking out the front.                                                      | x 4–27, y 2–31                                                                 | y 31          |
| `Sapper`        | Figure carrying a big powder keg or bomb on their back with a lit fuse. Race design per variant (`01` hooded, `03`/`05` pale skin, `04`/`06` dark skin or beard).            | x 4–31, y 0–29                                                                 | y 29, x 10–21 |
| `Scout`         | A different flier per variant: `01` flying carpet with rider, `02` hot-air balloon, `03`/`05` big bird, `04`/`06` gyrocopter (rotor on top, own ground shadow).              | `01`/`02`/`04`/`06` x 0–31 y 0–31, `03`/`05` x 2–29 y 2–29                     | y 29–31       |
| `Siege`         | Siege engine on wheels: `01` teal crystal cannon, `02` orange mortar, `03`/`05` ballista, `04`/`06` catapult.                                                                | x 0–31 at widest, y 0–29                                                       | y 29, x 6–25  |
| `Soldier`       | Spear and shield infantry. `01` wizard hat, `02` topknot, `03`/`05` crested helm with a visor, `04`/`06` big tower shield with a white helm. Spear points lower left.        | x 0–27, y 0–31                                                                 | y 29–31       |
| `TransportShip` | Wide oared galley with a team-colored sail stripe, many oars along the sides. Blue water shadow.                                                                             | x 2–29, y 4–31                                                                 | y 31          |
| `Vanguard`      | Tall polearm carrier (staff, spear or axe held upright on the left in the down facing): `01` wizard with staff, `02` gold spear, `03`/`05` gold-tipped spear, `04`/`06` axe. | x 0–27, y 0–29                                                                 | y 29, x 4–21  |
| `Villager`      | Unarmed townsperson in each race's design. Same proportions as the soldiers without weapons.                                                                                 | x 4–27, y 0–29                                                                 | y 29, x 10–21 |

## Using a new unit art

1. Import both sheets in `src/assets/sprites.ts` (from `./units/...`) under
   their file names as keys, e.g. `Archer_02_Idle`, `Archer_02_Move`.
2. Map the class to the art name in `UNIT_SPRITES` (`archer: 'Archer_02'`).
3. Check the shadow. `addUnitShadow` draws a translucent ellipse at the feet
   for every unit (`UNIT_SHADOW`), tuned for the villager and soldier
   (feet at y 28–31). Units that bring their own shadow (`Beast`,
   `BeastRider`, gyrocopter `Scout`s, every ship's water shadow) would get a
   second one, so they'd need a per-art opt-out before going on the map.
4. Ships are drawn as if floating on water. They'd look wrong on land, so
   give them water-only movement before using them.

To look at sheets yourself, render them zoomed rather than dumping 188 files
as ASCII. `sheet-grid.js` takes a single sheet, e.g.
`node .claude/skills/tileset/scripts/sheet-grid.js --scale 4 src/assets/units/Archer_02_Idle.png <scratchpad>/archer.png 0 0 3 3`.
