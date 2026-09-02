import { validSides } from '../game/engine.js';

// The engine still validates every write. This only chooses the UI interaction.
export function tileIntent(game, tileId) {
  const opening = !game?.board?.placements?.length;
  const sides = opening && game?.forcedOpeningTileId && tileId !== game.forcedOpeningTileId
    ? [] : validSides(tileId, game?.board);
  return { playable: sides.length > 0, sides, automaticSide: sides.length ? (opening ? 'right' : sides.length === 1 ? sides[0] : null) : null };
}
