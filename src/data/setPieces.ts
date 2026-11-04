// The set pieces the Warband map generator drops into its maps (see
// src/game/setPieces.ts for the format and src/data/README.md for how to
// add one), from setPieces.json. A mistake in the file throws on load,
// naming the piece at fault, which fails src/data/setPieces.test.ts.

import { checkSetPiece, type SetPiece } from '../game/setPieces.ts';
import file from './setPieces.json';

export const SET_PIECES: readonly SetPiece[] = Object.freeze(
  (file.pieces as SetPiece[]).map((piece) => {
    checkSetPiece(piece);
    return Object.freeze({ ...piece, rows: Object.freeze([...piece.rows]) });
  }),
);
