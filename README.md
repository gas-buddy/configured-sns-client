configured-sns-client
==========================

![Node CI](https://github.com/gas-buddy/configured-sns-client/workflows/Node%20CI/badge.svg)

A small wrapper around the AWS SNS sdk to allow configuration from confit. This module focuses on publishing and consuming messages. Topic configuration for SNS is done OUTSIDE of this module (assumedly will be terraform or similar).

Usage
=====
To send a message, you must configure this module in your service

```
{
  "region": "us-east-1",
  "accountId": "1234",
  "module": "require:@gasbuddy/configured-sns-client"
}
```

Now, you can publish to a topic (Note: Your service's role must have permission to pubish to the SNS topic)

```
  configuredSnsClient.publish(req, 'topic', { some: 'message' });

  // OR (with message attributes)
  configuredSnsClient.publish(req, 'topic', { some: 'message' }, {
      MessageAttributes: {
        Event_Type: {
          DataType: 'String.Array',
          StringValue: JSON.stringify(['user.registered']),
        },
      },
  });
```

You can set `assumedRole` to assert that your service has that role at the time of hydration
```
  {
  "assumedRole": "abc-topic-publisher",
  "region": "us-east-1",
  ....
}
```