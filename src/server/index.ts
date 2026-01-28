import amqp from 'amqplib';
import { publishJSON } from '../internal/pubsub/publishJSON.js';
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
} from '../internal/routing/routing.js';
import { getInput, printServerHelp } from '../internal/gamelogic/gamelogic.js';
import { SimpleQueueType } from '../internal/pubsub/queues.js';
import { subscribeMsgPack } from '../internal/pubsub/subscribeJSON.js';
import { writeLog, type GameLog } from '../internal/gamelogic/logs.js';
import ackType from '../internal/pubsub/acktype.js';

async function main() {
  const rabbitConnString = 'amqp://guest:guest@localhost:5672/';
  const conn = await amqp.connect(rabbitConnString);
  console.log('Peril game server connected to RabbitMQ!');

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

  const publishCh = await conn.createConfirmChannel();

  await subscribeMsgPack<GameLog>(
    conn,
    ExchangePerilTopic,
    GameLogSlug,
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable,
    async (log: GameLog) => {
      try {
        await writeLog(log);
        process.stdout.write('> ');
        return ackType.Ack;
      } catch (err) {
        console.error('Error writing game log:', err);
        return ackType.NackRequeue;
      }
    },
  );

  // Used to run the server from a non-interactive source, like the multiserver.sh file
  if (!process.stdin.isTTY) {
    console.log('Non-interactive mode: skipping command input.');
    return;
  }
  printServerHelp();

  while (true) {
    const words = await getInput();
    if (words.length === 0) continue;

    const command = words[0];
    if (command === 'pause') {
      console.log('Publishing paused game state');
      try {
        await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
          isPaused: true,
        });
      } catch (err) {
        console.error('Error publishing pause message:', err);
      }
    } else if (command === 'resume') {
      console.log('Publishing resumed game state');
      try {
        await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
          isPaused: false,
        });
      } catch (err) {
        console.error('Error publishing resume message:', err);
      }
    } else if (command === 'quit') {
      console.log('Goodbye!');
      process.exit(0);
    } else {
      console.log('Unknown command');
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
