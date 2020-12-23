import tap from 'tap';
import SnsClient from '../src/index';

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


tap.test('test_config', async (t) => {
  const sns = new SnsClient(ctx, qConfig);
  t.ok(sns, 'Should create the client');
  await sns.start();

  await sns.createTopic(ctx, 'infra-test');
  await sns.subscribeTopic(ctx, 'infra-test', 'file', 'file://tmp?fileName=infra-test.log');
  await sns.publish(ctx, 'infra-test', { test: true });
});
