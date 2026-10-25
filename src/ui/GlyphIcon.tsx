import { PixelIcon } from './PixelIcon.tsx';
import type { ObjectiveKind } from '../game/objectives.ts';

// The game's small UI glyphs, drawn as 8x8 bitmaps like StatIcon (see
// PixelIcon): the header and menu commands, objectives, money and a few
// badges. Colors: `c` the text color (command glyphs, so they follow a
// button's hover and pressed states), `o` ink, `d` dim, `g` gold, `y` pale
// gold, `s` steel, `w` white, `r` red, `b` blue, `n` green, `x` the EXP blue.
// Pair a glyph with its word, as a label beside it or as the button's
// aria-label and title: it never stands for the word on its own.

export type GlyphKind =
  // Header and menu commands.
  | 'auto'
  | 'danger'
  | 'settings'
  | 'home'
  | 'skill'
  | 'item'
  | 'wait'
  | 'undo'
  // Camp commands.
  | 'roster'
  | 'promote'
  | 'book'
  // Objectives (ObjectiveKind) and the turn.
  | ObjectiveKind
  | 'turn'
  // Money and badges.
  | 'gold'
  | 'lock'
  | 'check'
  | 'skull'
  // Unit and weapon readouts.
  | 'mp'
  | 'exp'
  | 'move'
  | 'range'
  | 'weight'
  | 'uses';

const GLYPHS: Record<GlyphKind, readonly string[]> = {
  auto: ['.c......', '.cc.....', '.ccc....', '.cccc...', '.cccc...', '.ccc....', '.cc.....', '.c......'],
  danger: ['........', '..cccc..', '.c....c.', 'c..cc..c', 'c..cc..c', '.c....c.', '..cccc..', '........'],
  settings: ['..c..c..', '.cccccc.', '.cc..cc.', 'cc....cc', 'cc....cc', '.cc..cc.', '.cccccc.', '..c..c..'],
  home: ['...cc...', '..cccc..', '.cccccc.', 'cccccccc', '.cccccc.', '.cc..cc.', '.cc..cc.', '.cc..cc.'],
  skill: ['...b....', '...b....', '.b.b.b..', '..bbb...', 'bbbwbbb.', '..bbb...', '.b.b.b..', '...b....'],
  item: ['...gg...', '..o..o..', '.oddddo.', 'oddddddo', 'oddggddo', 'oddddddo', '.oddddo.', '..oooo..'],
  wait: ['oooooooo', '.o....o.', '..oyyo..', '...oo...', '...oo...', '..o..o..', '.oyyyyo.', 'oooooooo'],
  roster: ['....dd..', '...dddd.', '.oo.dddd', 'oooo.dd.', 'oooo.dd.', '.oo.dddd', 'oooooddd', 'oooooddd'],
  promote: ['...gg...', '..gggg..', '.gggggg.', 'gggggggg', '..gggg..', '..gggg..', '..gggg..', '..gggg..'],
  book: ['oooooo..', 'obbbbbo.', 'obwwwbo.', 'obbbbbo.', 'obwwwbo.', 'obbbbbo.', 'oooooooo', '.owwwwwo'],
  undo: ['..o.....', '.oo.....', 'ooooooo.', '.oo....o', '..o....o', '.......o', '...oooo.', '........'],
  rout: ['s......s', '.s....s.', '..s..s..', '...ss...', '...ss...', '..g..g..', '.gg..gg.', 'g......g'],
  seize: ['.orrrr..', '.orrrrr.', '.orrrr..', '.o......', '.o......', '.o......', '.o......', 'ooo.....'],
  survive: ['oooooooo', '.o....o.', '..oyyo..', '...oo...', '...oo...', '..o..o..', '.oyyyyo.', 'oooooooo'],
  boss: ['........', 'g..gg..g', 'gg.gg.gg', 'gggggggg', 'grggggrg', 'gggggggg', 'gggggggg', '........'],
  turn: ['..gggg..', '.gyyyyg.', 'gyyggyyg', 'gygyygyg', 'gygyygyg', 'gyyggyyg', '.gyyyyg.', '..gggg..'],
  gold: ['..gggg..', '.gyyyyg.', 'gyyggyyg', 'gygyygyg', 'gygyygyg', 'gyyggyyg', '.gyyyyg.', '..gggg..'],
  lock: ['..oooo..', '.o....o.', '.o....o.', 'oooooooo', 'oggooggo', 'oggooggo', 'oggggggo', 'oooooooo'],
  check: ['........', '.......n', '......nn', 'n....nn.', 'nn..nn..', '.nnnn...', '..nn....', '........'],
  skull: ['..oooo..', '.owwwwo.', 'owwwwwwo', 'owowwowo', 'owwwwwwo', '.owwwwo.', '..wowo..', '..oooo..'],
  mp: ['...bb...', '...bb...', '..bbbb..', '.bbbbbb.', '.bwbbbb.', '.bwbbbb.', '..bbbb..', '........'],
  exp: ['...xx...', '...xx...', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '.xx..xx.', '.x....x.', '........'],
  move: ['.ooo....', '.odo....', '.odo....', '.odo....', '.oddooo.', '.oddddo.', '.oddddo.', '.oooooo.'],
  range: ['........', '.....o..', '......o.', 'o.o.oooo', '......o.', '.....o..', '........', '........'],
  weight: ['..oooo..', '.o....o.', '.o....o.', '.oooooo.', 'oddddddo', 'oddddddo', 'oddddddo', '.oooooo.'],
  uses: ['........', '........', 'ooooooo.', 'onnnn.oo', 'onnnn.oo', 'ooooooo.', '........', '........'],
};

export function GlyphIcon({ kind, className = '' }: { kind: GlyphKind; className?: string }) {
  return <PixelIcon rows={GLYPHS[kind]} className={`glyph-icon ${className}`.trim()} />;
}
