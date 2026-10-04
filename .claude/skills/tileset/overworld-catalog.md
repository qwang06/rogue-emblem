# Overworld sheet catalog

What's where on **Tactical RPG Overworld Pack**. Positions are `[column, row]`
in **16px source tiles**, which are the same numbers as 32px tiles in the
game's `src/assets/overworld.png`. That sheet is 42 x 63 tiles, and a tile's
frame is `row * 42 + column`.

- **Source:** `Tactical RPG Overworld Pack - Tilesheet.png`, 3072x3072 (not kept
  in the repo; `overworld.png` holds everything the game uses).
  The art is drawn at 3x (every art pixel is a 3x3 block), so it's natively
  1024x1024. Only the top-left 672x1008 native pixels are used; the rest is
  transparent.
- **Game sheet:** `src/assets/overworld.png` is the used area redrawn at 2x,
  so 16px tiles become the game's 32px tiles. It was made (and can be
  remade from a copy of the pack) with:
  `node .claude/skills/tileset/scripts/rescale-png.js --from 3 --to 2 --crop 672x1008 "Tactical RPG Overworld Pack - Tilesheet.png" src/assets/overworld.png`

Nothing is on a dual grid. Terrain uses **blob autotiles**: a terrain is drawn
in its own cells, with its border inside the edge cells, over a grass base.

## Autotile set layout

Every terrain set below has the same 7-tile-wide layout, starting at `[c, r]`:

```
c   c+1 c+2 c+3   c+4 c+5 c+6
|   N   N   N     B   B   B      r      | = 1-wide vertical strip (top cap / middle / bottom cap)
|   N   N   N     B   B   B      r+1    N = "notched" 3x3: same as B but with an inside
|   N   N   N     B   B   B      r+2        corner cut into every inner corner
-   -   -   o     I   I          r+3    B = plain 3x3: outer corners, edges, full middle
                  I   I          r+4    - = 1-tall horizontal strip, o = single-cell island
                                        I = 2x2 of full tiles with one inside corner meeting
                                            at their shared center
```

`src/game/autotile.ts` needs only `B` (as `block: [c+4, r]`) and one
all-corners-notched tile (`inner: [c+2, r+1]`, the middle of `N`). Every one
of the 47 neighbor combinations is assembled from quarters of those tiles.
The strips, island and `I` tiles are pre-assembled versions of some of those
combinations.

**Lighting:** the border is thick on the side facing west or north (with a dark
shadow on the water) and a thin lip on the south and east. That's how the pack
draws it, not a bug.

## Terrain

| What                    | Where                                                                                        | Notes                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Grass, light (plain)    | `[0, 0]`                                                                                     | Base fill under everything. Colors `#b7d463` / `#ceda62`                                                              |
| Grass, dark (plain)     | `[13, 4]`                                                                                    | The dark-grass set's clean middle, `#84b14d` / `#abc75c`. (`[12, 6]` has a 2px notch in one corner; it's an `I` tile) |
| Sand patch set          | strip `[0, 3]`, N `[1, 3]`, h-strip `[0, 6]`, island `[3, 6]`                                | Peach sand with orange specks. Notched only. **In use** as dirt (see Patch sets below)                                |
| Puddle / stream set     | strip `[4, 3]`, N `[5, 3]`, h-strip `[4, 6]`, island `[7, 6]`                                | Water with a brown bank and mint foam. Notched only. Best as 1-wide streams (see Patch sets below)                    |
| **Dark grass set**      | strip `[8, 3]`, N `[9, 3]`, **B `[12, 3]`**, h-strip `[8, 6]`, island `[11, 6]`, I `[12, 6]` | The only patch set with the full layout. **Autotiles cleanly at any size** (see Patch sets below)                     |
| **Water, rocky shore**  | set at `[0, 8]`, **6 animation frames** at columns 0, 7, 14, 21, 28, 35                      | **In use** (`TERRAIN_AUTOTILES.water`: block `[4, 8]`, inner `[2, 9]`)                                                |
| Water, sandy beach      | set at `[0, 13]`, 6 frames, 7 columns apart                                                  | Same layout. Swap in with block `[4, 13]`, inner `[2, 14]`                                                            |
| Island rings, beach     | rows 18–24, 6 frames                                                                         | Pre-assembled water tiles that make round 2x2 and 1x1 islands. See Island rings below                                 |
| Island ring, rocky      | rows 25–27, 6 frames                                                                         | A 1x1 island ring matching the rocky-shore water in use. See Island rings below                                       |
| **Deep water** in water | set at `[0, 28]`, 6 frames, 7 columns apart (columns 0–41)                                   | Full layout, opaque. Swap-ready: block `[4, 28]`, inner `[2, 29]`. See Deep water below                               |

## Deep water (rows 28–32)

Dark-blue deep patches (`#4c6885` / `#686f99`) inside open water, with soft,
ragged edges and no outline. It's the standard 7-wide layout with **every part
present**: strip `[0, 28]`, notched 3x3 `[1, 28]`, **plain 3x3 `[4, 28]`**,
h-strip `[0, 31]`, island `[3, 31]`, `I` tiles `[4–5, 31–32]`. Six animation
frames 7 columns apart fill the sheet's full width (columns 0–41).

- **Autotile:** `{ block: [4, 28], inner: [2, 29], animation: { frames: 6, columnStride: 7 } }`.
  Verified with `scripts/autotile-preview.ts --base 5,9`: **clean at every
  size**, including wide areas with a hole, 1-wide channels, a T-junction and
  lone cells (a lone cell is a small four-point star).
- **The tiles are opaque.** Regular open water (`#4fa4b8` / `#a3a7c2`) is
  baked in around the deep parts, and it matches the water sets' open water
  frame for frame, so a deep layer over the water layer blends seamlessly and
  animates on the same timer. The deep patches themselves animate too (their
  wave texture shifts the same 0 1 2 3 2 1 way).
- **Keep deep cells away from land.** Because the tiles are opaque, a deep
  cell drawn on a water cell that borders land (including diagonally) would
  paint open water over that cell's shore. Only mark water cells deep when all
  eight neighbors are water; a pure helper can enforce that.
- Pairs with the deep-water rocks `[12, 2]` (their foam is the open-water
  color, their shadow darker than deep water). In game terms: impassable
  except for fliers (and maybe boats), with plain water staying passable
  for e.g. pirates.

## Island rings (rows 18–27)

Small islands of land in open water, pre-drawn with a rounded shore. Each ring
is a **plus shape of opaque water tiles** around a land hole: one water tile
on each side of every hole cell, with the shore drawn on the side facing the
hole. The **diagonal cells are left out**: they're plain full water, so the
shore cuts across the hole's corners. That gives an octagon (2x2) or a
diamond (1x1) instead of the square, notched island the blob autotile draws
for the same hole. Verified by compositing over the matching water and by
comparison with `scripts/autotile-preview.ts`.

| Ring                    | Frame 0 tiles (hole marked `·`)                                                                                               | Frames                                | Water to pair with                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| 2x2 island, sand beach  | top `[1, 18]` `[2, 18]`; left `[0, 19]` `[0, 20]`; right `[3, 19]` `[3, 20]`; bottom `[1, 21]` `[2, 21]`; hole `[1–2, 19–20]` | 6, **4 columns** apart (columns 0–23) | Sandy beach set (`[0, 13]`); full water `[5, 14]`        |
| 1x1 island, sand beach  | top `[1, 22]`; left `[0, 23]`; right `[2, 23]`; bottom `[1, 24]`; hole `[1, 23]`                                              | 6, **3 columns** apart (columns 0–17) | Sandy beach set                                          |
| 1x1 island, rocky shore | top `[1, 25]`; left `[0, 26]`; right `[2, 26]`; bottom `[1, 27]`; hole `[1, 26]`                                              | 6, 3 columns apart (columns 0–17)     | Rocky-shore set (`[0, 8]`, **the one in use**); `[5, 9]` |

- **Frame k of a ring matches frame k of its water set** pixel for pixel in
  the open water, so a ring animates in sync on the same timer. The water
  sets' frames ping-pong: frames 1 and 5, and 2 and 4, are identical in the
  open water, so the cycle is 0 1 2 3 2 1.
- The shore pieces carry small brown nubs at the hole's corners, which meet
  across the diagonal. The hole itself is transparent: grass (or a building or
  forest) shows through.
- The beach rings' shore is a sand band with a pale foam rim. The rocky ring is
  mint foam over dark-blue shallows with brown rock at the corners, the same
  as the rocky water set's edge.
- **No rocky 2x2 ring** exists, only beach.

**Using them in code** (not done yet): a pure function that finds land holes
exactly 1x1 (or 2x2) with water on all eight sides, then for each of those
water cells picks the ring tile for its side, or **full water** for the
diagonal cells. That overrides what the blob autotile would draw there (an
`inner` corner). Every other water cell autotiles as before.

## Patch sets (rows 3–7)

Three sets of ground patches drawn over the light grass. Each uses the 7-wide
layout, laid side by side at columns 0, 4 and 8 instead of 7 apart, because
the first two have no plain 3x3. Rows 3–5 hold the strip and 3x3s, row 6 the
h-strip and island, and row 7 is empty except for dark grass's `I` tiles.
Verified with `scripts/autotile-preview.ts` on a map with a wide block, a hole,
1-wide paths, a T-junction and a lone cell.

| Set        | `block`   | `inner`   | Result                                                                                                                                                                                                                       |
| ---------- | --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dark grass | `[12, 3]` | `[10, 4]` | **Clean everywhere.** Soft, ragged edges with no outline; the notches in `N` and `I` are only 2px. Good for meadows/tall grass (e.g. a +avoid terrain) or just breaking up the base grass                                    |
| Puddle     | `[5, 3]`  | `[6, 4]`  | 1-wide lines are clean streams/canals/moats with rounded caps. Areas 2+ wide get rounded-square holes at every inner corner (a grid of islands). Interior is flat `#4fa4b8` (the normal water's base) with a `#4c6885` shade |
| Sand       | `[1, 3]`  | `[2, 4]`  | Same as puddle: clean 1-wide paths, holes in wide areas (the dirt problem in SKILL.md)                                                                                                                                       |

**Fixing the notched sets:** each needs a full tile (and a `full` option in
`autotile.ts`). Both are easy to make: the puddle's full tile is solid
`#4fa4b8`, and the sand's can be tiled from the clean speckled middle of
`[2, 4]` (rows 12–21 of that tile are hole-free across its whole width). Row 7
columns 0–11 is empty space for them.

## Terrain features (overlays, 1-cell footprint)

All of these are transparent overlays drawn over the grass (or water) tile.
Each one stands on a grass skirt with a dark-green shadow along its south
edge. Columns 4–10 are sample stacks rather than separate objects; the pieces
below are what they're built from. Verified by compositing over grass/water.

| What                           | Where                         | Notes                                                                                                                                                                                                     |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pine forest (dense)            | `[0, 1]`                      | ~5 conifers, x 2–31, y 0–29                                                                                                                                                                               |
| Pine forest (sparse)           | `[1, 1]`                      | 3 smaller conifers, x 4–31, y 2–31                                                                                                                                                                        |
| Broadleaf forest               | `[2, 1]`                      | 2 round deciduous trees, x 0–29                                                                                                                                                                           |
| Hill                           | `[3, 1]`                      | Low snow-capped mound inside its own tile (y 4–31), no cap needed                                                                                                                                         |
| **Mountain cap**               | `[4, 0]`, `[5, 0]`            | Just the peak tip, x 4–25, y 18–31 of the tile. Draw it in the cell **north** of the northernmost mountain of a column, so the peak rises ~14px into that cell. The two differ by 20px (variants)         |
| **Mountain body**              | `[4, 1]`                      | Whole mountain, fills the tile. Use when the cell south is **not** a mountain. Near-identical variants (4–24px differ, snow streak): `[5, 2]` = `[7, 2]`, `[6, 1]`, `[8, 2]`, `[9, 2]`, `[10, 2]`         |
| **Mountain body + peak below** | `[5, 1]` (≈ `[7, 1]`)         | Same body with the south neighbor's peak baked into its bottom. Use when the cell south **is** a mountain                                                                                                 |
| Mountain, compact top          | `[6, 0]` (≈ `[7, 0]`)         | A shorter mountain (y 4–31) that fits its own tile, with the south neighbor's peak baked in. Tops a column without spilling into the cell above (e.g. on the map's top row); needs a mountain south of it |
| **Forest + peak below**        | `[8, 1]`, `[9, 1]`, `[10, 1]` | Dense pine / sparse pine / broadleaf forest (`[0, 1]` / `[1, 1]` / `[2, 1]`) with the south neighbor's mountain peak baked in. Use for a forest cell directly north of a mountain                         |
| Bridge, horizontal             | `[11, 1]`                     | Stone-gray planks, rails along top and bottom, y 2–31. Over water                                                                                                                                         |
| Bridge, vertical               | `[11, 2]`                     | Rails left and right, x 2–29                                                                                                                                                                              |
| Rocks, shallow water           | `[12, 1]`                     | Cluster of 4 boulders with mint `#92e8c0` foam and a `#4c6885` shadow. Reads correctly over the normal water set                                                                                          |
| Rocks, deep water              | `[12, 2]`                     | Same rocks, foam `#4fa4b8` (normal water color) and shadow `#3a3f5e`. Reads correctly over deep water                                                                                                     |

**Mountain stacking rule** (a pure vertical autotile, one decision per cell):
body = `[5, 1]` if the cell south is a mountain, else `[4, 1]`; if the cell
north is not a mountain, also draw the cap `[4, 0]` in that north cell (over
whatever is there, at a depth above it). A forest cell with a mountain south of
it swaps to its `[8–10, 1]` version. Mountain cells are opaque enough that the
grass under them barely shows, but still draw grass first for the skirt.

## Buildings (team-colored)

Every building comes in ten colors, in two palette sets of five. Within a
block, **one column per color**, in this order:

- **Set A**: white, orange, teal, pink, brown. Natural materials (wood, stone,
  thatch) with team-colored roofs and trim.
- **Set B**: white, red, blue, green, orange. The whole building tinted in the
  team color.

Set A is columns 0–4 and 12–16; set B is columns 6–10 and 18–22. The tall
buildings at columns 24–28 mix the two sets: set A on some rows, set B on others
(see the table). **White has no flag**, so it reads as neutral/unowned; the
other colors suit team ownership (Advance Wars–style captured buildings).

**Flags are separate tiles.** Every colored building's pennant (8x6px, a pole
and a team-colored flag) is its own tile in the cell **above** the building,
sitting at y 26–31 of that tile. Its x position depends on the building type.
So a 1x1 building is drawn as two tiles: the building in its cell plus the flag
tile over the cell to its north (above the terrain there). The odd rows that
look empty in rows 49–61 are those flag tiles. A white building's flag cell is
empty.

All buildings are transparent overlays on grass, with a grass skirt and shadow
at their base. Names are what the art reads as; pick the game meaning to fit.
Verified by compositing over grass.

### 1x1 buildings (building at row r, flag at row r − 1)

| Row | Columns 0–4 / 6–10                                                                    | Columns 12–16 / 18–22                                                                      |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 50  | **House**: a house with a small shed in a yard, stone path. FE village to visit       | **Farm field**: fenced crop plot; the set B versions tint the whole field                  |
| 52  | **Fort / barracks**: a squat keep with a big pale gateway. FE fort (def + heal)       | **Fountain / pond**: an oval pool ringed with shrubs                                       |
| 54  | **Temple / shrine**: a spired building inside a fenced yard                           | **Gold mine / treasury**: a dome hut with a pillared entrance and gold coins (lower right) |
| 56  | **Port**: a hangar-roofed boathouse with a striped pier and water at its lower left   | **Mine / quarry**: the same dome hut with dark ore rocks (lower left)                      |
| 58  | **Windmill**: X sails over a round tower                                              | (top of the 2-tall tower below)                                                            |
| 60  | **Camp**: a hide hut with a campfire, a tent and a dead tree on the left. Bandit camp | (flags for the castle below)                                                               |
| 62  | **Workshop**: a timber building with a crane/gantry on its roof. Armory or mill       | (bottom of the 2-tall castle)                                                              |

### Tall buildings (1 wide, 2 tall)

| What                                      | Where                                                      | Flag tile       |
| ----------------------------------------- | ---------------------------------------------------------- | --------------- |
| **Spire tower** (lighthouse / mage tower) | columns 12–16 / 18–22, rows 58 (spire, x 6–25) – 59 (base) | row 57          |
| **Castle** (throne / seize point)         | columns 12–16 / 18–22, rows 61 (spire) – 62 (keep)         | row 60          |
| **Pagoda**, 3 stories                     | columns 24–28: set A rows 50–51, set B rows 53–54          | row 49 / row 52 |
| **Keep / watchtower**, battlements        | columns 24–28: set A rows 56–57, set B rows 59–60          | row 55 / row 58 |

The pagoda suits the red paifang gate (`gates.png`) the demo level already uses.

### Walls and fortresses

Two kits, each in the ten building colors. Verified with
`scripts/autotile-preview.ts` (the game's own autotile code) and
`compose-tiles.js`.

**Color groups.** Rampart sets are 6 columns wide, starting at columns
**0, 6, 12, 18, 24**: rows 33–36 in set A (white, orange, teal, pink, brown) and
rows 41–44 in set B (white, orange, blue, red, green). Note that set B's order
here differs from the buildings'. Tower kits are 5 columns wide. In set A:
white at `[0, 37]`, orange at `[5, 37]`, teal at `[10, 37]`, pink at
`[0, 39]`, brown at `[5, 39]`. In set B (rows 45–48) the same positions hold
white, orange, blue, red, green.

#### Rampart autotile (rows 33–36 / 41–44)

A raised stone rampart, top-down, with a crenellated (dashed) rim. It's the
standard 7-wide layout minus the plain 3x3, the same as the sand set. For the
group at column c:

```
c    c+1 c+2 c+3   c+4        c+5
|    N   N   N     slab       gatehouse (no flag)   row 33 (41)
|    N   N   N     rubble     gatehouse, flag 1     row 34 (42)
|    N   N   N     rubble     gatehouse, flag 2     row 35 (43)
-    -   -   o     gate, f3   gatehouse, flag 4     row 36 (44)
```

- **Autotile:** `block: [c+1, 33]`, `inner: [c+2, 34]` (white: `[1, 33]` /
  `[2, 34]`). Like the dirt set it's **notched only**. **1-wide walls render
  clean**: straight runs, corners, T-junctions and closed rings all look like
  proper castle walls. That's the main use. In areas 2+ wide, every full
  quarter shows a notch, so a solid block becomes a grid of small square
  courtyards with a big one in any 1-cell hole. That reads as a fortress
  roof, not a floor.
- **Gatehouse** `[c+5, 33]`: a squat block with a dark arched door at the
  bottom. Mark its cell as wall and draw it on top: the wall runs straight
  into its sides (tested in a ring). `[c+5, 34]`, `[c+5, 35]`, `[c+4, 36]`
  and `[c+5, 36]` are the same gatehouse with a flag on its face: orange,
  teal, pink, brown in every group of set A. The flag colors are the teams',
  not the wall's, so any wall color can be held by any team. `[c+5, 34]` has a
  crumbled slope on its left, and `[c+4, 36]` has broken crenellations above
  it (damaged versions).
- **Slab** `[c+4, 33]`: a lone 1x1 raised block with a diagonal line
  (a hatch or stair), with its own shadow. Works as a pedestal or a block in
  the open.
- **Rubble** `[c+4, 34]`: a broken wall end sloping down to the right.
  `[c+4, 35]`: a rubble heap with a broken wall stub below it. Use these for
  ruined walls.

#### Tower kit (rows 37–40 / 45–48)

Square crenellated towers (a light top, a front face with a dark slit window)
joined by short wall segments. Each tile is one tower. Wall segments are
**half-stubs on the tile's east/west edge** (x 0–6 or 26–31), so two adjacent
towers with facing stubs make a continuous wall. Towers stacked vertically
just touch. For the group at `[c, r]`:

| Tile             | Connects     | Notes                                         |
| ---------------- | ------------ | --------------------------------------------- |
| `[c + 4, r + 1]` | nothing      | Lone tower. Flag in `[c + 4, r]` (not white)  |
| `[c, r + 1]`     | east         | West end of a horizontal wall                 |
| `[c + 1, r + 1]` | east + west  | Middle of a horizontal wall                   |
| `[c + 2, r + 1]` | west         | East end                                      |
| `[c + 3, r + 1]` | south        | Open at the bottom (y 0–31); a tower below it |
| `[c, r]`         | south + east | Corner (top-left of a ring)                   |
| `[c + 2, r]`     | south + west | Corner (top-right of a ring)                  |

North connections need no special piece; only "is there a tower south" and
"east/west" change the tile. **Missing:** south + east + west (a T going down)
and a 4-way, so the kit draws straight walls, L corners, rings and columns but
not T-junctions. A pure picker would take (south, east, west) and fall back
to dropping a link for the two missing combos.

## UI

The cursor, movement arrow, digits, bars and markers are cataloged separately in
**[ui-catalog.md](ui-catalog.md)**. They're not map tiles. Their columns 24–31,
rows 50–62 sit beside the buildings; don't mistake them for terrain.

The pack has **no unit sprites**; units come from their own sheets (see SKILL.md).
