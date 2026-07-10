import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { payloadFromDraft, slugFromTitle } from "../src/admin/draft.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const adminApp = await readFile(path.join(root, "src", "admin", "AdminApp.jsx"), "utf8");
assert.match(adminApp, /Committed\. GitHub Pages is deploying it now\./);
assert.doesNotMatch(adminApp, />Published\./);
