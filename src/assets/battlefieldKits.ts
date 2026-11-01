// Battlefield kits (see src/game/battlefieldKit.ts): per field kind, the
// painted pieces a battle's scenery is laid out from, made from the
// prompts in the project's art/anime/prompts.md. A kind
// with a kit draws it in place of a painting (battlefieldArt.ts) or the
// code-drawn look. Props (fences, a cart, supplies) stand on the field as
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
import desertBorderBush1 from './battlefields/desert/border-bush-1.webp';
import desertBorderBush2 from './battlefields/desert/border-bush-2.webp';
import desertBorderTreesLeft from './battlefields/desert/border-trees-left.webp';
import desertBorderTreesRight from './battlefields/desert/border-trees-right.webp';
import desertDecalAgave from './battlefields/desert/decal-agave.webp';
import desertDecalSkull from './battlefields/desert/decal-skull.webp';
import desertDecalStones from './battlefields/desert/decal-stones.webp';
import desertDecalTuft from './battlefields/desert/decal-tuft.webp';
import desertGroundCracked from './battlefields/desert/ground-cracked.webp';
import desertGroundPebbles from './battlefields/desert/ground-pebbles.webp';
import desertGroundSand from './battlefields/desert/ground-sand.webp';
import desertHorizon from './battlefields/desert/horizon.webp';
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


const desertPiece = (key: string, width: number, height: number): KitPiece => ({
  key: `kit-desert-${key}`,
  size: [width, height],
});

// The desert set (art/anime/prompts.md, D): rippled sand with patches of
// pebbly ground and cracked clay, far dunes and red mesas behind, sandstone
// pillars with dead trees down the sides, dry scrub and agave.
const DESERT = {
  groundScale: 0.36,
  ground: desertPiece('ground-sand', 1024, 1024),
  horizon: desertPiece('horizon', 1916, 541),
  // Where the far dunes meet the open sand.
  horizonFoot: 0.75,
  openChance: 0.5,
  patches: [
    { texture: desertPiece('ground-pebbles', 1024, 1024), every: 120000, width: [380, 760] as const },
    { texture: desertPiece('ground-cracked', 1024, 1024), every: 220000, width: [260, 560] as const },
  ],
  // Declared at 0.75 of their pixel size so they lie small on the ground.
  decals: [
    desertPiece('decal-tuft', 108, 77),
    desertPiece('decal-stones', 104, 50),
    desertPiece('decal-skull', 134, 68),
    desertPiece('decal-agave', 142, 85),
  ],
  // Declared at 0.85 of their pixel size, like the plains' trees.
  trees: [desertPiece('border-trees-left', 371, 1008)],
  treesRight: [desertPiece('border-trees-right', 393, 997)],
  bushes: [desertPiece('border-bush-1', 289, 248), desertPiece('border-bush-2', 317, 189)],
};

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
  // Hot bright light, warm shade tinted toward blue-violet, a pale warm
  // haze over the far sand.
  desert: { scale: 0.56, light: 0xfff4d0, shade: 0x5a4060, haze: 0xfff1dc, ...DESERT },
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
  [DESERT.ground.key]: desertGroundSand,
  [DESERT.horizon.key]: desertHorizon,
  [DESERT.patches[0].texture.key]: desertGroundPebbles,
  [DESERT.patches[1].texture.key]: desertGroundCracked,
  [DESERT.decals[0].key]: desertDecalTuft,
  [DESERT.decals[1].key]: desertDecalStones,
  [DESERT.decals[2].key]: desertDecalSkull,
  [DESERT.decals[3].key]: desertDecalAgave,
  [DESERT.trees[0].key]: desertBorderTreesLeft,
  [DESERT.treesRight[0].key]: desertBorderTreesRight,
  [DESERT.bushes[0].key]: desertBorderBush1,
  [DESERT.bushes[1].key]: desertBorderBush2,
});
