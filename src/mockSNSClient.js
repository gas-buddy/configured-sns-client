import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { messageHandlerFunc, buildMessage } from './util';

export class MockSNSClient extends EventEmitter {
  publishMocks = {};

  config = {};

  async publish(context, topic, message, options = {}) {
    const mock = this.publishMocks[topic] || {};
    const fn = mock.subscriber;
    if (!fn) {
      (context.gb?.logger || context.logger || console).warn('Publishing to mock topic with no subscriber');
    } else {
      const args = buildMessage(context, { topicArn: `arn:aws:sns:us-east-1:123:${topic}`, message, options });
      await messageHandlerFunc(context, this, fn)(args);
    }
  }

  async start(context) {
    this.context = context;
    return this;
  }

  async mockSubscribeTopic(context, topic, handler) {
    const mock = this.publishMocks[topic] || {};
    mock.subscriber = handler;
    this.publishMocks[topic] = mock;
  }

  resetMocks() {
    Object.values(this.publishMocks).forEach((mock) => {
      delete mock.subscriber;
    });
  }
}
