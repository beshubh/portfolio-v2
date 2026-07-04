---
title: Improving resilience at LimeChat
date: 2026-06-01
summary: fallbacks for everything.
tags: [reliability, distributed-systems, celery]
status: published
---

In this article I am going to discuss some techniques for improving resilience and fault tolerant of your backend systems and microservices.

This article is aimed for

- software engineers.
- technical product managers.
- anyone interested in distributed systems concepts.

If you have ever worked with a production backend systems or microservices you will have definitely encountered some issues where one or all of your systems just go down because of too much traffic. The name for each of these issues may vary but pattern remains the same.

- too many requests on some single service causing it go down.
- too many messages to a queue causing queue to blow up.
- too many calls to DB causing DB to go down.
- slow consumers causing a blow up in queue and in turn causing producers to go down.

> Do not worry if you have not worked in production yet! you will still be able to follow along.

When such a situation arrives you might wonder how in the world are we supposed to handle this? and if you are on-call at the moment, you do feel a little helpless.

## Handling Overload Gracefully

First thing is.

System is not infinitely scalable, you are bounded by physics, the capacity of your NodePool, the RAM and CPU at your disposal.

When your traffic pattern shows an anomalous behaviour it is a signal to you that we do not have enough resources to handle such traffic.

> Anomalous behaviour does not means bad traffic, just that the service is not configured to handle such traffic. Traffic might as well be a change in user behaviour, special event etc.

The first thing that you can do is to give your system more resources, really simple.

More CPU and more RAM should just solve your issue, this is not entirely true but to a some extent this will work. And you do not have to always provision your services with high resources you can do this elastically with kubernetes.

Provisioning higher resources will work for stateless services like a HTTP server or even state-full HTTP servers with some extra care. But, when you try to apply this strategy to things like queues, caches and databases it won’t do you any good because upsizing an already overwhelmed DB will reduce its capacity to handle queries/transactions or completely halt processing incoming queries while upsizing, which we do not want as we are already facing an outage. And another reason its not a good strategy is that, upsizing a DB instance is very expensive cost wise as well.

### Circuit breakers

Circuit breaker prevents a service from overwhelming a struggling downstream system. When the breaker detects signs of distress such as high latency or error rates it ‘trips’ and temporarily halts traffic, allowing the database, cache, or service to recover instead of crashing entirely.

This concept is very simple and you can find implementation of circuit breakers in all different programming languages on github.

We use [pybreaker](https://github.com/danielfm/pybreaker) for our python projects and [opossum](https://github.com/nodeshift/opossum) for our typescript/node.js backend.

The goal is to fail fast rather than hammering the target service down with more and more requests.

*TypeScript example*

```
class KafkaProducerService {
    private producer: Producer;;
    private publishBreaker: any;

    constructor() {
        this.producer = kafka.producer({...});

        this.publishBreaker = new CircuitBreaker(
            async (record: ProducerRecord): Promise<RecordMetadata[]> => {
                await this.connect();
                return this.producer.send({
                    timeout: 10000,
                    ...record
                });
            },
            {
                timeout: 12000,
                errorThresholdPercentage: 50,
                resetTimeout: 15000,
                volumeThreshold: 5,
            },
        );

        this.publishBreaker.on('open', () => {
            logger.error('[circuit: kafka-publish] Opened; publish attempts will be dropped until recovery');
            void sendDowntimeAlert(
                'kafka-publish-open',
                'Kafka publish circuit opened. Messages that cannot be published are being dropped.',
            );
        });

        this.publishBreaker.on('halfOpen', () => {
            logger.warn('[circuit: kafka-publish] Half-open; testing Kafka recovery');
        });

        this.publishBreaker.on('close', () => {
            logger.info('[circuit: kafka-publish] Closed; Kafka publishing restored');
        });
    }
```

The circuit breaker wraps Kafka publish calls. Each wrapped call has a 12s outer timeout, while the Kafka send has a 10s timeout. After at least 5 calls, if 50% or more fail or time out, the circuit opens and blocks further publish attempts. After 15s, it allows a trial request to Kafka; if that succeeds, the circuit closes and publishing resumes normally, otherwise it opens again.

Rest of the code you can just read through all the lines that have `publishBreaker` it is pretty easy to follow so I am not going to explain.

when want to publish a message to Kafka we can do:

```
 const metadata = await this.publishBreaker.fire(record);
```

and it will publish the message to Kafka if and only if the circuit to Kafka is not Open. If the circuit is open it **sheds** that **request.**

You can do this for all of your systems RabbitMQ, Redis, Postgres, External Service, Internal Service…

Now instead of hammering down on already overwhelmed resource we fail fast and shed the request which prevents the butterfly effect of one service causing company wide outage.

### Breaker with Fallback

Above method will work for most use cases, but shedding the request might not be a good idea if the request is very important. For example a `payment.authorized`  webhook from Payment processor (Stripe, Razorpay) or anything that is important for the your company’s business.

For these important requests, what I like to do is.

1. Identify the important requests/messages.
2. Identify the systems from most powerful to least powerful.
3. Add circuit breakers to all the identified systems/services.
4. Escalate from less powerful systems to more powerful systems when capacity is exceeded.

Example:

```
    try {

        const metadata = await this.publishBreaker.fire(record);
            return [null, metadata];
        } catch (error) {
            await mongoBreaker.fire(record); // here we are using Mongo as fallback, which itself is wrapped with Circuit breaker.
            if (this.publishBreaker.opened || this.publishBreaker.halfOpen) {
                void sendDowntimeAlert(
                    `kafka-publish-drop:${topic}:${jobName}`,
                    `Kafka circuit is open; dropping message. topic=${topic} job=${jobName} error=${getErrorText(error)}`,
                );
            }

            return [error, null];
        }
```

Another example would be:

if you have RabbitMQ and Kafka both, Chances of RabbitMQ being overwhelmed are more than that of Kafka.

So when circuit for RabbitMQ trips, instead of dropping that message we queue that same message to Kafka and start consuming from Kafka.

> RabbitMQ and Kafka are much more complex than this, and I’m intentionally oversimplifying the explanation here. Why RabbitMQ might become overwhelmed faster than Kafka is a separate topic in itself and is outside the scope of this article**.**

One thing with setup like this is the cost, for both:

- Kafka instance itself which is unavoidable
- and Kafka consumer.

because you now have to keep a Kafka consumer up all the time with potentially doing no work as outages are very rare (should be :p). But, this can be avoided easily with event driven HPA like KEDA. With KEDA you can configure your HPA to watch the Kafka topic periodically and if topic has more than 0 records scale up the consumer pods for that topic from 0 to some number X.

You can take this ever further by adding fallback to Kafka as well, so in case Kafka is overwhelmed we can queue the messages to a Postgres table and have periodic worker to pull messages from Postgres and queue back again to Kafka when Kafka is up.

## Safety

Breaker with a fallback approach works really well but you have to be extra careful at each fallback because you are shifting your traffic from one system to the other it has to be processes in the end, it won’t just magically disappear on its own.

For example Kafka’s throughput is way more than that of Postgres. Kafka can handle millions of messages per second while postgres will peak at 30k-40k transactions per second. If we decided to naively stream all Kafka traffic to Postgres we will end up with overwhelmed Postgres instance or just crash it entirely. Another bad example could when cache is down fallback to the DB directly, single Redis instance handles ~100K TPS if we stream all that to some single instance of a DB, it will definitely get overwhelmed or just completely go down.

You take some measures to prevent this from happening:

- check the numbers, if your peak traffic definition is 10k-20k then you won’t have to worry and you can just fallback to Postgres.
- **Always** add Circuit breaker to the fallback system.
- use things like in-memory batching to reduce the network IO, instead of making 100k network calls for sending 100k records in a second, just batch them in memory and send the entire batch after 1 second in one network call.
- To prevent cache traffic hitting the DB directly you can use in process caching and request [coalescing](https://support.bunny.net/hc/en-us/articles/6762047083922-Understanding-Request-Coalescing).
- Introduce rate limiters to prevent excessive traffic from entering the system in the first place.
  - However, this approach only works when rate limiting is acceptable. Some requests cannot be easily rate limited, such as internal service-to-service calls, payment callbacks, important background jobs.

### Conclusion

Add circuit breakers to protect the important systems to keep your services running. Shed not so important messages, add fallback for the messages that are important, protect fallbacks with circuit breakers to keep them from meeting the same end as the upstream system.

---

There is much more to discuss here but covering everything will also make the article very long and harder to follow. I will be breaking down the concepts like Caching, Kafka or RabbitMQ a bit more in future articles.

Hey you can also subscribe if you liked reading it.
