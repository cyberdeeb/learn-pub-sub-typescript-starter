import amqp from 'amqplib';
import { GameState } from '../internal/gamelogic/gamestate.js';
import { declareAndBind, SimpleQueueType } from '../internal/pubsub/queues.js';
import { subscribeJSON } from '../internal/pubsub/subscribeJSON.js';
import { publishJSON, publishMsgPack } from '../internal/pubsub/publishJSON.js';
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  PauseKey,
  ArmyMovesPrefix,
  WarRecognitionsPrefix,
  GameLogSlug,
} from '../internal/routing/routing.js';
import { commandSpawn } from '../internal/gamelogic/spawn.js';
import { commandMove } from '../internal/gamelogic/move.js';
import { handlerPause, handlerMove, handlerWar } from './handlers.js';
import {
  clientWelcome,
  commandStatus,
  getInput,
  getMaliciousLog,
  printClientHelp,
  printQuit,
} from '../internal/gamelogic/gamelogic.js';

async function main() {
  const rabbitConnString = 'amqp://guest:guest@localhost:5672/';
  const conn = await amqp.connect(rabbitConnString);
  console.log('Peril game client connected to RabbitMQ!');

  ['SIGINT', 'SIGTERM'].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await conn.close();
        console.log('RabbitMQ connection closed.');
      } catch (err) {
        console.error('Error closing RabbitMQ connection:', err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const username = await clientWelcome();

  await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
  );

  const gs = new GameState(username);

  // Create a channel for publishing
  const publishChannel = await conn.createConfirmChannel();

  // Subscribe to pause/resume messages
  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    `pause.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gs),
  );

  // Subscribe to army moves from other players
  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${username}`,
    `${ArmyMovesPrefix}.*`,
    SimpleQueueType.Transient,
    handlerMove(gs, publishChannel),
  );

  // Subscribe to war messages from any player
  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    'war',
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(gs, publishChannel),
  );

  while (true) {
    const words = await getInput();
    if (words.length === 0) {
      continue;
    }
    const command = words[0];
    if (command === 'move') {
      try {
        const move = commandMove(gs, words);
        // Publish the move to other players
        await publishJSON(
          publishChannel,
          ExchangePerilTopic,
          `${ArmyMovesPrefix}.${username}`,
          move,
        );
        console.log('Move published successfully');
      } catch (err) {
        console.log((err as Error).message);
      }
    } else if (command === 'status') {
      commandStatus(gs);
    } else if (command === 'spawn') {
      try {
        commandSpawn(gs, words);
      } catch (err) {
        console.log((err as Error).message);
      }
    } else if (command === 'help') {
      printClientHelp();
    } else if (command === 'quit') {
      printQuit();
      process.exit(0);
    } else if (command === 'spam') {
      if (!words[1]) {
        console.log('Usage: spam <number_of_moves>');
        continue;
      }
      const spamCount = parseInt(words[1], 10);
      if (isNaN(spamCount) || spamCount <= 0) {
        console.log('Please provide a valid positive number for spam count.');
        continue;
      }
      console.log(`Spamming ${spamCount} moves...`);
      for (let i = 0; i < spamCount; i++) {
        const maliciousLog = getMaliciousLog();
        await publishMsgPack(
          publishChannel,
          ExchangePerilTopic,
          `${GameLogSlug}.${username}`,
          {
            username,
            message: maliciousLog,
            currentTime: new Date(),
          },
        );
      }
    } else {
      console.log('Unknown command');
      continue;
    }
  }
}

export async function publishGameLog(
  channel: amqp.ConfirmChannel,
  username: string,
  message: string,
): Promise<void> {
  const gameLog = {
    username,
    message,
    currentTime: new Date(),
  };

  await publishMsgPack(
    channel,
    ExchangePerilTopic,
    `${GameLogSlug}.${username}`,
    gameLog,
  );
}
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
