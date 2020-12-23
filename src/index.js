import { EventEmitter } from 'events';
import { SNS, STS } from 'aws-sdk';
import { buildMessage } from './util';

const ENDPOINT_CONFIG = Symbol('SQS Endpoint Config');
export { MockSNSClient } from './mockSNSClient';

export default class ConfiguredSNSClient extends EventEmitter {
  constructor(context, config) {
    super();

    this.config = config;
    this.logger = context.logger;
    const { endpoint, accountId, region, assumedRole } = config;
    if (!accountId) {
      throw new Error('accountId is required to configure SNS client');
    }
    let finalConfig = {};
    if (endpoint || region) {
      let defaultEp = endpoint;
      if (typeof endpoint === 'string') {
        defaultEp = { endpoint, region };
      }
      this.logger.info('Creating SNS endpoint', {
        endpoint: defaultEp?.endpoint || 'unspecified',
        region,
      });
      finalConfig = { region, ...defaultEp };
      this.snsClient = new SNS(finalConfig);
      this.snsClient[ENDPOINT_CONFIG] = {
        ...finalConfig,
        accountId,
      };
    }
    if (!this.snsClient) {
      throw new Error(`Failed to create SNS client for ${JSON.stringify(finalConfig)}`);
    }
    if (assumedRole) {
      this.assumedRole = assumedRole;
    }
  }

  async start() {
    if (this.assumedRole) {
      const sts = new STS({ apiVersion: '2011-06-15' });
      const { Arn: actualRoleArn } = await sts.getCallerIdentity({}).promise();
      if (!(actualRoleArn.includes(this.assumedRole))) {
        throw new Error(`Role ${actualRoleArn} is expected to contain ${this.assumedRole}`);
      }
    }
    if (!this.config.baseTopicArn) {
      const { accountId, region, partition = 'aws' } = this.config;
      this.config.baseTopicArn = `arn:${partition}:sns:${region}:${accountId}`;
    }
    return this;
  }

  getTopicArn(name) {
    if (name.startsWith('arn:aws:')) {
      return name;
    }
    return `${this.config.baseTopicArn}:${name}`;
  }

  async publish(context, topic, message, options = {}) {
    const args = buildMessage(context, { topicArn: this.getTopicArn(topic), message, options });
    return this.snsClient.publish(args).promise();
  }

  async createTopic(context, name, attributes, tags) {
    return this.snsClient.createTopic({
      Name: name,
      Attributes: attributes || {},
      Tags: tags || [],
    }).promise();
  }

  async subscribeTopic(context, topic, protocol, endpoint, attributes) {
    const r = await this.snsClient.subscribe({
      Protocol: protocol,
      TopicArn: this.getTopicArn(topic),
      Attributes: attributes || {},
      Endpoint: endpoint,
      ReturnSubscriptionArn: true,
    }).promise();
    return r.SubscriptionArn;
  }

  async listSubscriptionsByTopic(context, topic, { nextToken, limit = 1000 } = {}) {
    const { NextToken, Subscriptions } = await this.snsClient.listSubscriptionsByTopic({
      TopicArn: this.getTopicArn(topic),
      NextToken: nextToken || undefined,
    }).promise();
    const remaining = limit - Subscriptions?.length || 0;
    if (NextToken && remaining) {
      return Subscriptions.concat(await this.listSubscriptionsByTopic(context, topic, { nextToken: NextToken, limit: remaining }));
    }
    return Subscriptions;
  }
}
