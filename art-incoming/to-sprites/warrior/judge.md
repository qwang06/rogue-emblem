# Warrior — judge log

Judge: a separate subagent that never saw the prompts. Each time it got the reference sheet plus the attempt's 4 directions side by side at 6x nearest-neighbour (`attempt-N/compare_6x.png`), and was asked for a 0-10 likeness score and the top 3 differences.

Common settings: `create_character_pro_flash`, 32x32, view low top-down, 8 directions, template mannequin. The style image is `ref/warrior_front.png`, uploaded.

## Attempt 1 — score 6
- character_id `0dd67267-0847-4d61-ab28-8f59c135e620`, seed 1, no palette
- style usage: "This is the exact character to recreate: copy its colors, palette, proportions, outline and shading"
- prompt: "Tactics Ogre style Warrior unit, man wearing a big rounded steel kettle helmet with pale blue-white highlights, small face under the helmet brim, blue tunic, tan orange gloves and tan orange boots, whole outfit in blue tones, no weapon. 16-bit SNES tactics RPG sprite, small chibi proportions, single dark outline."
- judge:
  1. The helmet is smaller and conical/pointed (south, north) or reads as a bucket hat (west, east). The original has a big round glossy dome.
  2. The body is thinner and more upright and reads like a generic villager. The white-grey belt band and orange arm accents are mostly missing.
  3. The shading is flatter, with fewer steps and less contrast, and the outline is thinner than the original's thick dark navy.
  - Notes: the palette family and the scale match. North is the weakest (a flat blue block). No direction is broken.

## Attempt 2 — score 5
- character_id `f6c53297-9056-4694-9d27-fe98bce4db12`, seed 2, **palette locked to the 25 colours of ref/warrior_front.png**
- style usage: "This is the exact character to recreate: copy its helmet shape, bulk, colors, outline and shading"
- prompt: "Tactics Ogre style Warrior unit: stocky chunky soldier with a HUGE round dome-shaped steel kettle helmet (round bowl, not pointed) taking up the top third of the sprite, glossy pale blue-white highlight on the dome, wide brim; small face tucked under the brim; thick blue padded tunic with a white-grey belt band at the waist; tan-orange gloves and tan-orange boots; wide sturdy stance. 16-bit SNES tactics RPG sprite, chibi proportions, thick dark navy outline, high-contrast blue shading."
- judge:
  1. The headgear became a wide floppy brimmed hat (safari/bucket), which changes the silhouette. The original is a tight, rounded helmet with a glossy highlight.
  2. South and north are too wide and squat, with stubby legs. The original is slimmer and more dynamic.
  3. The blue fills are flatter, with less white-to-blue highlight contrast, and the face is simplified.
  - Notes: In west and east the brim covers the head. North is clean but boxy. No direction is broken.

## Attempt 3 — score 5
- character_id `1b555010-0d16-4413-9a46-13457f19f05a`, seed 3, palette locked (same 25 colours)
- style usage: "This is the exact character to recreate: copy its round dome helmet without brim, bulk, colors, outline and shading"
- prompt: "Tactics Ogre style Warrior unit: stocky chunky soldier wearing a huge round steel bowl helmet shaped like an upside-down bowl or a big egg dome, NO brim, the dome is as wide as the shoulders and covers the head down to the eyebrows, glossy pale blue-white highlight on top of the dome; small face visible below the helmet edge; thick blue padded tunic with a white-grey belt band at the waist; tan-orange gloves and tan-orange boots; wide sturdy stance. 16-bit SNES tactics RPG sprite, chibi proportions, thick dark navy outline, high-contrast blue shading."
- judge:
  1. The helmet is now a wide mushroom/bowl cap with a flat brim, bulkier and darker, with a weaker highlight. The reference hugs the head.
  2. The body is squat and boxy (about 3 heads tall vs about 4), with arms sticking out and blobby feet. The belt reads as a white rectangle.
  3. The shading is flatter and blotchier, and the outline is thick and uneven.
  - Notes: North is the weakest (wide flat torso). Asking for "stocky/chibi" was a mistake: the reference is slimmer.

## Attempt 4 — score 6 (south 7, west 4, east 4, north 6)
- Two steps:
  1. `create_image_pro` 32x32, seed 4, 64 candidates (10 gens). References were ref/warrior_front.png ("the exact character (front 3/4 view): copy helmet, outfit, colors, proportions, size, outline, shading") and ref/warrior_back.png ("the same character from behind: copy helmet shape and outfit"). The style image was warrior_front. The prompt asked for the same character redrawn standing facing straight toward the viewer, with a "big smooth round glossy steel helmet hugging the head (no brim)" and slim proportions, about 15x25px. Every candidate is in `attempt-4/south_candidates/` (grid: `candidates_grid.png`), and I picked **#2** → `attempt-4/south_picked.png`.
  2. `create_character` mode v3, character_id `04526eec-64ff-4842-90c4-443e4c6ed33c` (1 gen). The reference was the picked south frame. **direction_images pinned the ORIGINAL sprites**: south-west = warrior_front, north-west = warrior_back, south-east/north-east = their mirrors. v3 generated only S/E/N/W.
- judge:
  1. South is close. West and east show a wide, flared bucket/umbrella helmet with a grey rim, which looks like a different hat.
  2. The figure is stiffer and thinner; west and east are very narrow, with tiny legs.
  3. The shading is flatter, with less white-grey chest armour and fewer orange accents. North is a plain blue block.

## Attempt 5 — score 6 (south 6, west 5, east 5, north 6)
- Every direction is hand-picked from `create_image_pro` candidate sheets (64 per call, 10 gens each):
  - south: attempt-4 candidate #2 (as above)
  - west: new call, seed 5, "seen in pure side profile facing LEFT (west)". References: warrior_front, warrior_back and the picked south ("keep this exact identity"); style image warrior_front. Pick **#32** (grid `attempt-5/west_candidates_grid.png`).
  - north: new call, seed 5, "seen from directly BEHIND (back view ... north)". References: warrior_back, warrior_front and the picked south; style image warrior_back. Pick **#0** (grid `attempt-5/north_candidates_grid.png`).
  - east: west mirrored horizontally, as the original game does
- judge:
  1. The west/east helmets are bulkier and flatter (mushroom/bowl) and wider than the body.
  2. The faces are small and pale, with no visor stripe.
  3. The tunic is a darker, flatter navy with fewer gold accents. On north, the grey collar band reads as a cape.

## Attempt 6 — score 5 (south 5, west 5, east 5, north 6)
- The same four frames as attempt 5, run through a free local palette remap (`remap.py`, no generations):
  - HSV saturation x1.35 and value x1.08
  - every pixel snapped to the nearest colour (redmean distance) of the reference palette, taken from ref/<char>_front.png + _back.png
  - dark silhouette-edge pixels set to the original's outline brown #302820
- judge:
  1. The pose is stiff, symmetrical and upright, with a boxy torso and straight arms. The original frames are dynamic and tilted.
  2. The helmet reads as a wider, flatter bucket/brimmed shape, not a round bright dome.
  3. The tunic is darker and flatter blue, with less gold trim. The palette is related but muddier.
  - Notes: The remap did not help the Warrior (6 → 5, within judge noise).

---

# Result

**No attempt reached 7.** Following the brief (cap of about 6 attempts), I kept the best one: **attempt 5** (score 6, tied with attempts 1 and 4). I chose it over 4 because its directions are even (6/5/5/6), where attempt 4 had sides at 4. I chose it over 1 because its helmet, size and palette are much closer. The attempt 6 palette remap did not help the Warrior (6 → 5), so the un-remapped frames are kept.

- Kept base: `base/{south,west,east,north}.png` (= attempt-5)
- PixelLab character: `to-warrior-final` `f8e976b1-f2d4-4843-bc4d-ac13de869b22` (v3 import of the 4 picked frames, 0.25 gen)

## Animations
The judge got `anim_judge_6x.png` (base row plus every final frame at 6x) and scored consistency and readability 0-10.

### Round 1 — template mode — overall 6
- idle = `breathing-idle` (4 frames); walk = `walking-8-frames` keeping frames 0,2,4,6. 1 gen/dir.
- idle S8 W6 E6 N8 | walk S6 W4 E4 N6
- judge: the west/east walks lean and distort, with a sideways-kicked leg and a silhouette that morphs. The side idles shift the arm too much. Template frames also render about 2px smaller than the base, with feet at y≈28.

### Round 2 — skeleton-v3 mode — overall 7 ✅
- Every direction re-done with `mode="skeleton-v3"` on the same clips (`breathing-idle`, `walking-8-frames`), 3 gen/dir. It poses the stored sprite instead of redrawing it, so the frames keep the base's exact palette and full size.
- idle S7 W7 E7 N4 | walk S7 W7 E6 N7
- judge: idle north frames 1-2 had stray sparkle artifacts beside the helmet. Walk east smears a little. Colours, size and proportions match the base.
- Fix: idle north frame 0 replaced with the base north sprite (shifted 1px to the foot line). Its sparkle touched the helmet, so automatic speck removal couldn't separate it. A 3-pixel speck in another frame was removed automatically. One v3 re-roll of walk east was tried (plain, then with the end frame pinned to the base). Both turned the body toward the camera mid-cycle, so the skeleton-v3 walk east was kept.

Final frames: `idle/<dir>_<0-3>.png` and `walk/<dir>_<0-3>.png`, all 32x32 RGBA, with feet on y=30. Raw downloads are in `raw/` (`idle`, `walk` = template; `idle_sk3`, `walk_sk3` = kept; `walk_v3`, `walk_v3loop` = rejected re-rolls).
