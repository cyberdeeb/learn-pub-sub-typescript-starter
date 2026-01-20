import type {
  GameState,
  PlayingState,
} from '../internal/gamelogic/gamestate.js';
import type { ArmyMove } from '../internal/gamelogic/gamedata.js';
import { handlePause } from '../internal/gamelogic/pause.js';
import { handleMove } from '../internal/gamelogic/move.js';

export function handlerPause(gs: GameState): (ps: PlayingState) => void {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write('> ');
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => void {
  return (move: ArmyMove) => {
    handleMove(gs, move);
    process.stdout.write('> ');
  };
}
