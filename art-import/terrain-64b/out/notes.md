# terrain-64b: notes

Second version of the 64px terrain, built from `ref/concept.png` (728x1024, from `art-refs:refs/terrain-64b/concept.png` in qwang06/rogue-emblem, fetched read-only).

**Generations spent: 60** (the account went from 89 used to 149 used). The budget was about 65. Nothing failed, and there were no retries.

| item | tool | gens |
|---|---|---|
| grass/dirt tileset | create_topdown_tileset (pro, 64px) | 25 |
| grass/water tileset (cut bank) | create_topdown_tileset (pro, 64px) | 25 |
| 16-prop batch | create_1_direction_object (16 candidates at 64px, two style images) | 10 |

**What changed from v1:**
- Both tilesets were given a **42-colour `palette`** taken from the concept. 32 colours came from median-cut on grass, river and trail crops (`prep/palette.py`, `prep/palette.json`). I added 10 by hand: trail tans, foam white, light water, bank browns and stone greys. Every pixel of both sets uses these colours. This is what fixed the hue: v1 grass is blue-green, v2 grass is yellow-green.
- The river set uses a **raised cut bank** with a brown cliff transition instead of v1's light shore.
- Props used **two** 64x64 style mosaics instead of one. Each is four 32px concept cells quantized to 24 colours: `prep/style_a.png` (pines, red-roof houses, castle tower, mountain) and `prep/style_b.png` (boulders, bridge, watchtower, broadleaf). `prep/style.py` builds them.

## 1. Tilesets (`tilesets/<name>/`)
The layout is the same as v1. Each folder has `sheet.png` (256x256 in a 4x4 grid), the raw PixelLab `metadata.json`, the 16 sliced tiles in `tiles/wang_NN.png`, and `wang_map.json`. Tiles use `index = NW*8 + NE*4 + SW*2 + SE*1`, where a corner is 1 when it is the set's upper terrain. Slice by `rect`. The sheet position is not the index, but the position-to-index table is the same as v1's.

**Watch the terrain roles:** in grass_dirt, grass is LOWER and dirt is UPPER. In grass_water, water is LOWER and grass is UPPER.

| set | id | lower | upper | settings |
|---|---|---|---|---|
| grass_dirt | 199620e6-b85c-4cbf-a140-0cbebc86e5fa | grass (base **4ba173ac-1f20-4e43-ad3a-5428538d6b34**) | dirt (base 41faa6da-b375-444b-bac2-38db32998918) | pro, 64, high top-down, transition_size 0, raggedness 0.4, boundary_amplitude 0.1, boundary_seed 1, medium shading, highly detailed, palette above |
| grass_water | 80e52a5d-f2eb-45dc-8f12-ee3632f28ced | water (base 5cc03fdf-cc11-4154-8b82-aa9f670b6114) | grass (upper_base_tile_id = the grass base above, so it is chained) | pro, 64, high top-down, transition_size 0.25, step_slope 0.3 (steep), transition "steep dark brown rocky earth cut bank, eroded dirt cliff with small dark stones…", raggedness 0.4, boundary_amplitude 0.1, boundary_seed 2, medium shading, highly detailed, palette above |

The prompts are in `metadata.json`. The grass prompt was "warm yellow-green meadow grass, painterly pixel art, soft lighter yellow-green sunlit patches and darker olive-green patches, small grass tufts, muted earthy tones". The chaining worked: the full-grass tile is pixel-identical in both sets. Pro tilesets take no seed; the `boundary_seed` values are listed above. To add more sets on the same grass, pass `lower_base_tile_id=4ba173ac-1f20-4e43-ad3a-5428538d6b34`.

## 2. Plain tiles (`tiles/`)
`grass_a` is grass_dirt wang_0. `grass_b` is grass_a mirrored, and `grass_c` is grass_a rotated 180°. `dirt` is grass_dirt wang_15, and `water` is grass_water wang_0.

## 3. Props (`props/`, 64x64, transparent, alpha strictly 0/255)
I made one `create_1_direction_object` call with 16 `item_descriptions`. The batch object was `baf86660-…`, and it is now split into 16 objects tagged `terrain-64b` (ids in `raw/obj_ids.txt`, in frame order). All 16 came back transparent with clean 0/255 alpha and no grey background. Everything is 64x64, so none needed 64x128.

| frame | prop | cleanup |
|---|---|---|
| f0 | tree_pine | none |
| f1 | tree_pine_cluster | removed the flat olive ground patch under the trunks (flood from the outside, rows ≥48 only) |
| f2 | tree_broadleaf | none |
| f3 / f4 | mountain_peak / mountain_peaks | none |
| f5 / f6 / f7 | house_red / house_blue / house_orange | house_red: removed the grass patch and the dirt doorstep |
| f8 | watchtower | none |
| f9 | castle_wall | none. It covers columns 0-62 (63px), and its left and right edges don't match (mean difference 14/255), so it is not seamless, so overlapping copies looks fine and butting them shows a small seam |
| f10 | castle_tower | none |
| f11 | castle_gatehouse | none |
| f12 | bridge_h | removed the water drawn under it: cut below row 44, then took out teal pixels, so the arch opening shows the tile's own water |
| f13 | bridge_v | removed the water strips: kept columns 20-48 (the deck) |
| f14 | boulders | none |
| f15 | village_wall | none |

The bridges were each drawn in their own direction (no rotation). Neither one tiles along its length. bridge_h is a single arched span about 64px long, and bridge_v's deck is 29px wide and runs the full 64px height.

## 4. Preview
`preview.png` is a 768x512 sample map at 1x (12x8 tiles), autotiled from a 13x9 vertex grid in `prep/finalize.py`. The river and trails are **one vertex wide**, which renders them about one tile wide. Two vertices wide (as in v1) makes 3-tile-wide trails, far wider than the concept's thin paths. Because a one-vertex feature is centred on a tile corner, props that sit on it (the gatehouse and the bridges) are placed at half-tile pixel offsets.

`compare_v1_v2.png` shows v1 on the left and v2 on the right, each at 1x.

## Is v2 closer to the reference? Yes, clearly.
Mean colour of the full grass and water tiles compared with flat areas of the concept:

| | concept | v1 | v2 |
|---|---|---|---|
| grass | #8d9643, hue 66, sat .38 | #3f8e3b, hue 116, sat .41 | **#818f45, hue 70, sat .35** |
| water | #2c4c4f, hue 186, sat .29, light .24 | #2a93e2, hue 205, sat .76, light .53 | **#306665, hue 179, sat .35, light .30** |

The grass hue is now within 4° of the concept (v1 was 50° off). The water went from bright sky-blue to dark teal. It is still slightly lighter and greener than the concept's deep teal-blue. The bank is a dark brown cliff like the reference.

## Weak pieces
- **Trails are ~1 tile wide.** The concept's tan trails are thin lines, a few pixels across. A corner-based wang set cannot draw a 10px path, so this would need path tiles (`create_path_tiles`) or a decal overlay. The dirt also reads a little brighter and browner than the concept's paths.
- **Water** is a bit lighter and greener than the reference, and its foam streaks are short flecks rather than long flowing lines.
- **bridge_h** is one fixed span, so a river wider than one tile needs bank tiles on each side. It does not tile.
- **Castle pieces are small:** a 64px tower next to 64px houses has about the same footprint, while in the concept the castle towers are about 2x a house. A 64x128 or 128x128 tower and gatehouse would read better. I did not redo them, to stay inside the budget.
- **Small-scale props have no ground anchoring.** Because shadows were excluded, the houses and trees sit a little flat on the grass.
- There is **no waterfall**. It needs an animated or cliff tile, which was out of scope.

## Files
- `raw/`: both sheets and their metadata, the 16 batch frames (`obj_batch1_fN.png`), and `obj_ids.txt`.
- `../prep/`: `palette.py` (the concept palette), `style.py` (the two style mosaics), `cells.py` (cell picks), and `finalize.py` (slicing, wang_map, prop cleanup, preview, comparison).
