# Painted art checklist

The game is moving from the old 32px pixel art to painted art like the
plains battlefield kit (`src/assets/battlefields/plains/`). This is
everything that still has to be generated before no pixel art is left.
Tick a box when its art is merged.

**Style change:** the art is moving from the painterly look to an anime
look (cel-shaded characters and props on anime background art). The
painterly pieces already in the game (the plains kit, four units and the
obstacles) stay until their anime versions replace them, so their boxes are
unticked again.

## How to make it

The full spec and prompts are in the project's shared files at
`art/anime/prompts.md`. In short:

- **Style:** characters, obstacles and props are anime game art: clean
  dark-brown lineart, cel shading with two flat tones and a crisp
  highlight, bright clear colors, warm afternoon light from the upper left.
  Battlefields are anime background art: lush saturated greens, crisp
  painted shapes, cool blue-violet shadows falling to the lower right.
- **Background:** solid flat magenta (#FF00FF) for anything with a cut-out
  shape; it's keyed out. Seamless ground textures have no background.
- **Units:** one square image each, full body, facing right in
  three-quarter side view from slightly above, about five heads tall
  (heroic anime proportions), feet about 90% of the way down. The game animates the single image in code.
  Warband units have a blue accent; monsters use their own colors.
- **Save generations:** ask for a 2x2 grid of four on one 1:1 image (each
  cell is still twice the size the game ships). Make the two key images
  first (the plains scene and the warrior) and attach them as references
  so every batch matches the set.
- Drop finished images in `pixellab/` on the PC; Claude cuts, keys,
  compresses and wires them in.

## 1. Units (battle and every menu that shows a unit)

Biggest win: these are on screen all the time. Grouped into batches of four.

Base classes

- [ ] Warrior
- [ ] Archer
- [ ] Acolyte (cleric)
- [ ] Soldier (spear and shield infantry)
- [ ] Vanguard (axe-wielding front line)
- [ ] Guard (heavy armor behind a tower shield, spear)

Promoted classes (a richer version of their base class's look)

- [ ] Hero (from warrior)
- [ ] Berserker (from warrior)
- [ ] General (from soldier)
- [ ] Halberdier (from soldier)
- [ ] Sniper (from archer)
- [ ] Arbalest (from archer, crossbow)
- [ ] Champion (from vanguard)
- [ ] Bombardier (from vanguard, powder kegs)
- [ ] Bastion (from guard)
- [ ] Templar (from guard)
- [ ] Bishop (from acolyte)
- [ ] Sage (from acolyte; uses the mage)

Monsters (enemies)

- [ ] Slime
- [ ] Goblin
- [ ] Skeleton
- [ ] Bat
- [ ] Wolf
- [ ] Orc

## 2. Battlefield obstacles

The things standing on the field's cells (`PAINTED_OBSTACLES` in
`src/game/tileset.ts`, art in `src/assets/obstacles/`). The framing clumps
on forest and desert still use the old `OBSTACLE_ART`. One cut-out each, on magenta,
seen from the same slightly-above angle, sitting on the ground with no
cast shadow (the game adds one). Two or three variants of each helps.

- [ ] Rock (small, impassable)
- [ ] Boulder (big pile, impassable)
- [ ] Bush (slows movement)
- [ ] Pine (slows movement)
- [ ] Thicket (dense brush, slows movement)
- [ ] Crag (jagged rock, desert)
- [ ] Cactus (desert)

## 3. Battlefields

- [ ] Plains kit (redo in the anime style): seamless grass, dry grass and
      dirt, horizon, left and right tree clusters, bushes, decals,
      foreground

Plains has a painterly kit; forest and desert still use the old code-drawn look.
Each needs the same set of pieces as plains:

- [ ] Forest kit: seamless ground (leaf litter and moss), 2 patch textures
      (dirt path, ferns), horizon strip, border tree clusters, bushes, 5
      decals (roots, mushrooms, stones, ferns, logs), 2 foreground pieces
- [ ] Desert kit: seamless sand, 2 patch textures (cracked earth, pebbles),
      horizon strip (dunes, mesas), border rocks and dead trees, scrub, 5
      decals, 2 foreground pieces

Plains extras still wanted: a right-side tree cluster, small trees, rocks,
a log, flowers, dirt decals.

## 4. Gates

- [ ] Gate (the 3x2 stone gatehouse in `src/assets/gates.png`), painted
      at the battlefield angle, with its roof as a separate piece so units
      can walk under it

## 5. Icons (menus, rewards and the HUD)

Small square icons, one per file, on magenta. Generate at 512 and they're
shipped at 64 to 128. A grid of nine on one image works well for these.

- [ ] Items and weapons (24, `src/assets/items/`): wooden sword, axe,
      spear, shield, armor; iron axe, spear, bow; great axe, club, ballista;
      heal staff, fire spell, fire, light; health potion, mana potion,
      master seal, powder keg; fists, bite, fangs, bone claws, tackle
- [ ] Boons (24, `src/assets/boons/`): one per boon, stat boosts, and the
      four skill boons
- [ ] Rewards (6, `src/assets/rewards/`): draft, gold, lesson, relic,
      rest, scroll
- [ ] HUD glyphs (30, `src/assets/glyphs/`): attack, hit, crit, avoid,
      move, range, and the rest. These are tiny (16px) so a simple, bold
      painted style is best

## 6. Realm map (overworld between battles)

- [ ] Sites (9, `src/assets/realm/sites/`): battle, elite, event, fort,
      hold, home, shrine, town, village
- [ ] Map marks (11, `src/assets/realm/ink/`): grass, hills, mountains,
      pine and round trees, waves. These are drawn as ink on the map, so a
      hand-inked style fits better than full paint

## 7. Title and frames

- [ ] Title background (`src/assets/title/background.webp`, the castle on
      the cliff), repainted in the new style, 16:9 at 1920x1080 or larger
- [ ] Window frames (`src/assets/ui/frame-*.png`): parchment and the three
      banners, as 9-slice frames
- [ ] Menu pointer (`src/assets/ui/hand-pointer.png`)

## Last step

Once nothing above is pixel art, `pixelArt: true` in `src/main.ts` can go
(it sets nearest-neighbour filtering and pixel snapping for everything),
and the old sheets in `src/assets/units/`, `overworld.png` and the 32px
icon sets can be deleted. Story Mode and Training still draw tile maps
from `overworld.png`; they either move to battlefields or keep that sheet.
