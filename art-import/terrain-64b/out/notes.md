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

## 5. Mountain pass (grass_rock + mountain props)
Made so mountain ranges can span several tiles. Work files are in `../mountains/` (`recolor.py`, `finalize.py`, the style mosaic, `preview.png`, `obj_ids.txt`).

**Generations spent: 45** (158 used → 203 used). The budget was about 40. Nothing failed and nothing was retried.

| item | tool | gens |
|---|---|---|
| grass/rock tileset | create_topdown_tileset (pro, 64px) | 25 |
| 4 big candidates | create_1_direction_object (4 candidates at 128px, one 128px style mosaic) | 10 |
| 16 small candidates | create_1_direction_object (16 candidates at 64px, three style images) | 10 |

### grass_rock (`tilesets/grass_rock/`)
Same layout and `wang_map.json` format as the other sets. **Grass is LOWER and rock is UPPER** (corner 1 = rock).

| set | id | lower | upper | settings |
|---|---|---|---|---|
| grass_rock | 5b3dce64-7c59-4fb8-a37d-947b2e23f9b2 | grass (`lower_base_tile_id` = 4ba173ac-1f20-4e43-ad3a-5428538d6b34, chained) | rock (base 11492fd7-0860-4eb9-9dc1-d30344205092) | pro, 64, high top-down, transition_size 0.25, step_slope 0.6, transition "short rocky slope at the foot of a cliff, grey-brown rock face with small fallen stones and scree spilling onto the grass", raggedness 0.4, boundary_amplitude 0.1, boundary_seed 3, medium shading, highly detailed, the same 42-colour palette |

Upper prompt: "rocky mountain highland ground seen from high above: brown-grey rock and loose scree, cracked stone slabs with dark cracks, scattered small grey boulders and pebbles, muted earthy grey-brown tones, painterly pixel art". The chaining worked: the full-grass tile is pixel-identical to grass_dirt's.

**The sheet is hand-fixed.** PixelLab drew the upper terrain as *grass with boulders* on a raised plateau, not rock ground. Rather than pay 25 more generations, `mountains/recolor.py` recolours the grass pixels on the upper side to the palette's rock browns (`#3e2c20 #5a4030 #7a5a3c #86704a #a08850`, by brightness rank). The boulders, cliff and lower grass are left as drawn, and every pixel is still in the 42-colour palette. The upper side is found per tile as the green areas cut off by the cliff. On the flat back edges (rock south of grass, where the raised set draws no cliff face), the split falls back to the tile's corner quadrants with a small wobble. The wobble is 0 at tile edges, so neighbours still meet. The untouched sheet is `raw/grass_rock_sheet_raw.png`.

### Mountain props (`props/`, transparent, alpha 0/255, no shadow or ground)
All five came back clean, with no ground patch and 0/255 alpha, so none needed cleanup.

| file | size | source frame | object id |
|---|---|---|---|
| mountain_big_massif | 128x128 (2x2) | big f0 (three summits) | 132130b6-7bed-466b-8762-246001f4ad1a |
| mountain_big_peak | 128x128 (2x2) | big f2 (single tall peak) | 4236ff32-76a1-49df-8b0c-e4d62d153293 |
| mountain_ridge_1 | 64x64 | small f0 (low jagged ridge, left to right) | 196313ad-077e-4bd7-89bc-e1f2b4c98e64 |
| mountain_ridge_2 | 64x64 | small f12 (low ridge, pointed end) | f3abad7d-fb18-48e8-bdc7-6dcd3c2940de |
| mountain_crag | 64x64 | small f2 (cluster of rock spires) | eb381e52-5b40-4ae3-a778-8f39e7f38c0b |

The 128px call used one 128x128 style mosaic built from the existing `mountain_peaks` and `mountain_peak` (2x2, two of them mirrored; `mountains/style_m.png`). Concept crops were too large to send as base64. The 64px call used `mountain_peaks`, `mountain_peak` and `boulders` as style images. Both calls used the 42-colour palette. All candidates are in `raw/obj_mtn_*`. The unused ones are still in the PixelLab review objects 0dadc699-3296-44f3-8f5d-1e586906e1fc (big) and 8342d461-6a22-4561-b6f6-18a0f6694cc7 (small).

### Preview
`../mountains/preview.png` is 768x512 at 1x (12x8 tiles), built from a 13x9 vertex grid. It shows a rock plateau about 10x6 tiles with both big mountains (twice each), the old `mountain_peak`/`mountain_peaks`, and the new ridges and crags overlapping into a range, with grass and pines around it. Props are drawn back-to-front by their bottom edge.

### Weak pieces
- **The rock ground is a recolour, not generated rock.** It reads as brown scree with boulders. The boulders are dense and fairly uniform, so the ground is busy under mountains. A cleaner fix is a re-run (25 gens), probably with a rock-only palette for the upper terrain or a separately made rock base tile.
- **The rock area is a raised plateau** with a cliff face on its south and side edges. That suits mountains, but you cannot walk from grass onto rock without passing a cliff edge. The north (back) edges are flat, and their outline is a wobbled quadrant split rather than PixelLab's own boundary.
- **The small props are greyer and visibly smaller** than the tan-brown 128px mountains, and the ridges only fill about the lower half of a tile. Mixed together they read as foothills, which works, but the colours don't fully match.
- **The big mountains are lighter and yellower** than the concept's grey peaks. They are closer to the concept than the old 64px peaks, but still warm.

## 6. Flat rock ground (grass_rock, redone)
Section 5's grass_rock came out as a raised plateau: a cliff face on the south and side edges, a hard recoloured line on the north and west edges, and busy boulders. It is replaced by a **flat** set made with the same settings as grass_dirt, so rock now meets grass the way dirt does, with no height change. The old set is kept as `tilesets/grass_rock_plateau/`, unchanged. Work files are in `../mountains/flat/` (`finalize.py`, both candidate sheets, `preview.png`).

**Generations spent: 50** (203 used → 253 used), which is the budget. Two runs failed and were not charged.

| attempt | id | upper prompt (short) | settings | result |
|---|---|---|---|---|
| A | 72c696bd-7f79-4e64-b33f-f1a670084eba | "flat rocky highland ground… grey-brown bare stone and gravel scree with cracks… NO grass, NO boulders, NO cliff" | raggedness 0.4, boundary_seed 3 | Flat and rock on top with soft edges, but the fill tile is large flagstone slabs, which repeat as an obvious diagonal paving grid over big areas. Not used. Sheet: `mountains/flat/a_sheet.png` |
| (failed ×2) | 4e5dd1c1-…, 2c681e42-… | B's prompt plus "NO tiles pattern" | raggedness 0.3, boundary_seed 4 | Server error `'transition'`, no charge |
| **B (used)** | **7d2e843c-6bf9-4466-b87f-81c68b5d5d7c** | see below | raggedness 0.4, boundary_seed 3 | Flat fine gravel, calm, low visible repetition |

### grass_rock (`tilesets/grass_rock/`)
Same files and `wang_map.json` format as the other sets. **Grass is LOWER and rock is UPPER** (corner 1 = rock). No recolour: the sheet is exactly what PixelLab returned, and every pixel is in the 42-colour palette (25 used).

| set | id | lower | upper | settings |
|---|---|---|---|---|
| grass_rock | 7d2e843c-6bf9-4466-b87f-81c68b5d5d7c | grass (`lower_base_tile_id` = 4ba173ac-1f20-4e43-ad3a-5428538d6b34, chained) | rock (base df1b312b-d68b-4f28-9430-3c85366c2d7f) | pro, 64, high top-down, transition_size 0 (no step/slope), raggedness 0.4, boundary_amplitude 0.1, boundary_seed 3, medium shading, highly detailed, the same 42-colour palette |

Upper prompt: "flat bare rocky ground seen from high top-down: fine loose grey-brown gravel and small scree stones evenly scattered, mottled earthy browns and greys, organic and irregular, a few faint hairline cracks, NO large stone slabs, NO flagstones, NO paving, NO grass, NO boulders, NO cliff, flat level ground, painterly pixel art". Transition prompt (it has no effect at size 0): "flat irregular edge where loose gravel and pebbles spread thinly onto the grass, no height change, no cliff, no shadow". The chaining worked: the full-grass tile is pixel-identical to grass_dirt's.

**Edges:** soft and the same on all four sides. Grass tufts overlap the gravel along a ragged line, there is no cliff face, dark ledge or shadow anywhere, and it behaves like grass_dirt. `mountains/flat/preview.png` (12x8 tiles) shows a large rock area with islands and notches.

### Weak pieces
- The gravel is a fairly dark, even grey-brown. It reads as bare rocky ground rather than bright stone, and large areas are a little flat (the price of "not busy").
- The mountain props from section 5 were drawn for the plateau and are unchanged. They sit fine on this ground, but there is no cliff under them any more.
