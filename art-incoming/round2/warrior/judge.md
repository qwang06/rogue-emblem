# Warrior, round 2: side views (west/east)

The goal was to redraw the west and east views as true side profiles at the same scale as `warrior_south.png` and `warrior_north.png`: about 24px tall, helmet the same width as in the south view, feet on y=30. South and north are unchanged.

Judge: a separate blind subagent. It received a 6x sheet (south, new west, new east, north), never saw my prompts, and scored 0-10 on (a) true side profile and (b) same character, scale and palette as south/north.
Attempt files are in `../../attempts/warrior-N/` (`compare_6x.png`; candidate grids in `grid.png`).

## Base attempts
| # | settings | score | notes |
|---|---|---|---|
| 1 | `create_character` v3, reference = south, north pinned via direction_images, 4 dirs (1 gen). West used; east = mirror | 6.5, then 5 on re-judge | true profile; helmet slightly narrow; forward arm reads as a punch; 25px tall |
| 2 | `create_image_pro` 32x32, seed 21; refs south (identity/scale) + north; style = south (10 gens). Pick #8 (faces right) as east, west = mirror | 4 | face reads front/3-4 |
| 3 | v3 again, prompt stressing the dome width (1 gen) | rejected unjudged | mushroom-brim helmet on both sides |
| 4 | `create_image_pro` seed 23; refs south (identity + scale, "helmet ~13px") + attempt-1 west as **pose-only** reference (10 gens). Pick #15 | 6 | thin body; slightly cap-like helmet |
| 5 | same sheet, pick #11 | 5 | mid-stride legs |
| **6** | **same sheet, pick #8** | **7** ✅ | clean idle profile, one eye, stance matches south, helmet close to south width; 24px tall (y 7-30) like north |

**Kept: attempt 6** → `base/west.png`, `base/east.png` (east = exact horizontal mirror of west).

## Animations
PixelLab character `r2-warrior-final` `b4d946ef-a4b8-4c0e-b48f-42507be265c9` (v3 import of S/W/E/N, 0.25 gen). Only west was animated; every east frame is the mirror of its west frame.

| try | settings | idle | walk | notes |
|---|---|---|---|---|
| A | skeleton-v3 `breathing-idle` + skeleton-v3 `walking-4-frames` (3+3 gens) | 6 | 4 | walk frames 1/3 identical closed poses; the strides don't alternate |
| B | idle as A with frame 0 replaced by the base; walk = skeleton-v3 `walking-8-frames` (3 gens), frames 0,2,4,6; all frames snapped to the base palette | 4.5 | 5.5 | swapping in frame 0 made the idle pop; generated torso thinner than the base |
| **C (kept)** | **idle** = base with rows 0-18 (head and chest) shifted down 0,0,1,1 px (free). **walk** = generated legs (rows ≥24) from walking-8 frames 2,3,6,7, snapped to the base palette, under the base upper body, which drops 1px on the stride frames (free) | 4, then 6 | 5, then 5 | see the note below |

Note on C: the judge said the helmet is "redrawn" in idle frames 3-4. Those frames are the base pixels shifted down 1px (verified pixel-identical), so this is a misread of the static 6x sheet. It also said base east faced west; checked, and `base/east.png` is the exact mirror of west, facing right. The remaining real weakness is the walk: dark legs on a dark tunic make the alternation faint at 1x. Leg widths per frame are 8-10px against the base's 8px.

**Result: base 7 ✅. Animations idle 6 / walk 5 (judge), below the 7 target.**

Generations: base 1+10+1+10 = 22; animations 0.25+3+3+3 = 9.25; total ≈ 31.25.
Raw downloads are in `../../raw/warrior/` (`idle_sk3`, `walk_sk3` = 4-frame clip, `walk8_sk3` = 8-frame clip; `*_snap.png` = palette-snapped).
