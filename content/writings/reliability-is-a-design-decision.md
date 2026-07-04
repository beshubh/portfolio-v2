---
title: Reliability Is a Design Decision
date: 2026-05-24
summary: Lessons from queues, fallbacks, and production systems that cannot assume dependencies stay healthy.
tags: [reliability, distributed-systems]
status: published
---

Reliability work rarely begins with a single dramatic algorithm. It begins by refusing to treat dependency failure as an exceptional event.

## Name the failure mode

“The queue is down” is not specific enough. Can producers still accept work? Can consumers replay it later? Is controlled loss acceptable for one message class but dangerous for another? Each answer produces a different design.

The first useful step is to state the guarantee, then identify how it can be violated.

## Fallbacks need contracts

A fallback is another operating mode, not an error-handling footnote. It needs capacity limits, observability, and an explicit answer for duplicates and ordering. Otherwise it only moves the failure somewhere less visible.

## Recovery is part of the feature

Circuit breakers and alternate queues can contain a failure, but the system also needs a path back. Recovery must avoid a synchronized rush of traffic and make partial state visible to operators.

The code for these mechanisms is often straightforward. The engineering value lies in deciding which guarantees matter and making degraded behavior deliberate.
