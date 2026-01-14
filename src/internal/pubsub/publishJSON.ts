import type { ConfirmChannel } from 'amqplib';

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T
): Promise<void> {
  // Serialize the value to JSON bytes
  const jsonBytes = JSON.stringify(value);

  // Create buffer from JSON bytes
  const buffer = Buffer.from(jsonBytes);

  // Use the channel's .publish method to publish the message
  return new Promise((resolve, reject) => {
    ch.publish(
      exchange,
      routingKey,
      buffer,
      { contentType: 'application/json' },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}
