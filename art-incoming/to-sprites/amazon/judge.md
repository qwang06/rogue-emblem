# Amazon — judge log

Judge: a separate subagent that never saw the prompts. Each time it got the reference sheet plus the attempt's 4 directions side by side at 6x nearest-neighbour (`attempt-N/compare_6x.png`), and was asked for a 0-10 likeness score and the top 3 differences.

Common settings: `create_character_pro_flash`, 32x32, view low top-down, 8 directions, template mannequin. The style image is `ref/amazon_front.png`, uploaded.

## Attempt 1 — score 3
- character_id `e207a95f-806d-4ca8-8baf-918e3bc5d69d`, seed 1, no palette
- style usage: "This is the exact character to recreate: copy its colors, palette, proportions, outline and shading"
- prompt: "Tactics Ogre style Amazon unit, young woman with big messy shoulder-length golden blonde hair, green headband, tan skin, light blue short scarf/top, white short loincloth skirt, bare arms and bare legs, green boots, no weapon. 16-bit SNES tactics RPG sprite, small chibi proportions, single dark outline."
- judge:
  1. The palette is garish (saturated yellow hair, orange bodysuit, neon green boots). The original is muted and earthy.
  2. The outfit is wrong: an orange/gold bodysuit and a gem circlet instead of a blue-and-white top, a white loincloth and a wrapped green headband.
  3. The hair is a long, smooth yellow curtain to the waist rather than messy, spiky shoulder-length hair. The body is slimmer, the outline is too black and thick, and the figure sits small and low.
  - Notes: West and east are the weakest (a flat yellow-orange column). North is passable.

## Attempt 2 — score 6
- character_id `0215d404-ee7b-459d-8278-509fe79daa24`, seed 2, **palette locked to the 31 colours of ref/amazon_front+back.png**
- style usage: "This is the exact character to recreate: copy its hair, outfit, colors, proportions, outline and shading"
- prompt: "Tactics Ogre style Amazon unit: young woman with big messy shoulder-length dull golden-blonde hair (muted honey blonde with brown shading), thin green headband, tan skin, light blue short scarf top, white short loincloth skirt, bare tan arms and bare tan legs, green boots, no weapon. 16-bit SNES tactics RPG sprite, chibi proportions, single dark outline, muted earthy colors."
- judge:
  1. The hair colour is close, but the hair is rounder and smoother rather than spiky, and the headband is only partly visible. In north the hair is a big blob covering the whole back.
  2. The outfit is simplified: the top is smaller, the legs are thinner, and there is less tan skin and brown detail.
  3. The side views are weak: an oversized hair mass leans to one side over a skinny body, so the pose reads as hunched.
  - Notes: South passes as the same character. West and east lean toward broken.

## Attempt 3 — score 5
- character_id `13819f65-65ac-4c52-8e47-d1017350a413`, seed 3, palette locked (same 31 colours)
- style usage: "This is the exact character to recreate: copy its spiky shoulder-length hair, headband, outfit, colors, proportions, outline and shading"
- prompt: "Tactics Ogre style Amazon unit: athletic young woman, head of spiky tousled shoulder-length golden-blonde hair that ends at the shoulders (hair does NOT cover the back or body), clearly visible green headband wrapped around the forehead, tan skin, light blue short scarf top over the chest, white short loincloth skirt with a brown belt, bare tan arms and sturdy bare tan legs, bright green boots, no weapon. 16-bit SNES tactics RPG sprite, chibi proportions with sturdy limbs, single dark brown outline, muted earthy colors."
- judge:
  1. The hair became a huge spiky lion mane, much larger than the head, and the headband is only a thin line.
  2. The outfit is simplified and blocky, and the strong dark outline gives a "wrestler" look.
  3. The pose is stiff and symmetrical with a big head, short limbs and straight legs. The reference is slender and long-legged.
  - Notes: South is the closest. North is broken: the mane covers the whole torso.

> Approach change after attempt 3: text-to-character with pro_flash keeps drifting toward chibi. Next, draw a straight-on south frame with create_image_pro using the original frames as references, then build the character with v3, with the ORIGINAL diagonal sprites pinned as fixed direction images.

## Attempt 4 — score 5 (south 5, west 5, east 5, north 5)
- Two steps:
  1. `create_image_pro` 32x32, seed 4, 64 candidates (10 gens). References were ref/amazon_front.png ("the exact character (front 3/4 view): copy hair, headband, outfit, colors, proportions, size, outline, shading") and ref/amazon_back.png ("the same character from behind: copy hair shape and outfit"). The style image was amazon_front. The prompt asked for the same character redrawn standing facing straight toward the viewer, about 15x25px. Every candidate is in `attempt-4/south_candidates/` (grid: `candidates_grid.png`), and I picked **#49** → `attempt-4/south_picked.png`.
  2. `create_character` mode v3, character_id `72211ff5-a22c-44b6-b3e8-584179258aeb` (1 gen). The reference was the picked south frame. **direction_images pinned the ORIGINAL sprites**: south-west = amazon_front, north-west = amazon_back, south-east/north-east = mirrors. v3 generated only S/E/N/W.
- judge:
  1. The hair is a smoother, paler tan bob, not a spiky golden mane. The headband is nearly missing on west, east and north.
  2. West and east lose the skirt and look tunic-like. North shows only hair and a skirt, with no blue top.
  3. The colours are washed out and the contrast is lower. The green boots and proportions are good.

## Attempt 5 — score 6 (south 6, west 6, east 6, north 5)
- Every direction is hand-picked from `create_image_pro` candidate sheets (64 per call, 10 gens each):
  - south: attempt-4 candidate #49
  - west: new call, seed 5, "seen in pure side profile facing LEFT (west)". References: amazon_front, amazon_back and the picked south ("keep this exact identity"); style image amazon_front. Pick **#16** (grid `attempt-5/west_candidates_grid.png`). The model drew a 3/4-left view rather than a true profile.
  - north: new call, seed 5, "seen from directly BEHIND ... headband knot visible at the back". References: amazon_back, amazon_front and the picked south; style image amazon_back. Pick **#2** (grid `attempt-5/north_candidates_grid.png`), the one showing the headband.
  - east: west mirrored horizontally
- judge:
  1. The hair is shorter, tidier and darker (brownish-tan bowl), with a muddy green band. The original is big, spiky and golden.
  2. The outfit is simpler, the limbs are thinner, and there are green bracers the reference lacks.
  3. The colours are muted and desaturated overall. North is a tan helmet-like blob.

> The judge's main complaint on attempt 5 was COLOUR (muted/dark, off-palette: 38-45 colours each, a near-black outline, tan hair).

## Attempt 6 — score 6 (south 6, west 6, east 6, north 5)
- The same four frames as attempt 5, run through a free local palette remap (`remap.py`, no generations):
  - HSV saturation x1.35 and value x1.08
  - every pixel snapped to the nearest colour (redmean distance) of the reference palette, taken from ref/<char>_front.png + _back.png
  - dark silhouette-edge pixels set to the original's outline brown #302820
- judge:
  1. The pose is upright and symmetrical, with straight arms, against the original's lively mid-stride frames.
  2. The hair and green band are close in colour, but the hair is a more uniform helmet-like mass, with a darker fringe and less spiky volume.
  3. The bodice reads as a vest and the legs are straight. The green boots are a good match.
  - Notes: The colours (gold hair, green band/boots, blue top, white skirt) are reasonably close. North is the weakest (a rounded hair cap).

---

# Result

**No attempt reached 7.** Following the brief (cap of about 6 attempts), I kept the best one: **attempt 6** (score 6, tied with 2 and 5). I chose it because it has the even per-direction scores (6/6/6/5) and the colours closest to the original. It uses the attempt-5 frames remapped onto the original palette.

- Kept base: `base/{south,west,east,north}.png` (= attempt-6)
- PixelLab character: `to-amazon-final` `117b6dfa-71c1-4874-8314-c74df4232d21` (v3 import of the 4 frames, 0.25 gen)

## Animations
The judge got `anim_judge_6x.png` (base row plus every final frame at 6x) and scored consistency and readability 0-10.

### Round 1 — template mode — overall 5
- idle = `breathing-idle` (4 frames); walk = `walking-8-frames` keeping frames 0,2,4,6. 1 gen/dir. The frames were palette-remapped like the base.
- idle S7 W6 E5 N7 | walk S4 W4 E4 N5
- judge: the walks morph and shimmer between frames (colour speckle, stray pixels), and the side idles jitter.

### Round 2 — skeleton-v3 mode — overall 5 (kept)
- Every direction re-done with `mode="skeleton-v3"` (3 gen/dir). The frames keep the base's exact palette (no remap needed) and full size.
- idle S6 W6 E6 N7 | walk S6 W4 E4 N6
- judge: walk west/east still thin out into a narrower silhouette in the stride frames. The idles are usable but busy. Walk south/north are acceptable.
- Extra tries on the side walks, all rejected after inspection:
  - v3 custom walk (1 gen each): the figure turns toward the camera and the hair morphs mid-cycle
  - v3 with the end frame pinned to the base (1 gen each): still turns mid-cycle
  - skeleton-v3 with the 6-frame `walk` clip (3 gen each): smaller strides, same thinning
- **The side walks remain below 7 (judge 4).** The south/north walks and all idles are 6-7.

Final frames: `idle/<dir>_<0-3>.png` and `walk/<dir>_<0-3>.png`, all 32x32 RGBA, with feet on y=30. Raw downloads are in `raw/` (`idle`, `walk` = template; `idle_sk3`, `walk_sk3` = kept; `walk_v3`, `walk_v3loop`, `walk2_sk3` = rejected re-rolls).
