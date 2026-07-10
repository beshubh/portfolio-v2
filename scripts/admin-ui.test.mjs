import assert from "node:assert/strict";
import { payloadFromDraft, slugFromTitle } from "../src/admin/draft.js";

assert.equal(
  slugFromTitle("You might be unaware of Celery's delayed semantics."),
  "you-might-be-unaware-of-celerys-delayed-semantics",
);

assert.deepEqual(
  payloadFromDraft({
    title: "Shipping queues safely",
    slug: "shipping-queues-safely",
    date: "2026-07-10",
    summary: "What failed and what changed.",
    tags: " Reliability, celery, reliability ",
    body: "The post body.",
  }),
  {
    title: "Shipping queues safely",
    slug: "shipping-queues-safely",
    date: "2026-07-10",
    summary: "What failed and what changed.",
    tags: ["reliability", "celery"],
    body: "The post body.",
  },
);
