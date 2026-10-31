// Battlefield kits (see src/game/battlefieldKit.ts): per field kind, the
// painted pieces a battle's scenery is laid out from, made from the
// prompts in the project's art/battlefields/<kind>-kit/prompts.md. A kind
// with a kit draws it in place of a painting (battlefieldArt.ts) or the
// code-drawn look. `KIT_URLS` is each piece's image, loaded under its key.
import borderBush1 from './battlefields/plains/border-bush-1.webp';
import borderBush2 from './battlefields/plains/border-bush-2.webp';
import borderTreesLeft from './battlefields/plains/border-trees-left.webp';
import decalPebbles1 from './battlefields/plains/decal-pebbles-1.webp';
import decalPebbles2 from './battlefields/plains/decal-pebbles-2.webp';
import decalTuft1 from './battlefields/plains/decal-tuft-1.webp';
import decalTuft2 from './battlefields/plains/decal-tuft-2.webp';
import decalTuft3 from './battlefields/plains/decal-tuft-3.webp';
import foreFernRight from './battlefields/plains/fore-fern-right.webp';
import foreLeavesLeft from './battlefields/plains/fore-leaves-left.webp';
import groundGrass from './battlefields/plains/ground-grass.webp';
import horizon from './battlefields/plains/horizon.webp';
import type { BattlefieldKind } from '../game/battlefields.ts';
import type { BattlefieldKit, KitPiece } from '../game/battlefieldKit.ts';

const piece = (key: string, width: number, height: number): KitPiece => ({ key: `kit-plains-${key}`, size: [width, height] });

const PLAINS = {
  ground: piece('ground-grass', 800, 800),
  horizon: piece('horizon', 3840, 647),
  decals: [
    piece('decal-tuft-1', 164, 150),
    piece('decal-tuft-2', 223, 164),
    piece('decal-tuft-3', 193, 172),
    piece('decal-pebbles-1', 198, 122),
    piece('decal-pebbles-2', 208, 114),
  ],
  trees: [piece('border-trees-left', 950, 1535)],
  bushes: [piece('border-bush-1', 416, 305), piece('border-bush-2', 425, 289)],
  foreground: { left: piece('fore-leaves-left', 822, 891), right: piece('fore-fern-right', 905, 921) },
};

export const BATTLEFIELD_KITS: Readonly<Partial<Record<BattlefieldKind, BattlefieldKit>>> = Object.freeze({
  // Drawn at the 4K plains painting's scale, which the pieces were made to.
  plains: { scale: 0.373, light: 0xf2d27a, shade: 0x2c4a1e, haze: 0xfff0c8, ...PLAINS },
});

export const KIT_URLS: Readonly<Record<string, string>> = Object.freeze({
  [PLAINS.ground.key]: groundGrass,
  [PLAINS.horizon.key]: horizon,
  [PLAINS.decals[0].key]: decalTuft1,
  [PLAINS.decals[1].key]: decalTuft2,
  [PLAINS.decals[2].key]: decalTuft3,
  [PLAINS.decals[3].key]: decalPebbles1,
  [PLAINS.decals[4].key]: decalPebbles2,
  [PLAINS.trees[0].key]: borderTreesLeft,
  [PLAINS.bushes[0].key]: borderBush1,
  [PLAINS.bushes[1].key]: borderBush2,
  [PLAINS.foreground.left.key]: foreLeavesLeft,
  [PLAINS.foreground.right.key]: foreFernRight,
});
