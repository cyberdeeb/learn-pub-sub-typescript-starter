import amqp from 'amqplib';
import { decode } from '@msgpack/msgpack';
import { declareAndBind, type SimpleQueueType } from './queues.js';
import ackType from './acktype.js';

export async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<ackType> | ackType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [channel, queueResult] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    simpleQueueType,
  );

  await channel.consume(
    queueResult.queue,
    async (message: amqp.ConsumeMessage | null) => {
      if (message === null) {
        return;
      }

      try {
        const parsedData: T = unmarshaller(message.content);
        const ack = await handler(parsedData);

        if (ack === ackType.NackRequeue) {
          console.log('Nacking message and requeuing');
          channel.nack(message, false, true);
        } else if (ack === ackType.NackDiscard) {
          console.log('Nacking message and discarding');
          channel.nack(message, false, false);
        } else {
          console.log('Acknowledging message');
          channel.ack(message);
        }
      } catch (err) {
        console.error('Error handling message:', err);
        channel.nack(message, false, false);
      }
    },
  );
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<ackType> | ackType,
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data: Buffer) => JSON.parse(data.toString()) as T,
  );
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<ackType> | ackType,
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data: Buffer) => decode(data) as T,
  );
}
