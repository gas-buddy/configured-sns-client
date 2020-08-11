configured-sqs-client
==========================

![Node CI](https://github.com/gas-buddy/configured-sqs-client/workflows/Node%20CI/badge.svg)

A small wrapper around the AWS SQS sdk and sqs-consumer to allow configuration from confit.
Unlike configured-rabbitmq-client, most queue configuration for SQS is done OUTSIDE of the
infrastructure here (assumedly will be terraform or similar). So this module focuses on publishing
and consuming messages, but with as similar an configuration specification as possible.

Usage
=====
See the test directory for sample usage. To send a message, you must configure a logical queue, something like:

```
{
  region: 'us-east-1',
  queues: {
    basic: 'basic_queue'
  }
}
```

Now, you can publish to this queue using:

```
  configuredSqsClient.publish(req, 'basic', { some: 'message' });
```

To receive this message, you would subscribe:

```
  sqs.subscribe(context, 'basic', async (req, message, envelope) => {
    // Do stuff, await stuff, throw errors, whatever
  });
```

If your handler throws an error, the redrive policy of the queue takes over. However, if your handler
marks that error with a property "deadLetter" that is either true or the name of another queue, the
failed attempt will be published on the target queue (either the deadLetter property of the queue that
was configured in your configured-sqs-client config, or the queue specified in the deadLetter error property).
