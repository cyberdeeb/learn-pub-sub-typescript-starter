import amqp from 'amqplib';
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
} from '../internal/routing/routing.js';
import { PauseKey } from '../internal/routing/routing.js';
import type { PlayingState } from '../internal/gamelogic/gamestate.js';
import { publishJSON } from '../internal/pubsub/publishJSON.js';
import { getInput, printServerHelp } from '../internal/gamelogic/gamelogic.js';
import { declareAndBind, SimpleQueueType } from '../internal/pubsub/queues.js';

async function main() {
  console.log('Starting Peril server...');
  if (!process.env.RABBITMQ_CONNECTION_STRING) {
    throw new Error(
      'RABBITMQ_CONNECTION_STRING is not defined in environment variables'
    );
  }
  const connectionString = process.env.RABBITMQ_CONNECTION_STRING;
  const connection = await amqp.connect(connectionString);
  console.log('Connected to RabbitMQ');
  process.on('SIGINT', async () => {
    console.log('Closing RabbitMQ connection...');
    await connection.close();
    process.exit(0);
  });

  const channel = await connection.createConfirmChannel();
  console.log('Channel created');

  // Declare exchanges
  await channel.assertExchange(ExchangePerilDirect, 'direct', {
    durable: true,
  });
  await channel.assertExchange(ExchangePerilTopic, 'topic', { durable: true });
  console.log('Exchanges declared');

  // Declare and bind game_logs queue to peril_topic exchange
  await declareAndBind(
    connection,
    ExchangePerilTopic,
    'game_logs',
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable
  );
  console.log('Queue game_logs created and bound to peril_topic exchange');

  // Create PlayingState object with IsPaused set to true
  const playingState: PlayingState = {
    isPaused: true,
  };

  printServerHelp();

  while (true) {
    const input = await getInput('Enter command:\n');
    const command = input[0]?.toLowerCase();

    if (!command) {
      console.log('No command entered. Please try again.');
      continue;
    }

    switch (command) {
      case 'pause':
        playingState.isPaused = true;
        console.log('Game paused.');
        await publishJSON(channel, ExchangePerilDirect, PauseKey, playingState);
        break;
      case 'resume':
        playingState.isPaused = false;
        console.log('Game resumed.');
        await publishJSON(channel, ExchangePerilDirect, PauseKey, playingState);
        break;
      case 'quit':
        console.log('Quitting server...');
        await connection.close();
        process.exit(0);
      case 'help':
        printServerHelp();
        continue;
      default:
        console.log(`Unknown command: ${command}`);
        continue;
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
