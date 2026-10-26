# Amazon, round 2: side views (west/east)

The goal was TRUE side profiles facing fully west and east, with hair uniformly blonde (no dark-brown "shadow" patch), same palette, outfit and size as `amazon_south.png` (13-15px wide, about 25px tall, feet on y=30). South and north are unchanged.

Judge: a separate blind subagent. It received a 6x sheet (south, new west, new east, north), never saw my prompts, and scored 0-10 on (a) true side profile and (b) same character, palette and outfit, plus uniform blonde hair.
Attempt files are in `../../attempts/amazon-N/`.

## Base attempts
| # | settings | score | notes |
|---|---|---|---|
| 1 | `create_character` v3, reference = south, north pinned, 4 dirs (1 gen) | 5 (a7 b3) | true profile, but long saturated-yellow hair and 30px tall |
| 2 | `create_image_pro` 32x32 seed 21, refs south + north, style = south (10 gens); pick #0, Lab-palette-remapped to south; west = mirror | 3 (a1 b7) | palette good, but reads as a front view |
| 3 | attempt 1 remapped to the south palette (free) | not judged | colour fixed, still too tall with long hair |
| 4 | v3 again, "short bushy hair" (1 gen) | 3 | mushroom hair, no readable face |
| 5 | `create_image_pro` seed 22, refs south (identity) + warrior attempt-1 west (pose only) (10 gens) | rejected unjudged | nearly all front/3-4 candidates |
| 6 | v3 again (1 gen) | rejected unjudged | thin body, hair down the back |
| 7 | v3 head with recoloured hair on the attempt-2 body (free) | 5 | head too big; face flat |
| 8-11 | **hand-drawn pixel by pixel** in the south palette only (free); each version applied the previous judge's notes | 5, 5, 6 (a7 b5), 6.5 (a7 b6) | real profile from v8 on; later versions added nose, eye, internal dark lines, overlapped legs |
| 12 | `create_image_pro` seed 24, refs: v10 hand-drawn profile (pose) + south (style) (10 gens) | rejected unjudged | turned the figure frontal again |
| 12h | hand-drawn v12: hair sweeps back, fuller body, near/far legs shaded apart, warmer shading | 6 (a6 b6) | |
| **13** | **v12 with every red-brown hair shade recoloured to the darkest blonde (#a0833b), so the hair is uniformly blonde** | **6.5 (a6 b7.5)** | head is a clear profile, hair all blonde, scale and outfit match; judge still reads the torso as about 3/4 |

PixelLab's generators kept turning her toward the camera (attempts 2, 4, 5, 6 and 12), so the kept base is hand-drawn. It uses only colours from `amazon_south.png`/`amazon_north.png`, with the outline #302820. The build script is `../../attempts/amazon-13/build.py`; edit the character rows there to tweak it.

**Kept: attempt 13** → `base/west.png`, `base/east.png` (east = exact mirror). Best score 6.5, below the 7 target.

## Animations
PixelLab character `r2-amazon-final` `c326e133-f727-47dd-b4a5-206749af6e09` (v3 import of S + the v12 sides + N, 0.25 gen). Only west was animated; east is mirrored.
- **idle** = base with rows 0-18 shifted down 0,0,1,1 px (free).
- **walk** = skeleton-v3 `walking-8-frames` (3 gens); the legs (rows ≥24) of frames 2,4,6,0 are snapped to the base palette and composited under the base upper body, which drops 1px on the stride frames.
- Judge: **idle 7 ✅, walk 6**. The walk's stride frames 1 and 3 look alike (weak near/far leg swap), and the passing frames are narrower.

Generations: base 1+10+1+10+1+10 = 33; animations 0.25+3 = 3.25; total ≈ 36.25.
