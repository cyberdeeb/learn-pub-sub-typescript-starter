import amqp, { type Channel } from 'amqplib';

export type SimpleQueueType = 'durable' | 'transient';

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const channel = await conn.createChannel();

  // Determine if queue should be durable based on queueType
  const isDurable = queueType === 'durable';
  const isAutoDelete = !isDurable;
  const isExclusive = !isDurable;

  const queueResult = await channel.assertQueue(queueName, {
    durable: isDurable,
    autoDelete: isAutoDelete,
    exclusive: isExclusive,
  });

  // Bind the queue to the exchange with the routing key
  await channel.bindQueue(queueName, exchange, key);

  return [channel, queueResult];
}
