import amqp from 'amqplib';
import { declareAndBind, type SimpleQueueType } from './queues.js';
import ackType from './acktype.js';

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => ackType
): Promise<void> {
  // Call declareAndBind to make sure that the given queue exists and is bound to the exchange
  const [channel, queueResult] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType
  );

  // Use the new ChannelModel to call the consume method
  await channel.consume(
    queueResult.queue,
    (message: amqp.ConsumeMessage | null) => {
      // If the message is null, simply return
      if (message === null) {
        return;
      }

      // Use JSON.parse to parse the message content
      const parsedData: T = JSON.parse(message.content.toString());

      // Call the given handler function with the parsed message content
      const ack = handler(parsedData);

      // Acknowledge the message with channel.ack(message) to remove it from the queue
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
    }
  );
}
