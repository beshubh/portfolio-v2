---
title: About
description: Principal software engineer working on distributed systems, reliability, and performance.
---

Hey, my name is Shubham and I am a software engineer.

My journey started back in 2017 when I first tried programming with [SoloLearn](https://sololearn.com) on my Android device.
That same year, I also got into college and got my first laptop at the age of 17.

Fast-forward to 2020: I got my first internship as a backend engineer at [Tarzan Way](https://thetarzanway.com), working with [Django](https://www.djangoproject.com/), **Elasticsearch**, **AWS**, and **PostgreSQL**.


I helped improve the **Django** admin for our ops and content team. I also built an AWS SNS-based pub/sub broker that decoupled the CRM backend from the API servers, improving reliability and fault isolation.


Four months into the internship, I started looking for another opportunity—because why not? A call led me to [ClassCast](https://), where I would have full autonomy to build at scale.


I joined as a backend intern. The CEO’s brief was direct: the existing backend was convoluted, unreliable, and needed to be rebuilt from scratch.


Within a week, I presented a re-architecture plan and began rebuilding the course-hosting backend with **Django**, **MySQL**, **Redis**, and **GCP App Engine**. I launched it three months later; it served more than 100K students across India.


They loved my work so much that they sent me a one-way ticket to Bangalore. I moved there with them to build a real-time chat platform for educational institutes—the Discord of edtech.


It used **Node.js**, **Socket.IO**, **Redis Pub/Sub**, and **MySQL**. I worked as a system administrator and backend engineer, handled DevOps, and did everything else that came with deploying HTTP backends to real users.


We got five clients. I was happy that my code was being used by real users every single day.
Six months later, the founders called: “We are shutting down the company. Growth is really slow.”


I was jobless.

I started looking for a new company. Then [Nikhil](https://www.linkedin.com/in/nikhilgupta1997/) called: “Do you wanna join [LimeChat](https://limechat.ai)? We are building AI-based customer support for enterprises and e-commerce.”
Three rounds later, I joined as a software engineer.


**1st year**:

- I refactored convoluted parts of the integrations platform with a beautifully crafted, handwritten observer pattern, **eliminating** event-dispatch regressions and reducing developer brain fatigue.

- I re-architected Django APIs across products, cutting serializer-change regressions by 50%, then ran an online session to share the approach with the tech team.
- I started weekly tech sessions where engineers gave talks about something new they had learned or recently built.


**2nd year**:


- I solved a **Gunicorn** scaling problem in our **Django** HTTP servers, allowing us to scale them much further.
- I introduced **PgBouncer** across multiple applications, cutting PostgreSQL CPU usage from **90%** to **40%** and connections from **5k** to **3k**.
- I fixed a multi-year **Celery** and **RabbitMQ** problem that caused workers to hang at peak hours, taking down HTTP servers and requiring manual recovery. I wrote about it [here](./writings/celery.md).
- I built a link-shortening service that tracked **50%** of annual broadcast revenue across ~**1M+** unique links per day.
- I brought backend unit-test coverage to **100%**, reducing the time needed to test new features, **eliminating** feature-change regressions, and making testing a company-wide practice.

**3rd year**:


- I designed and scaled the Unified Messages System used by every LimeChat product. It handles more than **100M** messages and **1B** requests per day and contributes millions of dollars in annual revenue.
- I removed a multi-year CRM broadcast bottleneck, scaling campaigns from **60K** to **1M** messages.
- I led 3 engineers to ship 3 revenue-critical products in under 3 months: **User Segments**, [Workflow Builder](https://outbound.limechat.ai), and **Unified Messaging System**.

**4th year and onwards**:


- I designed **ModelNexus**, a model-agnostic LLM and agent library that did not see adoption at LimeChat—a product nobody wanted, maybe? It was a good lesson.
- I architected LimeChat's Voice Agents platform, creating an entirely new product for the company. It let clients handle calls with AI agents, contributed over **$600K** in revenue, and brought in ~**10** large enterprise deals.
- I built a novel audio bridge between WhatsApp and LiveKit that made it possible to handle WhatsApp calls with AI agents. We built it before anyone else in India—and even before LiveKit itself—making LimeChat the first company in India to offer this capability. I wrote about it [here](../writings/audio-bridge.md).
  - I ported the Python prototype to **Rust**, cutting CPU usage by 80% and significantly reducing hosting costs.
- I led a company-wide reliability initiative that made critical infrastructure self-protecting under overload:
  - added circuit breakers across Kafka, RabbitMQ, Redis, DB-backed caches, and databases to contain failures before they cascaded.
  - designed automatic fallback queue paths that rerouted work when primary queues were overwhelmed.
  - archived old transactional data to S3 and added system-wide CPU, memory, and bandwidth alerts.
  - eliminated queue-overload outages and prevented runaway workloads from overwhelming databases.
  - I wrote about the design [here](TODO_URL).
- I worked with the Agents Studio team to cut peak chat-agent latency by 60%, from 15s to 6s, by introducing semantic caching and removing high-fanout database reads.
