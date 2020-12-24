import tap from 'tap';
import { v4 as uuid } from 'uuid';
import { MockSNSClient } from '../src/index';

const snsHost = process.env.SNS_HOST || 'localhost';
const snsPort = process.env.SNS_PORT || 9911;

const qConfig = {
  region: 'us-east-1',
  accountId: '123456789012',
  endpoint: {
    // ElasticMQ wants "queue" there rather than an account id
    endpoint: `http://${snsHost}:${snsPort}/`,
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    sessionToken: 'token',
  },
  contextFunction(context, message) {
    return {
      ...context,
      headers: { correlationid: message?.MessageAttributes?.CorrelationId?.StringValue },
    };
  },
};

const ctx = {
  logger: console,
  headers: { correlationid: `test-request-${Date.now()}` },
  service: {
    wrapError(e, args = {}) { return Object.assign(e, args); },
  },
};


tap.test('test_mock', async (t) => {
  const snsClient = new MockSNSClient(ctx, qConfig);
  await snsClient.start(ctx);

  const messageKey = uuid();
  let passed;
  const untilPassed = new Promise((accept) => { passed = accept; });
  await snsClient.mockSubscribeTopic(ctx, 'mock-topic', async (req, message, rest) => {
    if (message.key === messageKey) {
      t.ok(true, 'Should receive the first message that was sent');
      t.strictEqual(rest.MessageAttributes.CorrelationId.StringValue, ctx.headers.correlationid, 'CorrelationID should match');
      passed();
    }
  });
  const countDown = 2000;
  const timer = setTimeout(() => {
    t.notOk(true, `Did NOT receive mocked message within ${countDown} ms`);
    passed();
  }, countDown);

  await snsClient.publish(ctx, 'mock-topic', { key: messageKey });
  await untilPassed;
  clearTimeout(timer);
});
