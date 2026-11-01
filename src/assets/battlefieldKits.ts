// Battlefield kits (see src/game/battlefieldKit.ts): per field kind, the
// painted pieces a battle's scenery is laid out from, made from the
// prompts in the project's art/anime/prompts.md. A kind
// with a kit draws it in place of a painting (battlefieldArt.ts) or the
// code-drawn look; the desert borrows the plains' pieces until it has its
// own. Props (fences, a cart, supplies) stand on the field as
// obstacles instead (PAINTED_OBSTACLES in src/game/tileset.ts). `KIT_URLS` is each piece's image, loaded under its key.
import borderBush1 from './battlefields/plains/border-bush-1.webp';
import borderBush2 from './battlefields/plains/border-bush-2.webp';
import borderTreesLeft from './battlefields/plains/border-trees-left.webp';
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
import forestBorderBush1 from './battlefields/forest/border-bush-1.webp';
import forestBorderBush2 from './battlefields/forest/border-bush-2.webp';
import forestBorderTreesLeft from './battlefields/forest/border-trees-left.webp';
import forestBorderTreesRight from './battlefields/forest/border-trees-right.webp';
import forestDecalMushrooms from './battlefields/forest/decal-mushrooms.webp';
import forestGroundFerns from './battlefields/forest/ground-ferns.webp';
import forestGroundMoss from './battlefields/forest/ground-moss.webp';
import forestGroundPath from './battlefields/forest/ground-path.webp';
import forestHorizon from './battlefields/forest/horizon.webp';
import type { BattlefieldKind } from '../game/battlefields.ts';
import type { BattlefieldKit, KitPiece } from '../game/battlefieldKit.ts';

const piece = (key: string, width: number, height: number): KitPiece => ({ key: `kit-plains-${key}`, size: [width, height] });

const PLAINS = {
  // The ground textures' grass and pebbles drawn finer than the rest of the
  // art, so the props and units standing on them don't look small.
  groundScale: 0.36,
  ground: piece('ground-grass', 1024, 1024),
  horizon: piece('horizon', 1916, 558),
  // Where the treeline's bushes meet the meadow.
  horizonFoot: 0.75,
  // Half the battles have no tree clusters down the sides.
  openChance: 0.5,
  patches: [
    { texture: piece('ground-grass-dry', 1024, 1024), every: 120000, width: [380, 760] as const },
    { texture: piece('ground-dirt', 1024, 1024), every: 260000, width: [260, 520] as const },
  ],
  // Declared at 0.75 of their pixel size so they lie small on the ground.
  decals: [
    piece('decal-tuft-1', 89, 108),
    piece('decal-tuft-2', 98, 122),
    piece('decal-tuft-3', 113, 118),
    piece('decal-pebbles-1', 137, 100),
    piece('decal-pebbles-2', 168, 98),
    piece('decal-flowers', 192, 116),
  ],
  // Declared at 0.85 of their pixel size, about as tall as the old ones.
  trees: [piece('border-trees-left', 403, 995)],
  treesRight: [piece('border-trees-right', 394, 1012)],
  bushes: [piece('border-bush-1', 335, 280), piece('border-bush-2', 302, 206)],
};

const [DRY_GRASS, DIRT] = PLAINS.patches.map((patch) => patch.texture);

const forestPiece = (key: string, width: number, height: number): KitPiece => ({
  key: `kit-forest-${key}`,
  size: [width, height],
});
const FERN_BUSH = forestPiece('border-bush-1', 360, 243);

// The forest set (art/anime/prompts.md, C): a mossy floor with patches of
// ferns and trodden bare path, a wall of old forest behind, tall mixed
// trees down the sides (never left open: it's deep woods) and fern bushes.
const FOREST = {
  groundScale: 0.36,
  ground: forestPiece('ground-moss', 1024, 1024),
  horizon: forestPiece('horizon', 1916, 572),
  // Just above the ferns at the forest wall's foot, so their ragged fringe
  // fades out into the floor.
  horizonFoot: 0.88,
  openChance: 0,
  patches: [
    { texture: forestPiece('ground-ferns', 1024, 1024), every: 150000, width: [380, 760] as const },
    { texture: forestPiece('ground-path', 1024, 1024), every: 240000, width: [260, 520] as const },
  ],
  // Mushrooms, small fern bushes and the plains' pebbles, lying small.
  decals: [
    forestPiece('decal-mushrooms', 130, 63),
    { ...FERN_BUSH, size: [150, 101] as const },
    { ...FERN_BUSH, size: [120, 81] as const },
    PLAINS.decals[3],
    PLAINS.decals[4],
  ],
  // Declared at 0.85 of their pixel size, like the plains' trees.
  trees: [forestPiece('border-trees-left', 397, 1011)],
  treesRight: [forestPiece('border-trees-right', 398, 1006)],
  bushes: [FERN_BUSH, forestPiece('border-bush-2', 305, 209)],
};

export const BATTLEFIELD_KITS: Readonly<Partial<Record<BattlefieldKind, BattlefieldKit>>> = Object.freeze({
  // Anime style (art/anime/prompts.md): cool blue-violet shade, a clear
  // pale-blue haze into the distance.
  plains: { scale: 0.56, light: 0xf2ffc8, shade: 0x34486a, haze: 0xeaf3ff, ...PLAINS },
  // Warm golden shafts of light through the canopy, deep cool green
  // shade, a green-blue haze under the trees.
  forest: { scale: 0.56, light: 0xfff0b0, shade: 0x18343a, haze: 0xd4e8dc, ...FOREST },
  // Until the desert has a set of its own: the plains' pieces as dry,
  // dusty ground, bare earth with tufts of dry grass, in warm light.
  desert: {
    scale: 0.56,
    light: 0xfff0c0,
    shade: 0x6a4a34,
    haze: 0xfff3dc,
    ...PLAINS,
    ground: DIRT,
    patches: [
      { texture: DRY_GRASS, every: 90000, width: [380, 760] },
      { texture: PLAINS.ground, every: 400000, width: [260, 480] },
    ],
  },
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
  [PLAINS.treesRight[0].key]: borderTreesRight,
  [PLAINS.bushes[0].key]: borderBush1,
  [PLAINS.bushes[1].key]: borderBush2,
  [FOREST.ground.key]: forestGroundMoss,
  [FOREST.horizon.key]: forestHorizon,
  [FOREST.patches[0].texture.key]: forestGroundFerns,
  [FOREST.patches[1].texture.key]: forestGroundPath,
  [FOREST.decals[0].key]: forestDecalMushrooms,
  [FERN_BUSH.key]: forestBorderBush1,
  [FOREST.bushes[1].key]: forestBorderBush2,
  [FOREST.trees[0].key]: forestBorderTreesLeft,
  [FOREST.treesRight[0].key]: forestBorderTreesRight,
});
