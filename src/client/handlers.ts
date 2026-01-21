import type {
  GameState,
  PlayingState,
} from '../internal/gamelogic/gamestate.js';
import type { ArmyMove } from '../internal/gamelogic/gamedata.js';
import { handlePause } from '../internal/gamelogic/pause.js';
import { handleMove, MoveOutcome } from '../internal/gamelogic/move.js';
import ackType from '../internal/pubsub/acktype.js';

export function handlerPause(gs: GameState): (ps: PlayingState) => ackType {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write('> ');
    return ackType.Ack;
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => ackType {
  return (move: ArmyMove) => {
    const outcome = handleMove(gs, move);
    process.stdout.write('> ');

    // Ack if outcome was Safe or MakeWar
    if (outcome === MoveOutcome.Safe || outcome === MoveOutcome.MakeWar) {
      return ackType.Ack;
    }

    // NackDiscard if outcome was SamePlayer or anything else
    return ackType.NackDiscard;
  };
}
