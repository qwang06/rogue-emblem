// Battlefield kits (see src/game/battlefieldKit.ts): per field kind, the
// painted pieces a battle's scenery is laid out from, made from the
// prompts in the project's art/anime/prompts.md. A kind
// with a kit draws it in place of a painting (battlefieldArt.ts) or the
// code-drawn look. `KIT_URLS` is each piece's image, loaded under its key.
import borderBush1 from './battlefields/plains/border-bush-1.webp';
import borderBush2 from './battlefields/plains/border-bush-2.webp';
import borderTreesLeft2 from './battlefields/plains/border-trees-left-2.webp';
import borderTreesLeft from './battlefields/plains/border-trees-left.webp';
import borderTreesRight2 from './battlefields/plains/border-trees-right-2.webp';
import borderTreesRight from './battlefields/plains/border-trees-right.webp';
import decalFlowers from './battlefields/plains/decal-flowers.webp';
import decalPebbles1 from './battlefields/plains/decal-pebbles-1.webp';
import decalPebbles2 from './battlefields/plains/decal-pebbles-2.webp';
import decalTuft1 from './battlefields/plains/decal-tuft-1.webp';
import decalTuft2 from './battlefields/plains/decal-tuft-2.webp';
import decalTuft3 from './battlefields/plains/decal-tuft-3.webp';
import groundDirt from './battlefields/plains/ground-dirt.webp';
import groundGrassDry from './battlefields/plains/ground-grass-dry.webp';
import groundGrass from './battlefields/plains/ground-grass.webp';
import horizon from './battlefields/plains/horizon.webp';
import type { BattlefieldKind } from '../game/battlefields.ts';
import type { BattlefieldKit, KitPiece } from '../game/battlefieldKit.ts';

const piece = (key: string, width: number, height: number): KitPiece => ({ key: `kit-plains-${key}`, size: [width, height] });

const PLAINS = {
  ground: piece('ground-grass', 1024, 1024),
  horizon: piece('horizon', 3168, 997),
  patches: [
    { texture: piece('ground-grass-dry', 1024, 1024), every: 120000, width: [380, 760] as const },
    { texture: piece('ground-dirt', 1024, 1024), every: 260000, width: [260, 520] as const },
  ],
  // Declared at 0.6 of their pixel size so they lie small on the ground.
  decals: [
    piece('decal-tuft-1', 104, 121),
    piece('decal-tuft-2', 100, 127),
    piece('decal-tuft-3', 91, 108),
    piece('decal-pebbles-1', 193, 100),
    piece('decal-pebbles-2', 190, 90),
    piece('decal-flowers', 206, 131),
  ],
  trees: [piece('border-trees-left', 761, 991), piece('border-trees-left-2', 849, 988)],
  treesRight: [piece('border-trees-right', 652, 973), piece('border-trees-right-2', 660, 987)],
  bushes: [piece('border-bush-1', 292, 217), piece('border-bush-2', 269, 226)],
};

export const BATTLEFIELD_KITS: Readonly<Partial<Record<BattlefieldKind, BattlefieldKit>>> = Object.freeze({
  // Anime style (art/anime/prompts.md): cool blue-violet shade, a clear
  // pale-blue haze into the distance.
  plains: { scale: 0.56, light: 0xf2ffc8, shade: 0x34486a, haze: 0xeaf3ff, ...PLAINS },
});

export const KIT_URLS: Readonly<Record<string, string>> = Object.freeze({
  [PLAINS.ground.key]: groundGrass,
  [PLAINS.horizon.key]: horizon,
  [PLAINS.patches[0].texture.key]: groundGrassDry,
  [PLAINS.patches[1].texture.key]: groundDirt,
  [PLAINS.decals[0].key]: decalTuft1,
  [PLAINS.decals[1].key]: decalTuft2,
  [PLAINS.decals[2].key]: decalTuft3,
  [PLAINS.decals[3].key]: decalPebbles1,
  [PLAINS.decals[4].key]: decalPebbles2,
  [PLAINS.decals[5].key]: decalFlowers,
  [PLAINS.trees[0].key]: borderTreesLeft,
  [PLAINS.trees[1].key]: borderTreesLeft2,
  [PLAINS.treesRight[0].key]: borderTreesRight,
  [PLAINS.treesRight[1].key]: borderTreesRight2,
  [PLAINS.bushes[0].key]: borderBush1,
  [PLAINS.bushes[1].key]: borderBush2,
});
