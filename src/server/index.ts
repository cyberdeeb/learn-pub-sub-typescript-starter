import amqp from 'amqplib';

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
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
