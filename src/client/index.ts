import amqp from 'amqplib';
import { clientWelcome } from '../internal/gamelogic/gamelogic.js';
import { declareAndBind } from '../internal/pubsub/queues.js';
import { ExchangePerilDirect, PauseKey } from '../internal/routing/routing.js';

async function main() {
  console.log('Starting Peril client...');

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
  const username = await clientWelcome();
  await declareAndBind(
    connection,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    'transient'
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
