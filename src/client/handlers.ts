import type {
  GameState,
  PlayingState,
} from '../internal/gamelogic/gamestate.js';
import type {
  ArmyMove,
  RecognitionOfWar,
} from '../internal/gamelogic/gamedata.js';
import { handlePause } from '../internal/gamelogic/pause.js';
import { handleMove, MoveOutcome } from '../internal/gamelogic/move.js';
import { handleWar, WarOutcome } from '../internal/gamelogic/war.js';
import ackType from '../internal/pubsub/acktype.js';
import { publishJSON } from '../internal/pubsub/publishJSON.js';
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from '../internal/routing/routing.js';
import type { ConfirmChannel } from 'amqplib';

export function handlerPause(gs: GameState): (ps: PlayingState) => ackType {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write('> ');
    return ackType.Ack;
  };
}

export function handlerMove(
  gs: GameState,
  publishChannel: ConfirmChannel
): (move: ArmyMove) => Promise<ackType> {
  return async (move: ArmyMove) => {
    const outcome = handleMove(gs, move);
    process.stdout.write('> ');

    // Handle MakeWar outcome
    if (outcome === MoveOutcome.MakeWar) {
      const username = gs.getUsername();
      const warRecognition: RecognitionOfWar = {
        attacker: gs.getPlayerSnap(),
        defender: move.player,
      };

      try {
        await publishJSON(
          publishChannel,
          ExchangePerilTopic,
          `${WarRecognitionsPrefix}.${username}`,
          warRecognition
        );
        return ackType.Ack;
      } catch (err) {
        console.error('Error publishing war recognition message:', err);
        return ackType.NackRequeue;
      }
    }

    // Ack if outcome was Safe
    if (outcome === MoveOutcome.Safe) {
      return ackType.Ack;
    }

    // NackDiscard if outcome was SamePlayer or anything else
    return ackType.NackDiscard;
  };
}

export function handlerWar(gs: GameState): (rw: RecognitionOfWar) => ackType {
  return (rw: RecognitionOfWar) => {
    const warResolution = handleWar(gs, rw);
    process.stdout.write('> ');

    switch (warResolution.result) {
      case WarOutcome.NotInvolved:
        return ackType.NackRequeue;
      case WarOutcome.NoUnits:
        return ackType.NackDiscard;
      case WarOutcome.OpponentWon:
        return ackType.Ack;
      case WarOutcome.YouWon:
        return ackType.Ack;
      case WarOutcome.Draw:
        return ackType.Ack;
      default:
        console.error('Unknown war outcome, discarding message');
        return ackType.NackDiscard;
    }
  };
}
