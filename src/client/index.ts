import amqp from 'amqplib';
import { GameState } from '../internal/gamelogic/gamestate.js';
import { declareAndBind, SimpleQueueType } from '../internal/pubsub/queues.js';
import { subscribeJSON } from '../internal/pubsub/subscribeJSON.js';
import { ExchangePerilDirect, PauseKey } from '../internal/routing/routing.js';
import { commandSpawn } from '../internal/gamelogic/spawn.js';
import { commandMove } from '../internal/gamelogic/move.js';
import { handlerPause } from './handlers.js';
import {
  clientWelcome,
  commandStatus,
  getInput,
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
    })
  );

  const username = await clientWelcome();

  await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient
  );

  const gs = new GameState(username);

  // Subscribe to pause/resume messages
  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    `pause.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gs)
  );

  while (true) {
    const words = await getInput();
    if (words.length === 0) {
      continue;
    }
    const command = words[0];
    if (command === 'move') {
      try {
        commandMove(gs, words);
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
      console.log('Spamming not allowed yet!');
    } else {
      console.log('Unknown command');
      continue;
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
