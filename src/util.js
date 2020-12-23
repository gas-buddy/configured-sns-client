import { v4 as uuid } from 'uuid';

export function messageHandlerFunc(context, snsClient, handler) {
  return async (message) => {
    const { Message, ...rest } = message;
    const callInfo = {
      operationName: 'handleSNSMessage',
      message,
    };
    snsClient.emit('start', callInfo);

    let messageContext = context;
    if (snsClient.config.contextFunction) {
      messageContext = await snsClient.config.contextFunction(context, message);
    }
    const logger = messageContext?.gb?.logger || messageContext.logger;
    const errorWrap = context.service?.wrapError || context.gb?.wrapError || (e => e);

    let parsedMessage;
    try {
      parsedMessage = JSON.parse(Message);
    } catch (error) {
      logger.error('Failed to parse SQS Body as JSON', errorWrap(error));
      snsClient.emit('error', callInfo);
      throw error;
    }
    try {
      await handler(messageContext, parsedMessage, rest);
      snsClient.emit('finish', callInfo);
    } catch (error) {
      logger.error('Failed to handle message', errorWrap(error));
      snsClient.emit('error', callInfo);
      throw error;
    }
  };
}

export function buildMessage(context, { topicArn, message, options = {} }) {
  const { MessageAttributes, correlationid, ...restOfOptions } = options;
  const correlationId = correlationid || context.headers?.correlationid || uuid();
  const attributes = {
    CorrelationId: {
      DataType: 'String',
      StringValue: correlationId,
    },
    ...MessageAttributes,
  };
  return {
    TopicArn: topicArn,
    Message: JSON.stringify(message),
    MessageAttributes: attributes,
    ...restOfOptions,
  };
}