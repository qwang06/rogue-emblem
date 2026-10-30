# Unit sprite catalog

What's in `src/assets/units/`: every unit sheet from the source pack, read
from the pixels. `Soldier_03`, `Vanguard_04`, `Soldier_04` and
`Acolyte_02` (the base classes) and the promoted classes' twelve variants
(listed under "Variants are team colors and races" below) are wired into the
game (`UNIT_SPRITES` in `src/game/tileset.ts`); everything else is ready to import
in `src/assets/sprites.ts` when a class needs art.

## Warrior and Amazon (generated, not from the pack)

Two PixelLab recreations of Tactics Ogre's Warrior and Amazon, made from the
original sprites (cut out at 1:1 into 32x32 frames as the reference). Like the
pack they are 128x128 sheets (rows down/left/right/up, 4 frames, RGBA, alpha
fully on or off), but they are **true 32px art, not 16px doubled**, with the
originals' dark brown outline and their palettes. Footprint about x 8–24,
y 3–30; feet on y 30 (29–30 in the walks' passing frames), a row lower than
the pack's.

- `Warrior_02` is the warrior class's art (`UNIT_SPRITES.warrior`, also
  `DEFAULT_UNIT_SPRITE`): a foot soldier in a big round pale-blue steel kettle
  helmet, blue tunic with a belt, grey mail collar (seen from behind), tan
  gloves and boots, small face in the helmet's shadow. No weapon shows.
- `Amazon_01` is the archer class's art (`UNIT_SPRITES.archer`, replacing
  `Archer_02`): a woman with a big blonde mane and a green headband, light
  blue top, white short skirt, bare tan arms and legs, green boots. No weapon
  shows.

Made with PixelLab `create_character_pro_flash` / `create_image_pro` at 32x32
with the original sprite as the style image and its palette, 6 attempts each,
scored by a separate judging agent (likeness: Amazon 7/10, Warrior 6.5/10;
the warrior's body reads leaner and his face darker than the original's).
Animations are PixelLab skeleton-v3 (`animate_character`), which poses the
still without redrawing it: Idle is a 4-frame breathing idle; Move picks 4 of
an 8-frame walk, and the Amazon's side and back walks are rebuilt as still,
stride, still, stride (her back stride mirrored for the other leg) because the
generated ones thinned and leaned. The judge scored the finished animations
7–7.5/10. The left and right rows are true side profiles at the same scale as the
down and up rows, the right row a mirror of the left (round 2: the Warrior's
from PixelLab, the Amazon's hand-drawn pixel by pixel in her palette because
PixelLab kept turning her toward the camera; their idles are a 1px bob of the
still, their walks skeleton-v3 legs under the still's upper body). The
Amazon's hair is recolored to one bright blonde ramp in every row (the
generated dark brown side was only shading). The Warrior's front view was hand-edited to
look straight ahead with two eyes, the Amazon's profile eye is a white pixel
with the pupil in front, and her front walk widens her hair 1px to one side on
the first stride and to the other on the second, so it sways. Sources,
attempts, judge logs and the sheet build script are in the project files under
`art/to-sprites/`, and on the art machine under `pixellab/to-sprites/`.

`Warrior_01` (the earlier generated warrior: dark spiky hair, red headband,
cream tunic, iron sword; `art/warrior/` in the project files) and
`Villager_01` before it stay in the folder but are no longer loaded.

## Monsters (not from the pack)

Six enemy monsters, the art of the monster classes (`UNIT_SPRITES.slime` and
so on, all in `SPRITE_URLS`). Same layout and scale as the pack (128x128, rows
down/left/right/up, 4 frames, 16px art doubled), RGBA instead of color-keyed,
colors from the pack's palette, no baked shadow, lowest pixels on y 28–29
(the bat hovers above that).

`Slime_01` is 64px art (256x256 sheets, `frame: 64` in `sprites.ts`): four
stills made from a concept painting with PixelLab `image_to_pixelart` at 64x64
(the process is in the project files at `art/slime-64/out/notes.md`; east is
west mirrored), assembled by `scripts/assemble-unit-sheet.js <dir> Slime_01`,
which keeps the stills as they are and only shifts them: idle sinks 2px on
frames 2–3, move hops 4px up on frames 1 and 3. Its feet are on y 60.

`Goblin_01` (and `Slime_01` before it went 64px) were made with PixelLab (Pro Flash at 16x16,
styled on the villager) and assembled by `scripts/build-unit-sheet.js`. Only
the four facing stills were generated; idle sinks the body 1px onto the feet
for frames 2–3, and move hops 1px up on frames 1 and 3. To redo one, save
PixelLab's four rotation images as `<name>_{south,west,east,north}.png` and run
`node .claude/skills/tileset/scripts/build-unit-sheet.js <dir> <Name>`.
PixelLab's 16px output comes on a 32px canvas with pure black outlines and
dozens of near-duplicate tones, which the script crops and remaps.

`Skeleton_01`, `Bat_01`, `Wolf_01` and `Orc_01` are drawn pixel by pixel in
`scripts/draw-monsters.js`: each facing is a 16x16 grid of palette keys, with
the animation frames derived from it (step frames swap the leg rows, the bat's
flap swaps whole poses). Run `node .claude/skills/tileset/scripts/draw-monsters.js`
from the repo root after editing a grid; it rewrites their sheets. East is the
west grids mirrored. Each went through up to three review passes against the pack's units.

| Art           | What it shows                                                                                                                                                                                       | Animation                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `Slime_01`    | 64px: green jelly dome with two dark eyes, a smile and a drip on its side; glossy highlight. Side views are a lower dome.                                                                           | idle sink, move hop                                            |
| `Goblin_01`   | Green goblin with wide pointed ears, orange eyes, a brown tunic and a club in its right hand.                                                                                                       | idle squash, move hop                                          |
| `Skeleton_01` | Bone-white skeleton: big skull with red eye glints and a row of teeth, ribs over a spine and pelvis, thin legs, a rusty sword (orange hilt, rust flecks) held up, in front when walking left/right. | idle squash; move steps each foot in turn                      |
| `Bat_01`      | Purple cave bat, wings spread: pointed ears, yellow eyes, open mouth with two fangs, lit leading wing edges and scalloped trailing edges. Hovers, lowest pixel y ~26.                               | idle and move flap mid, up, mid, down (lifted 1px on the down) |
| `Wolf_01`     | Grey wolf: side view a full-length quadruped with an upright tail; front view a wedge head with a long pale muzzle and black nose; back view a dark saddle and bushy dark-tipped tail.              | idle squash; move trots (legs alternate)                       |
| `Orc_01`      | Hulking dark-green orc: heavy brow over red eyes, white tusks, leather vest with shoulder straps and a gold buckle, plum trousers, a big iron axe in its right hand.                                | idle squash; move steps each foot in turn                      |

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
a look rather than a team marker. `Soldier_03` (pink),
`Vanguard_04` (brown, axe), `Soldier_04` (brown tower shield, the guard class) and `Acolyte_02` (orange
robe, the acolyte class) are what's in use for the base classes; the warrior and archer wear the generated `Warrior_02` and `Amazon_01`.

The promoted classes (`src/game/promotions.ts`) each wear another variant, close to their base
class's look: Hero `Vanguard_02` (gold spear), Berserker `Vanguard_06` (red, axe, ginger beard),
General `Soldier_05` (green crested helm, the soldier's design recolored), Halberdier `Soldier_02`
(topknot), Sniper `Archer_03` (crested helm), Arbalest `Siege_03` (a ballista, no rider), Champion
`Vanguard_03` (gold-tipped spear), Bombardier `Sapper_04` (keg on the back), Bastion `Soldier_06`
(red tower shield, the guard's design recolored), Templar `Vanguard_01` (wizard with a staff),
Bishop `Acolyte_01` (blue robe) and Sage `Acolyte_03` (pink robe). Checked as a contact sheet of
each down-facing idle frame; none brings its own ground shadow.

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
   for every unit (`UNIT_SHADOW`), tuned for the pack's villager and soldier
   (feet at y 28–31). Units that bring their own shadow (`Beast`,
   `BeastRider`, gyrocopter `Scout`s, every ship's water shadow) would get a
   second one, so they'd need a per-art opt-out before going on the map.
4. Ships are drawn as if floating on water. They'd look wrong on land, so
   give them water-only movement before using them.

To look at sheets yourself, render them zoomed rather than dumping 188 files
as ASCII. `sheet-grid.js` takes a single sheet, e.g.
`node .claude/skills/tileset/scripts/sheet-grid.js --scale 4 src/assets/units/Archer_02_Idle.png <scratchpad>/archer.png 0 0 3 3`.
