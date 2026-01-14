import amqp from 'amqplib';
import { ExchangePerilDirect } from '../internal/routing/routing.js';
import { PauseKey } from '../internal/routing/routing.js';
import type { PlayingState } from '../internal/gamelogic/gamestate.js';
import { publishJSON } from '../internal/pubsub/publishJSON.js';

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

  // Create PlayingState object with IsPaused set to true
  const playingState: PlayingState = {
    isPaused: true,
  };

  publishJSON(channel, ExchangePerilDirect, PauseKey, playingState);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
