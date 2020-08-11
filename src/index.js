import { EventEmitter } from 'events';
import { SNS } from 'aws-sdk';

const ENDPOINT_CONFIG = Symbol('SQS Endpoint Config');

export default class ConfiguredSNSClient extends EventEmitter {
  constructor(context, config) {
    super();

    this.config = config;
    this.logger = context.logger;
    const { endpoint, accountId, region } = config;

    if (endpoint || region) {
      let defaultEp = endpoint;
      if (typeof endpoint === 'string') {
        defaultEp = { endpoint, region };
      }
      this.logger.info('Creating SNS endpoint', {
        endpoint: defaultEp?.endpoint || 'unspecified',
        region,
      });
      this.snsClient = new SNS({
        region,
        ...defaultEp,
      });
      this.snsClient[ENDPOINT_CONFIG] = {
        endpoint: defaultEp?.endpoint,
        accountId,
      };
    }
  }

  async start() {
    if (!this.config.baseTopicArn) {
      const result = await this.snsClient.listTopics().promise();
      const { Topics: [{ TopicArn: topic }] } = result;
      this.config.baseTopicArn = topic.split(':').slice(0, 5).join(':');
    }
  }

  getTopicArn(name) {
    if (name.startsWith('arn:aws:')) {
      return name;
    }
    return `${this.config.baseTopicArn}:${name}`;
  }

  async publish(context, topic, message, options = {}) {
    const args = {
      TopicArn: this.getTopicArn(topic),
      Message: JSON.stringify(message),
      ...options,
    };
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
}
