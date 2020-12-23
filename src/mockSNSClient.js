import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

export class MockSQSClient extends EventEmitter {
  publishMocks = {};

  async publish(context, topic, message, options = {}) {
    const mock = this.publishMocks[topic] || {};
    const fn = mock.subscriber;
    if (!fn) {
      (context.gb?.logger || context.logger || console).warn('Publishing to mock topic with no subscriber');
    } else {
      const virtualMessage = {
        Type: 'Notification',
        MessageId: uuid(),
        TopicArn: `arn:aws:sns:us-east-1:123:${topic}`,
        Message: JSON.stringify(message),
        MessageAttributes: {
          correlationid: {
            DataType: 'String',
            StringValue: options.correlationid || context?.headers?.correlationid || 'mock-correlation-id',
          },
          ...options,
        },
      };
      await fn(context, virtualMessage);
    }
  }

  async start(context) {
    this.context = context;
    return this;
  }

  async mockSubscribeTopic(context, topic, handler) {
    const mock = this.publishMocks[topic];
    mock.subscriber = handler;
  }

  resetMocks() {
    Object.values(this.publishMocks).forEach((mock) => {
      delete mock.subscriber;
    });
  }
}
