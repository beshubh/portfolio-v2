---
title: You might be unaware of celery's delayed semantics.
date: 2026-05-29
summary: You might be unaware of celery's delayed semantics.
tags: [celery, python, distributed-systems]
status: published
---

We use Celery extensively in our Internal workflow builder system, although it is used in various other places, its most prominent use case is within workflow builder. The delay step in the workflow builder is powered by Celery’s delayed feature:
`task.apply_async(countdown=15*60)`

will triggers the `task` execution after 15 minutes.

But...

Since the inception of this system, we have occasionally faced a problem where workers get stuck and fail to consume tasks, even though they have fetched a substantial number of them. This leads to an accumulation of tasks in RabbitMQ, resulting in increased memory consumption, overwhelmed RabbitMQ connections, and ultimately causing our main Django server to hang on RabbitMQ connections, leading to the entire server going down.

No matter how many times we restart the workers, the problem persists, sometimes forcing us to delete all tasks from the queues to restore normalcy.

If you’re not familiar with Celery, here’s a small note from [Full Stack Python](https://www.fullstackpython.com/celery.html):

> In short, you want your [WSGI server](https://www.fullstackpython.com/wsgi-servers.html) to respond to incoming requests as quickly as possible because each request ties up a worker process until the response is finished. Moving work off those workers by spinning up asynchronous jobs as tasks in a queue is a straightforward way to improve WSGI server response times.

The main problem here is our basic understanding of how Celery works.

This is how we had configured our Celery settings:

```
worker_prefetch_multiplier = 4
broker_url = os.environ.get('CELR_RABBITMQ_URL')
timezone = 'Asia/Kolkata'
task_ignore_result = True
task_default_queue = DEFAULT_QUEUE_NAME
broker_transport_options = {'visibility_timeout': 32400, 'socket_keepalive': True, 'health_check_interval': 4}
broker_heartbeat = 30
broker_connection_retry = True
```

The main thing here is the `worker_prefetch_multiplier`, which determines how many tasks a Celery worker will fetch from RabbitMQ.

And this is how we launch a Celery worker:

```
celery -A flow_builder worker -Q flow_engine -Ofair -P threads -c 100
```

We use threads as a pool with a concurrency of 100, so a total of 400 tasks would be fetched by one worker.

To queue a task, we make a simple call `task.delay(*args)` and to schedule a task for the future (e.g., 2 minutes later), we use `task.apply_async(args=(*args,), countdown=120)`.

Simple enough.

So if we have:

```
worker_prefetch_multiplier = 1
celery -A flow_builder worker -Q flow_engine -P threads -c 2
```

The maximum tasks that a worker will fetch are 2.

Now, let’s queue:

```
task1.apply_async((*args), countdown=120)
task2.apply_async((*args), countdown=120)
task3.apply_async((*args), countdown=10)
task4.apply_async((*args), countdown=10)
```

With the above code, task3 and task4 should be executed after 10 seconds, and task1 and task2 should get executed after 120 seconds.

However, this is not the case. As soon as the tasks are published to the queue, the worker immediately fetches all the tasks from the queue up to the `prefetch_count` (2 in our case) and keeps them in the cache until it’s time to run them. In our case, the worker is full after task2 is published, so task3 and task4 will have to wait in RabbitMQ for 120 seconds before task1 and task2 are finished, after which task3 and task4 get their turn.

The problem isn’t that workers get stuck; rather, the workers are just not doing anything because they are filled with tasks that should be executed in the future. This explains why we see consumers not acknowledging tasks, even though they have fetched thousands of them.

This could also cause workers to crash because if we configure a very high `prefetch_multiplier`, the worker caches many tasks, requiring a lot of memory that the worker might not have, leading to OOM crashes. If your `prefetch_count` is too big, no matter how many workers you spawn with Kubernetes, they will all die one by one. Each worker would take in all the tasks, die, then re-delivery will happen, and another worker will take all the tasks and die with OOM, repeating until all workers are dead.

### How to Fix This?

First, we separated the queues for tasks with a delay and those without a delay. This ensures that tasks to be executed immediately are not affected by delayed tasks. You can do this easily by having a separate dedicated queue that will only handle delayed tasks.

```
celery -A flow_builder worker -Q delayed -P threads -c 20
```

We have also given it very low concurrency so the worker doesn’t crash by fetching all the tasks. Now, while queuing a task, you can specify this queue if you know the task has a delay.

```
task.apply_async((*args,), countdown=120, queue='delayed')
```

~~With this, we solved the issue.~~

Next, we enforced a strict limit on the amount of delay allowed in Celery task scheduling. If you need a task to be executed after 4 hours, 8 hours, or even 1 hour, don’t use Celery because that is too long for Celery or RabbitMQ to hold your task. Essentially, you’re using the broker as a database, don’t use the broker as a database; use the database as a database.

Here’s how we do it:

```python
if delay < settings.THRESHOLD: # 1 hour
    task.apply_async(
        args=(*args,),
        countdown=delay
    )
    return
else:
    delayed_job_create(
        schedule_time=timezone.now() + timedelta(seconds=delay),
        args=[*args],
    )
```

If the delay is less than a specified threshold, queue in Celery; otherwise, create a database entry.

Then a cron job runs every 30 minutes to track all entries to be executed in that timeframe and schedule them using Celery.

```python
def service_function(*args, delay_seconds=0, **kwargs):
    # Schedule using Celery
    if delay > 0:
        task.apply_async(
            args=args, countdown=delay_seconds, kwargs=kwargs, queue='delayed')
    else:
        task.apply_async(
            args=args, countdown=delay_seconds, kwargs=kwargs)

DELAYED_JOB_SERVICES = {
    DelayedJob.JOB_TYPE: service_function
}

@app.task(name='cron.queue_delayed_jobs')
def queue_delayed_jobs_task():
    now = timezone.now()
    next_30min = now + timedelta(minutes=30)
    jobs = DelayedJob.objects.filter(schedule_time__lte=next_30min, queued=False).values_list('id', flat=True)
    for job_id in jobs:
        job = DelayedJob.objects.get(id=job_id)
        delay = job.schedule_time - now
        delay_seconds = int(delay.total_seconds())
        DELAYED_JOB_SERVICES[job.job_type](*job.args, delay_seconds=delay_seconds, **job.kwargs)
        job.queued = True
        job.save()
```

You can read about how to set up cron in Celery [here](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html#crontab-schedules).

With this approach, we only queue tasks that need to be executed within an hour in RabbitMQ, thus solving our problem of overwhelming RabbitMQ memory, connections, and ultimately, the Django server.
